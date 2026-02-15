"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { InfoHint } from "@/components/shared/InfoHint";
import { parseSavedFilename } from "@/components/SavedTracksList";
import { getApiErrorMessage } from "@/lib/api-error";
import { GenerationProgress } from "@/components/generate/GenerationProgress";

// KIE docs recommend polling every 30s; 15s balances responsiveness and rate limits
const POLL_INTERVAL_MS = 15000;

type CreateMusicVideoFormProps = {
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  selectedAudioId?: string | null;
  onClearSelection?: () => void;
};

export function CreateMusicVideoForm({
  selectedTrackFilename,
  selectedTrackName,
  selectedAudioId,
  onClearSelection,
}: CreateMusicVideoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [author, setAuthor] = useState("");
  const [domainName, setDomainName] = useState("");
  const [videoFilename, setVideoFilename] = useState<string | null>(null);
  const [videoTaskId, setVideoTaskId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parsed = selectedTrackFilename ? parseSavedFilename(selectedTrackFilename) : null;
  const musicTaskId = parsed?.taskId ?? null;
  const trackIndex = parsed?.index ?? null;
  const hasSelection = Boolean(selectedTrackFilename && musicTaskId && selectedAudioId);
  const invalidForm = !hasSelection;
  const isBusy = isSubmitting || isPolling;

  const buildCheckParams = useCallback(() => {
    const params = new URLSearchParams({ taskId: musicTaskId ?? "" });
    if (selectedTrackFilename) params.set("filename", selectedTrackFilename);
    if (selectedAudioId) params.set("audioId", selectedAudioId);
    else if (trackIndex != null) params.set("index", String(trackIndex));
    return params;
  }, [musicTaskId, selectedTrackFilename, selectedAudioId, trackIndex]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const videoSrc =
    videoFilename != null
      ? `/api/audio/stream?filename=${encodeURIComponent(videoFilename)}${videoTaskId ? `&v=${encodeURIComponent(videoTaskId)}` : ""}`
      : videoUrl ?? null;

  useEffect(() => {
    if (!musicTaskId) {
      setVideoFilename(null);
      setVideoTaskId(null);
      setVideoUrl(null);
      return;
    }
    const audioId = selectedAudioId?.trim();
    const index = trackIndex ?? null;
    if (!audioId && !index) {
      setVideoFilename(null);
      setVideoTaskId(null);
      setVideoUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = buildCheckParams();
        const res = await fetch(`/api/createMusicVideo/check?${params}`);
        const data = await res.json();
        if (cancelled || !res.ok) return;
        if (data.hasVideo && data.videoFilename) {
          setVideoFilename(data.videoFilename);
          setVideoTaskId(data.videoTaskId ?? null);
          setVideoUrl(null);
        } else {
          setVideoFilename(null);
          setVideoTaskId(null);
          setVideoUrl(null);
        }
      } catch {
        if (!cancelled) {
          setVideoFilename(null);
          setVideoTaskId(null);
          setVideoUrl(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [musicTaskId, selectedAudioId, trackIndex, selectedTrackFilename, buildCheckParams]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy || invalidForm || !musicTaskId || !selectedAudioId) return;

    setIsSubmitting(true);
    setError(null);
    setVideoFilename(null);
    setVideoTaskId(null);
    setVideoUrl(null);
    setVideoStatus(null);
    stopPolling();

    try {
      const body: Record<string, string> = { taskId: musicTaskId, audioId: selectedAudioId };
      const authorTrimmed = author.trim();
      const domainTrimmed = domainName.trim();
      if (authorTrimmed) body.author = authorTrimmed.slice(0, 50);
      if (domainTrimmed) body.domainName = domainTrimmed.slice(0, 50);

      const res = await fetch("/api/createMusicVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(getApiErrorMessage(res, data, "Failed to create music video"));
        return;
      }

      const videoTaskId = data.videoTaskId;
      if (!videoTaskId) {
        setError("No video task ID returned");
        return;
      }

      const pollStatus = async () => {
        try {
          const statusRes = await fetch(
            `/api/createMusicVideo/status?taskId=${encodeURIComponent(videoTaskId)}`
          );
          const statusData = await statusRes.json();
          if (!statusRes.ok) {
            setError(statusData.error || "Failed to fetch status");
            setVideoStatus(null);
            stopPolling();
            return;
          }
          setVideoStatus(statusData.status ?? "PENDING");
          if (statusData.status === "SUCCESS") {
            if (statusData.videoFilename) {
              setVideoFilename(statusData.videoFilename);
              setVideoTaskId(videoTaskId);
            } else if (statusData.videoUrl) {
              setVideoUrl(statusData.videoUrl);
            } else {
              const checkRes = await fetch(`/api/createMusicVideo/check?${buildCheckParams()}`);
              const checkData = await checkRes.json();
              if (checkData.hasVideo && checkData.videoFilename) {
                setVideoFilename(checkData.videoFilename);
                setVideoTaskId(checkData.videoTaskId ?? videoTaskId);
              } else if (statusData.videoUrl) {
                setVideoUrl(statusData.videoUrl);
              }
            }
            setVideoStatus(null);
            stopPolling();
            dispatchVideoGenerated();
            return;
          }
          if (statusData.status === "FAILED") {
            setError("Music video generation failed");
            setVideoStatus(null);
            stopPolling();
            return;
          }
        } catch (err) {
          setError((err as Error).message);
          setVideoStatus(null);
          stopPolling();
        }
      };

      setVideoStatus("PENDING");
      setIsPolling(true);
      await pollStatus();
      pollRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    stopPolling();
    setVideoFilename(null);
    setVideoTaskId(null);
    setVideoUrl(null);
    setVideoStatus(null);
    setError(null);
    onClearSelection?.();
  };

  const dispatchVideoGenerated = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("video-generated"));
    }
  }, []);

  const inProgress = videoStatus === "PENDING" || videoStatus === "GENERATING";
  const statusLabel = videoStatus === "GENERATING" ? "Generating" : "Pending";
  const statusDescription =
    videoStatus === "GENERATING" ? "Creating music video…" : "Waiting to be processed";

  const hasVideo = videoSrc != null;
  const showForm = !hasVideo;

  return (
    <section
      className={`relative mb-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 ${isBusy ? "select-none opacity-90" : ""}`}
      aria-busy={isBusy}
    >
      {isBusy && (
        <div
          className="absolute inset-0 z-10 cursor-not-allowed rounded-xl"
          aria-hidden
        />
      )}
      <div className={isBusy ? "pointer-events-none" : ""}>
        {showForm && (
          <>
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Create Music Video</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Source Track<span className="text-red-500"> *</span>
              </label>
              <InfoHint
                text="Select from Suno Audio Folder"
                tooltip="Choose a track from the Suno Audio Folder above."
                id="create-music-video-source-tooltip"
                compact
                tooltipMaxWidth="20rem"
              />
            </div>
            {hasSelection ? (
              <div className="flex items-center gap-3 rounded-lg border border-green-900/50 bg-[#0f0f0f] p-3">
                <span className="inline-flex h-2 w-2 rounded-full bg-green-500" aria-hidden />
                <span className="flex-1 text-sm text-green-400">
                  {selectedTrackName ?? selectedTrackFilename?.replace(/\.mp3$/i, "") ?? "Selected"}
                </span>
                {onClearSelection && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-sm text-gray-500 hover:text-red-400"
                    title="Clear selection"
                  >
                    Clear
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Select a track from the Suno Audio Folder above.
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="create-music-video-author" className="text-sm font-medium text-gray-300">
                Author
              </label>
              <InfoHint
                text="Creates attribution for the music creator"
                tooltip="Creates attribution for the music creator. Artist or creator name to display as a signature on the video cover. Maximum 50 characters."
                id="create-music-video-author-tooltip"
                compact
                tooltipMaxWidth="20rem"
              />
            </div>
            <input
              id="create-music-video-author"
              type="text"
              maxLength={50}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. DJ Electronic"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="create-music-video-domain" className="text-sm font-medium text-gray-300">
                Domain / Brand
              </label>
              <InfoHint
                text="Useful for promotional branding or attribution"
                tooltip="Website or brand to display as a watermark at the bottom of the video. Maximum 50 characters."
                id="create-music-video-domain-tooltip"
                compact
                tooltipMaxWidth="20rem"
              />
            </div>
            <input
              id="create-music-video-domain"
              type="text"
              maxLength={50}
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              placeholder="e.g. music.example.com"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={invalidForm || isBusy}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
            >
              {isBusy ? (
                <>
                  <span
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-white"
                    aria-hidden
                  />
                  {isPolling ? "Generating…" : "Loading…"}
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Create Music Video
                </>
              )}
            </button>
          </div>
        </form>

        {inProgress && (
          <div className="mt-6">
            <GenerationProgress
              isActive={true}
              label={statusLabel}
              description={statusDescription}
            />
          </div>
        )}
          </>
        )}
      </div>

      {videoSrc && (
        <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">Music Video</h3>
            {onClearSelection && (
              <button
                type="button"
                onClick={handleClear}
                className="text-sm text-gray-500 hover:text-red-400"
                title="Clear and select another track"
              >
                Clear
              </button>
            )}
          </div>
          <video
            key={videoSrc}
            src={videoSrc}
            controls
            className="w-full rounded-lg border border-[#2a2a2a]"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}
    </section>
  );
}

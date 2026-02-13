"use client";

import { useState } from "react";
import type { StatusState } from "@/app/types";
import { IN_PROGRESS_STATUSES } from "@/app/types";
import { InfoHint } from "@/components/shared/InfoHint";
import { parseSavedFilename } from "@/components/SavedTracksList";
import { useSeparateVocalsFormState } from "@/hooks/useSeparateVocalsFormState";

type SeparateVocalsFormProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  selectedAudioId?: string | null;
  onClearSelection?: () => void;
};

export function SeparateVocalsForm({
  statusState,
  setStatusState,
  selectedTrackFilename,
  selectedTrackName,
  selectedAudioId,
  onClearSelection,
}: SeparateVocalsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { startPolling, stopPolling, setError } = useSeparateVocalsFormState({
    setStatusState,
  });

  const hasSelection = Boolean(selectedTrackFilename && selectedAudioId);
  const invalidForm = !hasSelection;

  const isGenerating =
    statusState != null &&
    IN_PROGRESS_STATUSES.includes(statusState.status as (typeof IN_PROGRESS_STATUSES)[number]);
  const isBusy = isSubmitting || isGenerating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy || invalidForm) return;

    const parsed = selectedTrackFilename
      ? parseSavedFilename(selectedTrackFilename)
      : null;
    if (!parsed || !selectedAudioId) return;

    setIsSubmitting(true);
    setStatusState(null);
    stopPolling();

    try {
      const res = await fetch("/api/separateVocals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: parsed.taskId,
          audioId: selectedAudioId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const credits = res.status === 402 || data.code === 402;
        const fallback = credits
          ? "Your balance isn't enough to run this request. Please top up to continue."
          : "Separate vocals failed";
        const displayMessage =
          data.error ?? data.message ?? data.msg ?? fallback;
        const msg =
          typeof displayMessage === "string"
            ? displayMessage
            : "Separate vocals failed";
        setStatusState({
          taskId: "",
          status: "ERROR",
          tracks: [],
          error: msg,
        });
        return;
      }
      const taskId = data.taskId;
      if (!taskId) {
        setError("No task ID returned");
        return;
      }
      setStatusState({ taskId, status: "PENDING", tracks: [] });
      startPolling(taskId, parsed.title);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <h2 className="mb-4 text-lg font-semibold text-gray-200">
          Separate Vocals
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Selected track */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Source Track<span className="text-red-500"> *</span>
              </label>
              <InfoHint
                text="Select from Suno Audio Folder"
                tooltip="Choose a track with vocals from the Suno Audio Folder above."
                id="separate-vocals-source-tooltip"
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
                    onClick={onClearSelection}
                    className="text-sm text-gray-500 hover:text-red-400"
                    title="Clear selection"
                  >
                    Clear
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Select a track with vocals from the Suno Audio Folder above.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={invalidForm || isBusy}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <span
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-white"
                    aria-hidden
                  />
                  Separating…
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
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                  Separate
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

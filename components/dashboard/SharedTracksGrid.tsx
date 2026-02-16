"use client";

import { useState, useCallback, useEffect } from "react";
import { StyledAudioPlayer } from "@/components/StyledAudioPlayer";
import { parseSavedFilename } from "@/components/SavedTracksList";
import { TITLE_GRADIENT } from "@/components/shared/AppTitle";
import Link from "next/link";

type ViewMode = "grid" | "list";

const VIEW_MODE_STORAGE_KEY = "dashboardViewMode";
const GRID_BASE = "grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3";
const INITIAL_COVER_TRACKS = 6;
const LOAD_MORE_COVER_TRACKS = 20;
const INITIAL_AUDIO_TRACKS = 20;
const LOAD_MORE_AUDIO_TRACKS = 20;

function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "list" ? "list" : "grid";
}

export type SharedTrack = {
  id: string;
  localFilename: string;
  title: string;
  taskId: string;
  coverImage: string | null;
  style: string | null;
  prompt: string | null;
  creatorName: string | null;
  creatorEmail: string | null;
  createdAt: string;
};

function formatCreatedDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function getTrackDisplayInfo(track: SharedTrack) {
  return {
    displayTitle: parseSavedFilename(track.localFilename)?.title ?? track.title,
    creatorLabel: track.creatorName?.trim() || track.creatorEmail || null,
    createdDate: formatCreatedDate(track.createdAt),
    audioSrc: `/api/audio/stream?filename=${encodeURIComponent(track.localFilename)}`,
    coverSrc: track.coverImage
      ? `/api/audio/stream?filename=${encodeURIComponent(track.coverImage)}`
      : null,
  };
}

/** Generic cover shown when a track has no cover image. */
function CoverPlaceholder() {
  return (
    <div
      className="flex aspect-[4/3] w-full items-center justify-center text-white/90"
      style={{
        backgroundImage: TITLE_GRADIENT.replace("to right", "135deg"),
      }}
      aria-hidden
    >
      <div className="flex flex-col items-center gap-2">
        <svg className="h-20 w-20 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wider drop-shadow-sm">No Cover</span>
      </div>
    </div>
  );
}

type TrackCardProps = {
  track: SharedTrack;
  isExpanded: boolean;
  onToggle: () => void;
};

function TrackCard({ track, isExpanded, onToggle }: TrackCardProps) {
  const { displayTitle, creatorLabel, createdDate, coverSrc, audioSrc } = getTrackDisplayInfo(track);

  return (
    <article
      className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] transition-colors hover:border-[#3a3a3a]"
      aria-label={`Track: ${displayTitle}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f] rounded-t-xl"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          {(creatorLabel || createdDate) && (
            <div className="absolute right-2 top-2 flex max-w-[70%] flex-col items-end gap-0.5 px-2 py-1.5 text-sm font-semibold text-gray-500">
              {creatorLabel && <span className="min-w-0 truncate" title={creatorLabel}>{creatorLabel}</span>}
              {createdDate && <span className="text-xs font-semibold text-gray-600">{createdDate}</span>}
            </div>
          )}
          {coverSrc ? (
            <img
              src={coverSrc}
              alt=""
              className="h-full w-full object-cover transition-transform hover:scale-105"
            />
          ) : (
            <CoverPlaceholder />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-black/50 p-2 backdrop-blur-sm">
            <h3 className="break-words text-sm font-semibold text-gray-500">{displayTitle}</h3>
          </div>
        </div>
      </button>
      {isExpanded && (
        <div className="border-t border-[#2a2a2a] p-3">
          <StyledAudioPlayer
            className="min-w-[360px] flex-1"
            src={audioSrc}
            preload="metadata"
            downloadFilename={track.localFilename}
            aria-label={`Play ${displayTitle}`}
          />
        </div>
      )}
    </article>
  );
}

type TrackListItemProps = {
  track: SharedTrack;
};

function TrackListItem({ track }: TrackListItemProps) {
  const { displayTitle, creatorLabel, createdDate, audioSrc } = getTrackDisplayInfo(track);

  return (
    <article
      className="relative flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-3 transition-colors hover:border-[#3a3a3a]"
      aria-label={`Track: ${displayTitle}`}
    >
      {(creatorLabel || createdDate) && (
        <div className="flex min-w-0 items-center justify-between gap-2 overflow-hidden">
          {creatorLabel ? (
            <p
              className="min-w-0 flex-1 truncate text-xs font-medium text-gray-500"
              title={creatorLabel}
            >
              {creatorLabel}
            </p>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          {createdDate && (
            <p className="shrink-0 text-[10px] font-medium text-gray-600">{createdDate}</p>
          )}
        </div>
      )}

      <StyledAudioPlayer
        className="min-w-0 flex-1"
        src={audioSrc}
        preload="metadata"
        downloadFilename={track.localFilename}
        compact
        aria-label={`Play ${displayTitle}`}
      />

      <h3
        className="min-w-0 overflow-hidden text-ellipsis line-clamp-2 break-words text-xs font-semibold text-[#f5f5f5]"
        title={displayTitle}
      >
        {displayTitle}
      </h3>
    </article>
  );
}

const VIEW_BTN_BASE =
  "flex h-8 w-8 items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]";
const VIEW_BTN_ACTIVE = "bg-blue-600/30 text-blue-400";
const VIEW_BTN_INACTIVE = "text-gray-500 hover:text-gray-300";

function ViewToggleButton({
  mode,
  isActive,
  onClick,
  label,
  children,
}: {
  mode: ViewMode;
  isActive: boolean;
  onClick: (mode: ViewMode) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(mode)}
      className={`${VIEW_BTN_BASE} ${isActive ? VIEW_BTN_ACTIVE : VIEW_BTN_INACTIVE}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function filterTracksBySearch(tracks: SharedTrack[], query: string): SharedTrack[] {
  if (!query.trim()) return tracks;
  const q = query.trim().toLowerCase();
  return tracks.filter((track) => {
    const { displayTitle } = getTrackDisplayInfo(track);
    return displayTitle.toLowerCase().includes(q);
  });
}

export function SharedTracksGrid() {
  const [tracks, setTracks] = useState<SharedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewModeState] = useState<ViewMode>("grid");
  const [visibleCountCover, setVisibleCountCover] = useState(INITIAL_COVER_TRACKS);
  const [visibleCountAudio, setVisibleCountAudio] = useState(INITIAL_AUDIO_TRACKS);

  useEffect(() => {
    setViewModeState(getStoredViewMode());
  }, []);

  useEffect(() => {
    setVisibleCountCover(INITIAL_COVER_TRACKS);
    setVisibleCountAudio(INITIAL_AUDIO_TRACKS);
  }, [searchQuery]);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }, []);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tracks/shared");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load shared tracks");
      }
      const data = await res.json();
      setTracks(Array.isArray(data.tracks) ? data.tracks : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shared tracks");
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Loading shared tracks…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={fetchTracks}
          className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm text-gray-300 hover:bg-[#2a2a2a]"
        >
          Retry
        </button>
      </div>
    );
  }

  const filteredTracks = filterTracksBySearch(tracks, searchQuery);
  const visibleTracks =
    viewMode === "grid"
      ? filteredTracks.length > INITIAL_COVER_TRACKS
        ? filteredTracks.slice(0, visibleCountCover)
        : filteredTracks
      : filteredTracks.length > INITIAL_AUDIO_TRACKS
        ? filteredTracks.slice(0, visibleCountAudio)
        : filteredTracks;
  const hasMoreCoverTracks =
    viewMode === "grid" && filteredTracks.length > INITIAL_COVER_TRACKS && visibleCountCover < filteredTracks.length;
  const hasMoreAudioTracks =
    viewMode === "list" && filteredTracks.length > INITIAL_AUDIO_TRACKS && visibleCountAudio < filteredTracks.length;

  if (tracks.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">No shared tracks yet.</p>
        <p className="mt-1 text-sm text-gray-600">
          Share your music from the main app to see it here.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg border border-blue-600/50 bg-blue-950/30 px-4 py-2 text-sm text-blue-400 hover:bg-blue-950/50"
        >
          Go to Suno Music Studio
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="dashboard-search" className="sr-only">
          Search by title
        </label>
        <input
          id="dashboard-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title…"
          className="flex-1 min-w-[200px] rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm text-[#f5f5f5] placeholder-gray-500 focus:border-blue-600/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]"
        />
        <div className="flex shrink-0 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-0.5" role="group" aria-label="View mode">
          <ViewToggleButton
            mode="grid"
            isActive={viewMode === "grid"}
            onClick={setViewMode}
            label="Cover view"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </ViewToggleButton>
          <ViewToggleButton
            mode="list"
            isActive={viewMode === "list"}
            onClick={setViewMode}
            label="Audio view"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </ViewToggleButton>
        </div>
      </div>
      {filteredTracks.length === 0 ? (
        <p className="py-8 text-center text-gray-500">No tracks match your search.</p>
      ) : viewMode === "grid" ? (
        <div>
          <div className={GRID_BASE}>
            {visibleTracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                isExpanded={expandedId === track.id}
                onToggle={() => handleToggle(track.id)}
              />
            ))}
          </div>
          {hasMoreCoverTracks && (
            <div className="flex justify-center pt-6">
              <button
                type="button"
                onClick={() => setVisibleCountCover((prev) => prev + LOAD_MORE_COVER_TRACKS)}
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 transition-colors hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]"
                title="Load more"
                aria-label="Load more"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className={`${GRID_BASE} xl:grid-cols-4`}>
            {visibleTracks.map((track) => (
              <TrackListItem key={track.id} track={track} />
            ))}
          </div>
          {hasMoreAudioTracks && (
            <div className="flex justify-center pt-6">
              <button
                type="button"
                onClick={() => setVisibleCountAudio((prev) => prev + LOAD_MORE_AUDIO_TRACKS)}
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 transition-colors hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]"
                title="Load more"
                aria-label="Load more"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

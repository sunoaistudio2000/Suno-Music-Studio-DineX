"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StyledAudioPlayer } from "@/components/StyledAudioPlayer";
import { VocalsStemIcon, InstrumentalStemIcon } from "@/components/shared/FormIcons";
import type { PersonaTaskMeta, SavedPersona } from "@/app/types";

/** Parse filename like taskId-1-title.mp3 into { taskId, index, title } or null. Exported for persona selection. */
export function parseSavedFilename(filename: string): { taskId: string; index: number; title: string } | null {
  const base = filename.replace(/\.mp3$/i, "");
  const parts = base.split("-");
  if (parts.length < 3) return null;
  const [taskId, indexStr, ...titleParts] = parts;
  const index = parseInt(indexStr!, 10);
  if (Number.isNaN(index)) return null;
  const title = titleParts.join("-").replace(/_/g, " ").trim() || "Untitled";
  return { taskId, index, title };
}

/** Group files by taskId; each group has { title, files: [{ filename, index }] } */
function groupSavedFiles(files: string[]): { title: string; files: { filename: string; index: number }[] }[] {
  const byTask: Record<string, { title: string; files: { filename: string; index: number }[] }> = {};
  const ungrouped: { filename: string }[] = [];
  for (const filename of files) {
    const parsed = parseSavedFilename(filename);
    if (!parsed) {
      ungrouped.push({ filename });
      continue;
    }
    if (!byTask[parsed.taskId]) {
      byTask[parsed.taskId] = { title: parsed.title, files: [] };
    }
    byTask[parsed.taskId].files.push({ filename, index: parsed.index });
  }
  for (const key of Object.keys(byTask)) {
    byTask[key].files.sort((a, b) => a.index - b.index);
  }
  const groups = Object.values(byTask);
  if (ungrouped.length > 0) {
    groups.push({
      title: "Other",
      files: ungrouped.map(({ filename }) => ({ filename, index: 0 })),
    });
  }
  return groups;
}

export function trackLabel(index: number): string {
  if (index === 1) return "First Track";
  if (index === 2) return "Second Track";
  return `Track ${index}`;
}

/** Strip "Instrumental-" or "Vocals-" prefix from group title for display. */
function stripStemPrefixFromTitle(title: string): string {
  const t = title.trim();
  const re = /^(instrumental|vocals)[\s-]+/i;
  const stripped = t.replace(re, "").trim();
  return stripped || t;
}

const INITIAL_TRACKS = 4;
const LOAD_MORE_TRACKS = 5;

type GroupWithFiles = { title: string; files: { filename: string; index: number }[] };

/** Flatten groups into [ { groupKey, group, file } ] then slice and regroup for pagination. */
function flattenAndRegroup(
  groups: GroupWithFiles[],
  visibleCount: number
): { groupKey: string; group: GroupWithFiles; files: { filename: string; index: number }[] }[] {
  const flattened: { groupKey: string; group: GroupWithFiles; file: { filename: string; index: number } }[] = [];
  for (const group of groups) {
    const groupKey = group.title + group.files.map((f) => f.filename).join(",");
    for (const file of group.files) {
      flattened.push({ groupKey, group, file });
    }
  }
  const visible = flattened.slice(0, visibleCount);
  const byKey: Record<string, { groupKey: string; group: GroupWithFiles; files: { filename: string; index: number }[] }> = {};
  for (const { groupKey, group, file } of visible) {
    if (!byKey[groupKey]) byKey[groupKey] = { groupKey, group, files: [] };
    byKey[groupKey].files.push(file);
  }
  return Object.values(byKey);
}

/** Track type filter options with icons and colors. */
const TRACK_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All", icon: "grid", color: "text-gray-400" },
  { value: "generated", label: "Generated", icon: "generated", color: "text-amber-400" },
  { value: "extended", label: "Extended", icon: "extend", color: "text-purple-400" },
  { value: "mashup", label: "Mashup", icon: "mashup", color: "text-cyan-400" },
  { value: "uploadExtend", label: "Upload & Extend", icon: "uploadExtend", color: "text-teal-400" },
  { value: "uploadCover", label: "Upload & Cover", icon: "uploadCover", color: "text-sky-400" },
  { value: "generateCover", label: "Generate Cover", icon: "generateCover", color: "text-emerald-400" },
  { value: "createMusicVideo", label: "Create Music Video", icon: "createMusicVideo", color: "text-blue-400" },
  { value: "addInstrumental", label: "Add Instrumental", icon: "addInstrumental", color: "text-orange-300" },
  { value: "addVocals", label: "Add Vocals", icon: "addVocals", color: "text-pink-400" },
  { value: "separateVocals", label: "Separate Vocals", icon: "separateVocals", color: "text-indigo-400" },
  { value: "shared", label: "Shared", icon: "shared", color: "text-emerald-400" },
] as const;

export type TrackTypeFilterValue = (typeof TRACK_TYPE_FILTER_OPTIONS)[number]["value"];

function filterByTrackType(
  files: string[],
  typeFilter: TrackTypeFilterValue,
  tasks: Record<string, PersonaTaskMeta> | null,
  sharedMap: Record<string, boolean>
): string[] {
  if (typeFilter === "all") return files;
  if (typeFilter === "shared") return files.filter((f) => sharedMap[f] === true);
  if (!tasks || Object.keys(tasks).length === 0) return files;
  return files.filter((filename) => {
    if (typeFilter === "generated") return isGeneratedTrack(filename, tasks);
    if (typeFilter === "extended") return isExtendedTrack(filename, tasks);
    if (typeFilter === "mashup") return isMashupTrack(filename, tasks);
    if (typeFilter === "uploadExtend") return isUploadExtendedTrack(filename, tasks);
    if (typeFilter === "uploadCover") return isUploadCoveredTrack(filename, tasks);
    if (typeFilter === "generateCover") return hasCoverImage(filename, tasks);
    if (typeFilter === "createMusicVideo") return hasVideo(filename, tasks);
    if (typeFilter === "addInstrumental") return isAddInstrumentalTrack(filename, tasks);
    if (typeFilter === "addVocals") return isAddVocalsTrack(filename, tasks);
    if (typeFilter === "separateVocals") return isSeparateVocalsTrack(filename, tasks);
    return true;
  });
}

function TrackTypeFilterIcon({ icon, color = "text-gray-400" }: { icon: string; color?: string }) {
  const cls = `h-4 w-4 shrink-0 ${color}`;
  if (icon === "grid")
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    );
  if (icon === "generated")
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    );
  if (icon === "extend")
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    );
  if (icon === "mashup")
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    );
  if (icon === "uploadExtend")
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    );
  if (icon === "uploadCover")
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  if (icon === "generateCover")
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  if (icon === "createMusicVideo")
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  if (icon === "addInstrumental")
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    );
  if (icon === "addVocals")
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.22.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    );
  if (icon === "separateVocals")
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.242 4.242 3 3 0 004.242-4.242zm0-5.758a3 3 0 10-4.242 4.242 3 3 0 004.242-4.242z" />
      </svg>
    );
  if (icon === "shared")
    return (
      <svg className={cls} fill="currentColor" viewBox="0 0 24 24">
        <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    );
  return null;
}

const SELECT_BTN_BASE =
  "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]";
export const SELECT_BTN_SELECTED = `${SELECT_BTN_BASE} border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500`;
export const SELECT_BTN_UNSELECTED = `${SELECT_BTN_BASE} border-[#2a2a2a] bg-[#1a1a1a] text-gray-400 hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:ring-blue-500`;
export const DELETE_BTN_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-900/50 bg-red-950/30 text-red-400 transition-colors hover:border-red-600/50 hover:bg-red-950/50 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f] disabled:opacity-50";

const SHARE_BTN_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0f0f0f] disabled:opacity-50";

function ShareButton({
  filename,
  isShared,
  isUpdating,
  onShareToggle,
}: {
  filename: string;
  isShared: boolean;
  isUpdating: boolean;
  onShareToggle: (filename: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={isUpdating}
      onClick={() => onShareToggle(filename)}
      className={
        isShared
          ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-600/50 bg-emerald-950/30 text-emerald-400 transition-colors hover:border-emerald-500 hover:bg-emerald-950/50 hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f] disabled:opacity-50"
          : "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1a1a1a] text-gray-400 transition-colors hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f] disabled:opacity-50"
      }
      title={isShared ? "Shared – click to unshare" : "Share"}
      aria-label={isUpdating ? "Updating…" : isShared ? "Shared – click to unshare" : "Share"}
    >
      {isUpdating ? (
        <span className="text-xs">…</span>
      ) : isShared ? (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      )}
    </button>
  );
}

type SavedTracksListProps = {
  selectedFilename?: string | null;
  onSelectFilename?: (filename: string | null) => void;
  /**
   * Selection mode:
   * - "persona": filter vocal tracks, show persona checkmarks
   * - "extend": show tracks with metadata, simple select buttons
   * - "uploadExtend": show all tracks with metadata, simple select buttons
   * - "uploadCover": same as uploadExtend
   * - "addInstrumental": same as uploadCover (select track as source)
   * - "addVocals": same as addInstrumental (select track as source)
   * - "separateVocals": tracks with vocals (audioId), for stem separation
   * - "mashup": show all tracks with select buttons (no delete)
   * - "getLyrics": vocal tracks only, for timestamped lyrics
   * - "generateLyrics": all tracks, no select/delete buttons (read-only list)
   * - "generateCover": all tracks with metadata, select track to generate cover image
   * - "createMusicVideo": tracks with audioId, select track to create music video
   * - "shared": only shared tracks, share button only (no select, no delete)
   * - undefined: normal mode with delete buttons
   */
  selectionMode?: "persona" | "extend" | "uploadExtend" | "uploadCover" | "addInstrumental" | "addVocals" | "separateVocals" | "mashup" | "getLyrics" | "generateLyrics" | "generateCover" | "createMusicVideo" | "shared";
  /** Override section title (e.g. "Shared Music" for shared mode). */
  sectionTitle?: string;
  /** When provided (e.g. from page), used instead of fetching; avoids duplicate requests. */
  personaMetadata?: Record<string, PersonaTaskMeta> | null;
  personas?: SavedPersona[];
  /** When true, show a select button before delete to choose which track loads the generation form. */
  showLoadFormRadio?: boolean;
  /** Selected track filename for loading form (single selection). */
  selectedLoadFormFilename?: string | null;
  onSelectLoadFormFilename?: (filename: string | null) => void;
  /** When true, show a search input that filters tracks by generation fields (prompt, style, title, etc.). */
  showSearch?: boolean;
  /** Called when user clicks "New Generation" — resets form, pauses all audio, scrolls to form. */
  onNewGeneration?: () => void;
  /** When true, show a share button before delete (Generate Music mode only). */
  showShareButton?: boolean;
  /** Called when track type filter changes. Use to hide form panels when filter is not "all". */
  onTrackTypeFilterChange?: (filter: string) => void;
};

/** When showSelection is true, only include vocal files (exclude instrumental tracks).
 * When metadata is null or empty, show all files so tracks are visible while metadata loads. */
function filterVocalTracks(
  files: string[],
  tasks: Record<string, PersonaTaskMeta> | null
): string[] {
  if (!tasks || Object.keys(tasks).length === 0) return files;
  return files.filter((filename) => {
    const parsed = parseSavedFilename(filename);
    if (!parsed) return false;
    const task = tasks[parsed.taskId];
    if (!task) return false;
    if (task.instrumental === true) return false;
    const track = task.tracks?.[parsed.index - 1];
    return Boolean(track?.id);
  });
}

/** Filter files by taskId in metadata. When metadata is null or empty, show all files. */
function filterByTaskMetadata(
  files: string[],
  tasks: Record<string, PersonaTaskMeta> | null
): string[] {
  if (!tasks || Object.keys(tasks).length === 0) return files;
  return files.filter((filename) => {
    const parsed = parseSavedFilename(filename);
    if (!parsed) return false;
    return Boolean(tasks[parsed.taskId]);
  });
}

/** True if this filename's track (taskId + audioId from metadata) already has a persona. */
function trackHasPersona(
  filename: string,
  tasks: Record<string, PersonaTaskMeta> | null,
  personas: SavedPersona[]
): boolean {
  if (!tasks || personas.length === 0) return false;
  const parsed = parseSavedFilename(filename);
  if (!parsed) return false;
  const task = tasks[parsed.taskId];
  const track = task?.tracks?.[parsed.index - 1];
  const audioId = track?.id?.trim();
  if (!audioId) return false;
  return personas.some((p) => p.taskId === parsed.taskId && p.audioId === audioId);
}

function getTask(filename: string, tasks: Record<string, PersonaTaskMeta> | null): PersonaTaskMeta | undefined {
  if (!tasks) return undefined;
  const parsed = parseSavedFilename(filename);
  return parsed ? tasks[parsed.taskId] : undefined;
}

function isExtendedTrack(filename: string, tasks: Record<string, PersonaTaskMeta> | null): boolean {
  const task = getTask(filename, tasks);
  return task?.isExtension === true && !task?.isUploadExtension && !task?.isUploadCover;
}

/** True when track is from main generation only—no badge (not extended, mashup, add-*, etc.). Vocals or instrumental cases we just generated. */
function isGeneratedTrack(filename: string, tasks: Record<string, PersonaTaskMeta> | null): boolean {
  const task = getTask(filename, tasks);
  if (!task) return false;
  return (
    !task.isExtension &&
    !task.isUploadExtension &&
    !task.isUploadCover &&
    !task.isAddInstrumental &&
    !task.isAddVocals &&
    !task.isSeparateVocals &&
    !task.isMashup
  );
}

function isUploadExtendedTrack(filename: string, tasks: Record<string, PersonaTaskMeta> | null): boolean {
  return getTask(filename, tasks)?.isUploadExtension === true;
}

function isUploadCoveredTrack(filename: string, tasks: Record<string, PersonaTaskMeta> | null): boolean {
  return getTask(filename, tasks)?.isUploadCover === true;
}

function isAddInstrumentalTrack(filename: string, tasks: Record<string, PersonaTaskMeta> | null): boolean {
  return getTask(filename, tasks)?.isAddInstrumental === true;
}

function isAddVocalsTrack(filename: string, tasks: Record<string, PersonaTaskMeta> | null): boolean {
  return getTask(filename, tasks)?.isAddVocals === true;
}

function isSeparateVocalsTrack(filename: string, tasks: Record<string, PersonaTaskMeta> | null): boolean {
  return getTask(filename, tasks)?.isSeparateVocals === true;
}

function isMashupTrack(filename: string, tasks: Record<string, PersonaTaskMeta> | null): boolean {
  return getTask(filename, tasks)?.isMashup === true;
}

/** True when this task has generated cover artwork. Works for all variants: generated, extended, upload extended, upload covered, add instrumental, add vocals, mashup, etc. */
function hasCoverImage(filename: string, tasks: Record<string, PersonaTaskMeta> | null): boolean {
  return getTask(filename, tasks)?.hasCoverImage === true;
}

function hasVideo(filename: string, tasks: Record<string, PersonaTaskMeta> | null): boolean {
  const parsed = parseSavedFilename(filename);
  if (!parsed) return false;
  const task = getTask(filename, tasks);
  const track = task?.tracks?.[parsed.index - 1];
  return Boolean(track?.hasVideo);
}

function isInstrumentalTrack(filename: string, tasks: Record<string, PersonaTaskMeta> | null): boolean {
  const parsed = parseSavedFilename(filename);
  if (!parsed) return false;
  const task = getTask(filename, tasks);
  if (!task) return false;
  if (task.instrumental === true) return true;
  const track = task.tracks?.[parsed.index - 1];
  return Boolean(track && !track.id);
}

export function SavedTracksList({
  selectedFilename: controlledFilename,
  onSelectFilename,
  selectionMode,
  personaMetadata: personaMetadataProp,
  personas: personasProp,
  showLoadFormRadio = false,
  selectedLoadFormFilename = null,
  onSelectLoadFormFilename,
  showSearch = false,
  onNewGeneration,
  showShareButton = false,
  sectionTitle,
  onTrackTypeFilterChange,
}: SavedTracksListProps) {
  const { data: session } = useSession();
  const showSelection = selectionMode != null;
  const isPersonaMode = selectionMode === "persona";
  const isExtendMode = selectionMode === "extend";
  const [savedFiles, setSavedFiles] = useState<string[]>([]);
  const [sharedMap, setSharedMap] = useState<Record<string, boolean>>({});
  const [sharedAtMap, setSharedAtMap] = useState<Record<string, string>>({});
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const [sharingFilename, setSharingFilename] = useState<string | null>(null);
  const [filenameToDelete, setFilenameToDelete] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [visibleTrackCount, setVisibleTrackCount] = useState(INITIAL_TRACKS);
  const sectionRef = useRef<HTMLElement>(null);
  const scrollToSectionAfterUpdate = useRef(false);
  const [internalFilename, setInternalFilename] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTaskIds, setSearchTaskIds] = useState<string[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [trackTypeFilter, setTrackTypeFilter] = useState<TrackTypeFilterValue>("all");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 400);
  const selectedFilename = controlledFilename !== undefined ? controlledFilename : internalFilename;
  const setSelectedFilename = onSelectFilename ?? setInternalFilename;

  const tasksEffective = personaMetadataProp ?? null;
  const personasEffective = personasProp ?? [];

  const isUploadExtendMode = selectionMode === "uploadExtend";
  const isUploadCoverMode = selectionMode === "uploadCover";
  const isAddInstrumentalMode = selectionMode === "addInstrumental";
  const isAddVocalsMode = selectionMode === "addVocals";
  const isSeparateVocalsMode = selectionMode === "separateVocals";
  const isMashupMode = selectionMode === "mashup";
  const isGetLyricsMode = selectionMode === "getLyrics";
  const isGenerateLyricsMode = selectionMode === "generateLyrics";
  const isGenerateCoverMode = selectionMode === "generateCover";
  const isCreateMusicVideoMode = selectionMode === "createMusicVideo";
  const isSharedMode = selectionMode === "shared";
  const filesToShow = useMemo(
    () => {
      if (isSharedMode) {
        return filterByTaskMetadata(savedFiles, tasksEffective).filter((f) => sharedMap[f] === true);
      }
      return isPersonaMode
          ? filterVocalTracks(savedFiles, tasksEffective)
          : isSeparateVocalsMode || isGetLyricsMode || isCreateMusicVideoMode
            ? filterVocalTracks(savedFiles, tasksEffective)
            : isGenerateLyricsMode
              ? filterByTaskMetadata(savedFiles, tasksEffective)
              : isMashupMode || isGenerateCoverMode
                ? savedFiles
                : isUploadExtendMode || isUploadCoverMode || isAddInstrumentalMode || isAddVocalsMode || isExtendMode
                  ? filterByTaskMetadata(savedFiles, tasksEffective)
                  : savedFiles;
    },
    [isSharedMode, isPersonaMode, isSeparateVocalsMode, isGetLyricsMode, isCreateMusicVideoMode, isGenerateLyricsMode, isMashupMode, isUploadExtendMode, isUploadCoverMode, isAddInstrumentalMode, isAddVocalsMode, isGenerateCoverMode, isExtendMode, savedFiles, tasksEffective, sharedMap]
  );
  const typeFilteredFiles = useMemo(
    () => filterByTrackType(filesToShow, trackTypeFilter, tasksEffective, sharedMap),
    [filesToShow, trackTypeFilter, tasksEffective, sharedMap]
  );

  const searchFilteredFiles = useMemo(() => {
    if (searchTaskIds === null) return typeFilteredFiles;
    return typeFilteredFiles.filter((filename) => {
      const parsed = parseSavedFilename(filename);
      return parsed !== null && searchTaskIds.includes(parsed.taskId);
    });
  }, [typeFilteredFiles, searchTaskIds]);
  const groups = useMemo(() => groupSavedFiles(searchFilteredFiles), [searchFilteredFiles]);
  const totalTrackCount = useMemo(() => {
    return groups.reduce((sum, g) => sum + g.files.length, 0);
  }, [groups]);
  const visibleGroups = useMemo(
    () => flattenAndRegroup(groups, visibleTrackCount),
    [groups, visibleTrackCount]
  );
  const hasMoreTracks = visibleTrackCount < totalTrackCount;

  const fetchSavedFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/audio");
      const data = await res.json();
      if (res.ok && Array.isArray(data.files)) {
        setSavedFiles(data.files);
        setSharedMap(typeof data.shared === "object" && data.shared !== null ? data.shared : {});
        setSharedAtMap(typeof data.sharedAt === "object" && data.sharedAt !== null ? data.sharedAt : {});
      }
    } catch {
      setSavedFiles([]);
      setSharedMap({});
      setSharedAtMap({});
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedFiles();
  }, [fetchSavedFiles]);

  useEffect(() => {
    const onSaved = async () => {
      setCollapsed(false);
      scrollToSectionAfterUpdate.current = true;
      await fetchSavedFiles();
    };
    window.addEventListener("audio-saved", onSaved);
    return () => window.removeEventListener("audio-saved", onSaved);
  }, [fetchSavedFiles]);

  useEffect(() => {
    if (!scrollToSectionAfterUpdate.current) return;
    scrollToSectionAfterUpdate.current = false;
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [savedFiles]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setTrackTypeFilter("all");
    }
  }, [searchQuery]);

  useEffect(() => {
    setTrackTypeFilter("all");
  }, [selectionMode]);

  useEffect(() => {
    onTrackTypeFilterChange?.(trackTypeFilter);
  }, [trackTypeFilter, onTrackTypeFilterChange]);

  useEffect(() => {
    if (!showSearch) return;
    const q = debouncedSearchQuery.trim();
    if (!q) {
      setSearchTaskIds(null);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/generate/search?q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const ids = Array.isArray(data.taskIds) ? data.taskIds : [];
        setSearchTaskIds(ids);
      } catch {
        if (!cancelled) setSearchTaskIds([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSearch, debouncedSearchQuery]);

  useEffect(() => {
    if (showSelection && searchFilteredFiles.length === 0 && onSelectFilename) {
      onSelectFilename(null);
    }
  }, [showSelection, searchFilteredFiles, onSelectFilename]);

  // Also reset selection when the selected file is no longer visible (e.g. after search filter)
  useEffect(() => {
    if (!showSelection || !controlledFilename || !onSelectFilename) return;
    if (searchFilteredFiles.length > 0 && !searchFilteredFiles.includes(controlledFilename)) {
      onSelectFilename(null);
    }
  }, [showSelection, controlledFilename, searchFilteredFiles, onSelectFilename]);

  const handleConfirmDelete = useCallback(async () => {
    const filename = filenameToDelete;
    if (!filename) return;
    setFilenameToDelete(null);
    setDeletingFilename(filename);
    try {
      const res = await fetch(`/api/audio?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSavedFiles((prev) => prev.filter((f) => f !== filename));
      }
    } finally {
      setDeletingFilename(null);
    }
  }, [filenameToDelete]);

  const openDeleteDialog = useCallback((filename: string) => {
    setFilenameToDelete(filename);
  }, []);

  const handleShareToggle = useCallback(async (filename: string) => {
    setSharingFilename(filename);
    try {
      const res = await fetch("/api/tracks/share", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (res.ok && typeof data.isShared === "boolean") {
        setSharedMap((prev) => ({ ...prev, [filename]: data.isShared }));
        setSharedAtMap((prev) => {
          const next = { ...prev };
          if (data.isShared && typeof data.sharedAt === "string") {
            next[filename] = data.sharedAt;
          } else {
            delete next[filename];
          }
          return next;
        });
      }
    } finally {
      setSharingFilename(null);
    }
  }, []);

  return (
    <section ref={sectionRef} className="mb-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex flex-1 items-center justify-center gap-2 rounded text-lg font-semibold text-gray-200 hover:text-gray-100 focus:outline-none"
          aria-expanded={!collapsed}
        >
          {sectionTitle ?? "Suno Audio Folder"}
          <span
            className={`inline-block shrink-0 text-gray-500 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
            aria-hidden
          >
            ▼
          </span>
        </button>
        {onNewGeneration && (
          <button
            type="button"
            onClick={onNewGeneration}
            className="absolute right-0 flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1a]"
            title="Reset form and start a new generation"
            aria-label="New Generation"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Generation
          </button>
        )}
      </div>
      <div className={collapsed ? "hidden" : "mt-4"}>
        {isLoadingFiles && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500"
              aria-hidden
            />
            <span>Loading tracks…</span>
          </div>
        )}
        {!isLoadingFiles && showSearch && (
          <div className="mb-4 space-y-2">
            {isSearching && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-blue-500"
                  aria-hidden
                />
                <span>Searching…</span>
              </div>
            )}
            <label htmlFor="suno-folder-search" className="sr-only">
              Search by prompt, style, title, negative tags
            </label>
            <input
              id="suno-folder-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by prompt, style, title..."
              autoComplete="off"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-[#f5f5f5] placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Search by prompt, style, title, negative tags"
            />
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {TRACK_TYPE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTrackTypeFilter(opt.value)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                    trackTypeFilter === opt.value
                      ? "bg-blue-600/30 text-blue-400"
                      : "text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-300"
                  }`}
                  title={opt.label}
                  aria-pressed={trackTypeFilter === opt.value}
                >
                  <TrackTypeFilterIcon
                    icon={opt.icon}
                    color={trackTypeFilter === opt.value ? "text-blue-400" : opt.color}
                  />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {isLoadingFiles ? null : (showSelection ? filesToShow.length === 0 : savedFiles.length === 0) ? (
          <p className="text-sm text-gray-500">
            {isPersonaMode
              ? "No tracks with vocals to select."
              : isSeparateVocalsMode
                ? "No tracks with vocals to separate. Select a track that has vocals."
                : isUploadExtendMode
                  ? "No tracks to extend."
                  : isUploadCoverMode
                    ? "No tracks to cover."
                    : isAddInstrumentalMode
                      ? "No tracks to add instrumental to."
                      : isAddVocalsMode
                        ? "No tracks to add vocals to."
                        : isMashupMode
                          ? "No tracks to select."
                          : isGetLyricsMode
                            ? "No vocal tracks to get lyrics for."
                            : isGenerateLyricsMode
                              ? "No tracks."
                              : isGenerateCoverMode
                                ? "No tracks to generate cover for."
                                : isCreateMusicVideoMode
                                  ? "No vocal tracks to create music video for."
                                  : isExtendMode
                            ? "No tracks to extend."
                            : "No saved tracks yet. Generate music and use Download to save files."}
          </p>
        ) : searchFilteredFiles.length === 0 ? (
          <p className="text-sm text-gray-500">
            {searchQuery.trim()
              ? "No tracks match your search. Try a different prompt, style, or title."
              : "No tracks match the selected filter. Try a different type."}
          </p>
        ) : (
          <div className="space-y-6">
            {visibleGroups.map(({ groupKey, group, files: groupFiles }) => {
              const isGroupCollapsed = collapsedGroups.has(groupKey);
              return (
              <div key={groupKey}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(groupKey)) next.delete(groupKey);
                      else next.add(groupKey);
                      return next;
                    })
                  }
                  className="mb-2 flex w-full items-center gap-2 rounded-md py-1 text-left text-base font-medium text-gray-200 transition-colors hover:text-gray-100 focus:outline-none"
                  aria-expanded={!isGroupCollapsed}
                  aria-controls={`group-${groupKey.replace(/[^a-z0-9]/gi, "-")}`}
                >
                  <span
                    className="shrink-0 text-gray-500 transition-transform"
                    aria-hidden
                  >
                    {isGroupCollapsed ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1">{stripStemPrefixFromTitle(group.title)}</span>
                </button>
                <ul
                  id={`group-${groupKey.replace(/[^a-z0-9]/gi, "-")}`}
                  className="space-y-3"
                  hidden={isGroupCollapsed}
                >
                  {groupFiles.map(({ filename, index }) => {
                    const parsed = parseSavedFilename(filename);
                    const taskId = parsed?.taskId ?? null;
                    const instrumental = isInstrumentalTrack(filename, tasksEffective);
                    const extended = isExtendedTrack(filename, tasksEffective);
                    const uploadExtended = isUploadExtendedTrack(filename, tasksEffective);
                    const uploadCovered = isUploadCoveredTrack(filename, tasksEffective);
                    const addInstrumental = isAddInstrumentalTrack(filename, tasksEffective);
                    const addVocals = isAddVocalsTrack(filename, tasksEffective);
                    const separateVocals = isSeparateVocalsTrack(filename, tasksEffective);
                    const mashup = isMashupTrack(filename, tasksEffective);
                    const coverGenerated = hasCoverImage(filename, tasksEffective);
                    const videoGenerated = hasVideo(filename, tasksEffective);
                    return (
                      <li
                        key={filename}
                        className="flex flex-nowrap items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4"
                      >
                        <span className="flex min-w-[7.5rem] shrink-0 items-center gap-1.5 text-sm text-gray-400">
                          {group.title === "Other" ? filename.replace(/\.mp3$/i, "") : trackLabel(index)}
                          {separateVocals &&
                            parsed &&
                            (parsed.index === 2 || parsed.title.toLowerCase().includes("instrumental") ? (
                              <span className="inline-flex shrink-0 text-amber-500" title="Instrumental" aria-label="Instrumental">
                                <InstrumentalStemIcon />
                              </span>
                            ) : (parsed.index === 1 || parsed.title.toLowerCase().includes("vocal")) ? (
                              <span className="inline-flex shrink-0 text-pink-400" title="Vocals" aria-label="Vocals">
                                <VocalsStemIcon />
                              </span>
                            ) : null)}
                          {instrumental && (
                            <span
                              className="inline-flex shrink-0 text-amber-500"
                              title="Instrumental"
                              aria-label="Instrumental"
                            >
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                              </svg>
                            </span>
                          )}
                          {extended && (
                            <span
                              className="inline-flex shrink-0 text-purple-400"
                              title="Extended"
                              aria-label="Extended"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                              </svg>
                            </span>
                          )}
                          {uploadExtended && (
                            <span
                              className="inline-flex shrink-0 text-teal-400"
                              title="Upload Extended"
                              aria-label="Upload Extended"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                            </span>
                          )}
                          {uploadCovered && (
                            <span
                              className="inline-flex shrink-0 text-sky-400"
                              title="Upload Covered"
                              aria-label="Upload Covered"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            </span>
                          )}
                          {addInstrumental && (
                            <span
                              className="inline-flex shrink-0 text-orange-300"
                              title="Add Instrumental"
                              aria-label="Add Instrumental"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </span>
                          )}
                          {addVocals && (
                            <span
                              className="inline-flex shrink-0 text-pink-400"
                              title="Add Vocals"
                              aria-label="Add Vocals"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.22.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                              </svg>
                            </span>
                          )}
                          {separateVocals && (
                            <span
                              className="inline-flex shrink-0 text-indigo-400"
                              title="Separate Vocals"
                              aria-label="Separate Vocals"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.242 4.242 3 3 0 004.242-4.242zm0-5.758a3 3 0 10-4.242 4.242 3 3 0 004.242-4.242z" />
                              </svg>
                            </span>
                          )}
                          {mashup && (
                            <span
                              className="inline-flex shrink-0 text-cyan-400"
                              title="Mashup"
                              aria-label="Mashup"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                              </svg>
                            </span>
                          )}
                          {coverGenerated && (
                            <span
                              className="inline-flex shrink-0 text-emerald-400"
                              title="Cover generated"
                              aria-label="Cover generated"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </span>
                          )}
                          {videoGenerated && (
                            <span
                              className="inline-flex shrink-0 text-blue-400"
                              title="Music video generated"
                              aria-label="Music video generated"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </span>
                          )}
                        </span>
                      <StyledAudioPlayer
                        className="min-w-[360px] flex-1"
                        src={`/api/audio/stream?filename=${encodeURIComponent(filename)}`}
                        preload="metadata"
                        downloadFilename={filename}
                        aria-label={`Play ${parsed?.title ?? filename}`}
                      />
                      {isGenerateLyricsMode || isSharedMode ? (
                        showShareButton && session?.user && (
                          <ShareButton
                            filename={filename}
                            isShared={!!sharedMap[filename]}
                            isUpdating={sharingFilename === filename}
                            onShareToggle={handleShareToggle}
                          />
                        )
                      ) : showSelection ? (
                        <>
                          {isPersonaMode && trackHasPersona(filename, tasksEffective, personasEffective) ? (
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1a1a1a] text-gray-500 opacity-60"
                              aria-label="Persona already created for this track"
                              title="Persona already created"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className={selectedFilename === filename ? SELECT_BTN_SELECTED : SELECT_BTN_UNSELECTED}
                              onClick={() => onSelectFilename?.(filename)}
                              title={selectedFilename === filename ? "Selected" : "Select this track"}
                              aria-label={selectedFilename === filename ? "Selected" : "Select this track"}
                            >
                              {selectedFilename === filename ? (
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                </svg>
                              )}
                            </button>
                          )}
                          {showShareButton && session?.user && (
                            <ShareButton
                              filename={filename}
                              isShared={!!sharedMap[filename]}
                              isUpdating={sharingFilename === filename}
                              onShareToggle={handleShareToggle}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          {showLoadFormRadio && taskId && (
                            <button
                              type="button"
                              className={selectedLoadFormFilename === filename ? SELECT_BTN_SELECTED : SELECT_BTN_UNSELECTED}
                              onClick={() => onSelectLoadFormFilename?.(filename)}
                              title={selectedLoadFormFilename === filename ? "Load form (selected)" : "Select to load form"}
                              aria-label={selectedLoadFormFilename === filename ? "Load form (selected)" : "Select to load form"}
                            >
                              {selectedLoadFormFilename === filename ? (
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                </svg>
                              )}
                            </button>
                          )}
                          {showShareButton && session?.user && (
                            <ShareButton
                              filename={filename}
                              isShared={!!sharedMap[filename]}
                              isUpdating={sharingFilename === filename}
                              onShareToggle={handleShareToggle}
                            />
                          )}
                          <button
                            type="button"
                            disabled={deletingFilename === filename}
                            onClick={() => openDeleteDialog(filename)}
                            className={DELETE_BTN_CLASS}
                            title="Delete track"
                            aria-label={deletingFilename === filename ? "Deleting…" : "Delete track"}
                          >
                            {deletingFilename === filename ? (
                              <span className="text-xs">…</span>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </>
                      )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
            })}
            {hasMoreTracks && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => setVisibleTrackCount((prev) => prev + LOAD_MORE_TRACKS)}
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

      {/* Delete dialog hidden in selection modes (no delete buttons shown) */}
      {!showSelection && (
        <ConfirmDialog
          open={filenameToDelete !== null}
          onClose={() => setFilenameToDelete(null)}
          onConfirm={handleConfirmDelete}
          title={
            filenameToDelete !== null && trackHasPersona(filenameToDelete, tasksEffective, personasEffective)
              ? "Track connected to Persona"
              : "Delete Track"
          }
          message={
            filenameToDelete !== null && trackHasPersona(filenameToDelete, tasksEffective, personasEffective)
              ? "This track is connected to a persona. Delete the persona first."
              : "Are you sure you want to delete this track? It will be removed from the audio folder."
          }
          confirmLabel="Delete"
          cancelLabel={
            filenameToDelete !== null && trackHasPersona(filenameToDelete, tasksEffective, personasEffective)
              ? "Close"
              : "Cancel"
          }
          variant={
            filenameToDelete !== null && trackHasPersona(filenameToDelete, tasksEffective, personasEffective)
              ? "default"
              : "danger"
          }
          hideConfirm={
            filenameToDelete !== null && trackHasPersona(filenameToDelete, tasksEffective, personasEffective)
          }
        />
      )}
    </section>
  );
}

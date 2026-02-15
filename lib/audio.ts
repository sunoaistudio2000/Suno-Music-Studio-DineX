import path from "path";

export const AUDIO_DIR = path.join(process.cwd(), "audio");

export function isSafeFilename(filename: string): boolean {
  if (!filename || filename.length > 200) return false;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return false;
  if (!filename.endsWith(".mp3")) return false;
  return /^[a-zA-Z0-9_.\-]+\.mp3$/.test(filename);
}

/** Validate cover image filename (taskId-cover-N.png). */
export function isSafeCoverFilename(filename: string): boolean {
  if (!filename || filename.length > 200) return false;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return false;
  if (!filename.endsWith(".png")) return false;
  return /^[a-zA-Z0-9_.\-]+\.png$/.test(filename);
}

/** Build cover filename for a given music taskId and index (1-based). */
export function getCoverFilename(taskId: string, index: number): string {
  const safe = taskId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "cover";
  return `${safe}-cover-${index}.png`;
}

/** Validate video filename (taskId-index-title.mp4). */
export function isSafeVideoFilename(filename: string): boolean {
  if (!filename || filename.length > 200) return false;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return false;
  if (!filename.endsWith(".mp4")) return false;
  return /^[a-zA-Z0-9_.\-]+\.mp4$/.test(filename);
}

/** Build video filename for a given music taskId, index (1-based), and title. */
export function getVideoFilename(taskId: string, index: number, title: string): string {
  const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "video";
  const safeTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 80) || "video";
  return `${safeTaskId}-${index}-${safeTitle}.mp4`.replace(/\s+/g, "_");
}

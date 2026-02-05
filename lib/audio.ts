import path from "path";

export const AUDIO_DIR = path.join(process.cwd(), "audio");

export function isSafeFilename(filename: string): boolean {
  if (!filename || filename.length > 200) return false;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return false;
  if (!filename.endsWith(".mp3")) return false;
  return /^[a-zA-Z0-9_.\-]+\.mp3$/.test(filename);
}

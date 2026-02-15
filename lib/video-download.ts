import { mkdir } from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { AUDIO_DIR, getVideoFilename, isSafeVideoFilename } from "@/lib/audio";

const DOWNLOAD_TIMEOUT_MS = 120_000; // 2 min for large videos

/** Download video from URL and save to audio dir. Returns saved filename or null. */
export async function downloadAndSaveVideo(
  taskId: string,
  index: number,
  title: string,
  videoUrl: string,
  apiKey?: string
): Promise<string | null> {
  if (typeof videoUrl !== "string" || !videoUrl.startsWith("http")) return null;

  const filename = getVideoFilename(taskId, index, title);
  if (!isSafeVideoFilename(filename)) return null;

  await mkdir(AUDIO_DIR, { recursive: true });
  const filePath = path.join(AUDIO_DIR, filename);

  const tryFetch = async (headers?: Record<string, string>) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(videoUrl, {
        ...(headers && Object.keys(headers).length > 0 ? { headers } : {}),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok || !res.body) return null;
      const nodeStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
      await pipeline(nodeStream, createWriteStream(filePath));
      return filename;
    } catch {
      clearTimeout(timeout);
      return null;
    }
  };

  try {
    // KIE may return a pre-signed CDN URL that rejects auth headers; try without first
    let result = await tryFetch();
    if (!result && apiKey) {
      result = await tryFetch({ Authorization: `Bearer ${apiKey}` });
    }
    return result;
  } catch {
    return null;
  }
}

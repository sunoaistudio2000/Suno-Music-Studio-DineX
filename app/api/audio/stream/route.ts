import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { readFile } from "fs/promises";
import path from "path";
import { AUDIO_DIR, isSafeFilename, isSafeCoverFilename, isSafeVideoFilename } from "@/lib/audio";
import { prisma } from "@/lib/prisma";

/** Extract taskId from cover filename (taskId-cover-N.png). */
function taskIdFromCoverFilename(filename: string): string | null {
  const match = filename.match(/^(.+)-cover-\d+\.png$/);
  return match ? match[1]! : null;
}

/** Check if the file is accessible: user owns it (auth) or it belongs to a shared track (public). */
async function isFileAccessible(
  filename: string,
  userId: string | null
): Promise<boolean> {
  const isCover = filename.endsWith(".png");
  const isVideo = filename.endsWith(".mp4");
  const isAudio = filename.endsWith(".mp3");

  if (isAudio) {
    const track = await prisma.track.findFirst({
      where: { localFilename: filename },
      select: { id: true, isShared: true, generation: { select: { userId: true } } },
    });
    if (!track) return false;
    if (track.isShared) return true;
    return userId !== null && track.generation?.userId === userId;
  }

  if (isVideo) {
    const track = await prisma.track.findFirst({
      where: { videoFilename: filename },
      select: { id: true, isShared: true, generation: { select: { userId: true } } },
    });
    if (!track) return false;
    if (track.isShared) return true;
    return userId !== null && track.generation?.userId === userId;
  }

  if (isCover) {
    const taskId = taskIdFromCoverFilename(filename);
    if (!taskId) return false;
    // Multiple tracks can share the same taskId (e.g. 2 songs per generation). Allow access if ANY
    // track with this taskId is shared or owned by the user.
    const tracks = await prisma.track.findMany({
      where: { taskId },
      select: { isShared: true, generation: { select: { userId: true } } },
    });
    if (tracks.length === 0) return false;
    const anyShared = tracks.some((t) => t.isShared);
    if (anyShared) return true;
    return userId !== null && tracks.some((t) => t.generation?.userId === userId);
  }

  return false;
}

/** Parse Range header "bytes=start-end" or "bytes=start-". Returns { start, end } or null. */
function parseRange(rangeHeader: string | null, totalLength: number): { start: number; end: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;
  const part = rangeHeader.slice(6).trim();
  const dash = part.indexOf("-");
  if (dash < 0) return null;
  const startStr = part.slice(0, dash);
  const endStr = part.slice(dash + 1);
  const start = startStr ? parseInt(startStr, 10) : 0;
  const end = endStr ? parseInt(endStr, 10) : totalLength - 1;
  if (Number.isNaN(start) || start < 0 || start > totalLength - 1) return null;
  const endClamped = Number.isNaN(end) || end >= totalLength ? totalLength - 1 : end;
  if (endClamped < start) return null;
  return { start, end: endClamped };
}

export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get("filename");
  if (!filename || (!isSafeFilename(filename) && !isSafeCoverFilename(filename) && !isSafeVideoFilename(filename))) {
    return NextResponse.json({ error: "Invalid or missing filename" }, { status: 400 });
  }

  const filePath = path.join(AUDIO_DIR, filename);
  if (!filePath.startsWith(AUDIO_DIR)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const accessible = await isFileAccessible(filename, token?.sub ?? null);
  if (!accessible) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isCover = filename.endsWith(".png");
  const isVideo = filename.endsWith(".mp4");
  const contentType = isCover ? "image/png" : isVideo ? "video/mp4" : "audio/mpeg";

  try {
    const buffer = await readFile(filePath);
    const totalLength = buffer.length;
    const range = parseRange(request.headers.get("Range"), totalLength);
    const baseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    };

    if (range) {
      const { start, end } = range;
      const slice = buffer.subarray(start, end + 1);
      return new NextResponse(slice, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${totalLength}`,
          "Content-Length": String(slice.length),
        },
      });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": String(totalLength),
      },
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}

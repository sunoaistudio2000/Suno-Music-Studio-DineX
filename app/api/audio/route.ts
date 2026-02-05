import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { AUDIO_DIR, isSafeFilename } from "@/lib/audio";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tracks = await prisma.track.findMany({
      where: { localFilename: { not: null } },
      select: { localFilename: true },
      orderBy: { createdAt: "desc" },
    });
    const files = tracks
      .map((t: { localFilename: string | null }) => t.localFilename)
      .filter((f: string | null): f is string => typeof f === "string" && f.length > 0);
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json({ error: "Failed to list tracks" }, { status: 500 });
  }
}

async function deleteTracksAndOrphanGenerations(filename: string): Promise<void> {
  const tracksToDelete = await prisma.track.findMany({
    where: { localFilename: filename },
    select: { generationId: true },
  });
  const generationIds = Array.from(
    new Set(
      (tracksToDelete as { generationId: string | null }[])
        .map((t) => t.generationId)
        .filter((id): id is string => id != null)
    )
  );
  await prisma.track.deleteMany({ where: { localFilename: filename } });
  for (const generationId of generationIds) {
    const remaining = await prisma.track.count({ where: { generationId } });
    if (remaining === 0) {
      await prisma.generation.deleteMany({ where: { id: generationId } });
    }
  }
}

export async function DELETE(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get("filename");
  if (!filename || !isSafeFilename(filename)) {
    return NextResponse.json({ error: "Invalid or missing filename" }, { status: 400 });
  }

  const filePath = path.join(AUDIO_DIR, filename);
  if (!filePath.startsWith(AUDIO_DIR)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    await unlink(filePath).catch(() => {});
    await deleteTracksAndOrphanGenerations(filename);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      await deleteTracksAndOrphanGenerations(filename);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}

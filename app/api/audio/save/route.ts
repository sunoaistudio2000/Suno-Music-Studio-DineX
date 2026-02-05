import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { AUDIO_DIR } from "@/lib/audio";
import { prisma } from "@/lib/prisma";

type SaveTrack = { audioUrl: string; title: string; id?: string };

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in to save tracks" }, { status: 401 });
  }

  const apiKey = process.env.KIE_API_KEY;
  let body: { taskId?: string; tracks?: SaveTrack[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskId = "unknown", tracks: rawTracks = [] } = body;
  const safeTaskId = String(taskId).replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 64) || "unknown";

  if (!Array.isArray(rawTracks) || rawTracks.length === 0) {
    return NextResponse.json({ saved: 0 });
  }

  const tracks = rawTracks.filter(
    (t): t is SaveTrack =>
      t &&
      typeof t === "object" &&
      typeof t.audioUrl === "string" &&
      t.audioUrl.startsWith("http") &&
      typeof t.title === "string"
  );

  await mkdir(AUDIO_DIR, { recursive: true });

  // Find the generation for this taskId to link tracks
  const generation = await prisma.generation.findFirst({
    where: { taskId: safeTaskId },
    orderBy: { createdAt: "desc" },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 15);

  let saved = 0;
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    try {
      const res = await fetch(track.audioUrl, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      });
      if (!res.ok) continue;
      const buffer = await res.arrayBuffer();
      const safeTitle = track.title.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 80) || "track";
      const filename = `${safeTaskId}-${i + 1}-${safeTitle}.mp3`.replace(/\s+/g, "_");
      const filePath = path.join(AUDIO_DIR, filename);
      await writeFile(filePath, Buffer.from(buffer));

      const existing = await prisma.track.findFirst({
        where: { taskId: safeTaskId, index: i + 1 },
      });
      if (existing) {
        await prisma.track.update({
          where: { id: existing.id },
          data: {
            audioUrl: track.audioUrl,
            expiresAt,
            title: track.title,
            audioId: typeof track.id === "string" && track.id ? track.id : undefined,
            localFilename: filename,
            generationId: generation?.id ?? existing.generationId,
          },
        });
      } else {
        await prisma.track.create({
          data: {
            taskId: safeTaskId,
            generationId: generation?.id,
            audioId: typeof track.id === "string" && track.id ? track.id : undefined,
            title: track.title,
            index: i + 1,
            audioUrl: track.audioUrl,
            expiresAt,
            localFilename: filename,
          },
        });
      }
      saved++;
    } catch {
      // skip failed track
    }
  }

  return NextResponse.json({ saved });
}

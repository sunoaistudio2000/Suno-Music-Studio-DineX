import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isSafeFilename } from "@/lib/audio";
import { prisma } from "@/lib/prisma";

/** PATCH /api/tracks/share-cover - Set which cover index to show when track is shared. */
export async function PATCH(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: { filename?: string; coverIndex?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  if (!filename || !isSafeFilename(filename)) {
    return NextResponse.json({ error: "Invalid or missing filename" }, { status: 400 });
  }

  const coverIndex = typeof body.coverIndex === "number" ? Math.max(0, Math.floor(body.coverIndex)) : 0;

  const track = await prisma.track.findFirst({
    where: { localFilename: filename },
    select: { id: true, generationId: true, generation: { select: { userId: true, coverImages: true } } },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  if (track.generation?.userId !== token.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const maxIndex = (track.generation?.coverImages?.length ?? 1) - 1;
  const clampedIndex = Math.min(coverIndex, maxIndex);

  await prisma.track.update({
    where: { id: track.id },
    data: { sharedCoverIndex: clampedIndex },
  });

  return NextResponse.json({ sharedCoverIndex: clampedIndex });
}

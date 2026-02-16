import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isSafeFilename } from "@/lib/audio";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in to share tracks" }, { status: 401 });
  }

  let body: { filename?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  if (!filename || !isSafeFilename(filename)) {
    return NextResponse.json({ error: "Invalid or missing filename" }, { status: 400 });
  }

  const track = await prisma.track.findFirst({
    where: { localFilename: filename },
    select: { id: true, isShared: true, generationId: true, generation: { select: { userId: true } } },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  if (!track.generationId || !track.generation) {
    return NextResponse.json({ error: "Cannot share track without owner" }, { status: 403 });
  }

  if (track.generation.userId !== token.sub) {
    return NextResponse.json({ error: "You can only share your own tracks" }, { status: 403 });
  }

  const newIsShared = !track.isShared;
  const sharedAt = newIsShared ? new Date() : null;
  await prisma.track.update({
    where: { id: track.id },
    data: {
      isShared: newIsShared,
      sharedAt,
    },
  });

  return NextResponse.json({
    isShared: newIsShared,
    sharedAt: sharedAt?.toISOString() ?? null,
  });
}

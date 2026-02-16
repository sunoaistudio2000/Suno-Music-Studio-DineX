import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isSafeFilename } from "@/lib/audio";
import { prisma } from "@/lib/prisma";

/** GET /api/tracks/cover-status?filename=... - Get isShared and sharedCoverIndex for a track. */
export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const filename = request.nextUrl.searchParams.get("filename");
  if (!filename || !isSafeFilename(filename)) {
    return NextResponse.json({ error: "Invalid or missing filename" }, { status: 400 });
  }

  const track = await prisma.track.findFirst({
    where: { localFilename: filename },
    select: {
      isShared: true,
      sharedCoverIndex: true,
      generationId: true,
      generation: { select: { userId: true } },
    },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  if (track.generation?.userId !== token.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    isShared: track.isShared ?? false,
    sharedCoverIndex: track.sharedCoverIndex ?? 0,
  });
}

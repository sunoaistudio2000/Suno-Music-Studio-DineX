import { existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { AUDIO_DIR } from "@/lib/audio";
import { findTrackForVideoCheck } from "@/lib/video";

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const musicTaskId = request.nextUrl.searchParams.get("taskId") ?? undefined;
  const audioId = request.nextUrl.searchParams.get("audioId") ?? undefined;
  const indexParam = request.nextUrl.searchParams.get("index");
  const index = indexParam ? parseInt(indexParam, 10) : undefined;
  const filename = request.nextUrl.searchParams.get("filename") ?? undefined;

  const result = await findTrackForVideoCheck({
    musicTaskId,
    audioId,
    index,
    filename,
  });

  if (!result || result.track.generation?.userId !== token.sub) {
    return NextResponse.json({ hasVideo: false });
  }

  const { track, videoFilename } = result;
  const filePath = path.join(AUDIO_DIR, videoFilename);
  const hasVideo = existsSync(filePath);

  if (!hasVideo) {
    return NextResponse.json({
      hasVideo: false,
      videoTaskId: track.videoTaskId ?? undefined,
    });
  }

  return NextResponse.json({
    hasVideo: true,
    videoFilename,
    videoTaskId: track.videoTaskId ?? undefined,
  });
}

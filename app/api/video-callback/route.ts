import { NextRequest, NextResponse } from "next/server";
import { saveVideoAndUpdateTrack, clearTrackVideo } from "@/lib/video";

/** Handle music video generation completion callback from kie.ai.
 * Returns 200 immediately per docs (15s timeout), then processes async.
 * See https://docs.kie.ai/suno-api/create-music-video-callbacks */
export async function POST(request: NextRequest) {
  let body: { code?: number; msg?: string; data?: { task_id?: string; video_url?: string | null } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "received" }, { status: 200 });
  }

  const { code, data } = body;
  const videoTaskId = data?.task_id;
  if (!videoTaskId || typeof videoTaskId !== "string") {
    return NextResponse.json({ status: "received" }, { status: 200 });
  }

  if (code === 200 && data?.video_url) {
    const apiKey = process.env.KIE_API_KEY;
    if (apiKey) void saveVideoAndUpdateTrack(videoTaskId, data.video_url, apiKey);
    return NextResponse.json({ status: "received" }, { status: 200 });
  }

  if (code === 500) void clearTrackVideo(videoTaskId);
  return NextResponse.json({ status: "received" }, { status: 200 });
}

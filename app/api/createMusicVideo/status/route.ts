import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseKieResponse } from "@/lib/api-error";
import { findTrackByVideoTaskId, saveVideoAndUpdateTrack } from "@/lib/video";

const KIE_BASE = "https://api.kie.ai/api/v1";

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KIE_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const videoTaskId = request.nextUrl.searchParams.get("taskId");
  if (!videoTaskId?.trim()) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const res = await fetch(
    `${KIE_BASE}/mp4/record-info?taskId=${encodeURIComponent(videoTaskId.trim())}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  const parsed = parseKieResponse(res, data);
  if (parsed.isError) {
    return NextResponse.json(
      { error: parsed.errorMessage, code: parsed.apiCode },
      { status: parsed.status }
    );
  }

  const apiData =
    data?.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : null;
  const response =
    apiData?.response && typeof apiData.response === "object"
      ? (apiData.response as Record<string, unknown>)
      : null;

  // Per https://docs.kie.ai/suno-api/get-music-video-details: videoUrl in data.response, successFlag at data level
  const videoUrl = typeof response?.videoUrl === "string" ? response.videoUrl : null;
  const successFlag =
    typeof apiData?.successFlag === "string"
      ? apiData.successFlag
      : String(apiData?.successFlag ?? response?.successFlag ?? "");

  // KIE may return "SUCCESS-Success", "PENDING-Waiting for execution", etc.
  const isSuccess = successFlag.includes("SUCCESS") || successFlag === "1";
  const isFailed =
    successFlag.includes("CREATE_TASK_FAILED") ||
    successFlag.includes("GENERATE_MP4_FAILED") ||
    successFlag.includes("FAILED") ||
    successFlag === "3";

  let savedVideoFilename: string | null = null;
  if (isSuccess) {
    const track = await findTrackByVideoTaskId(videoTaskId.trim());
    if (track && track.generation?.userId === token.sub) {
      if (track.videoFilename) {
        savedVideoFilename = track.videoFilename;
      } else if (videoUrl) {
        try {
          savedVideoFilename = await saveVideoAndUpdateTrack(
            videoTaskId.trim(),
            videoUrl,
            apiKey
          );
        } catch {
          // Continue - callback may have already processed
        }
      }
    }
  }

  const status = isSuccess
    ? "SUCCESS"
    : isFailed
      ? "FAILED"
      : successFlag.includes("2") || successFlag.includes("GENERATING")
        ? "GENERATING"
        : "PENDING";

  return NextResponse.json({
    status,
    videoUrl: videoUrl ?? undefined,
    videoFilename: savedVideoFilename ?? undefined,
  });
}

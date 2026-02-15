import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseKieResponse } from "@/lib/api-error";
import { getVideoCallbackUrl } from "@/lib/api-callback";
import { validateRequired } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

const KIE_BASE = "https://api.kie.ai/api/v1";

export type CreateMusicVideoBody = {
  taskId: string;
  audioId: string;
  author?: string;
  domainName?: string;
};

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json(
      { error: "Sign in to create music video" },
      { status: 401 }
    );
  }

  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KIE_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: CreateMusicVideoBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const validationError = validateRequired(body, ["taskId", "audioId"], "taskId and audioId are required");
  if (validationError) return validationError;

  const musicTaskId = (body.taskId ?? "").trim();
  const audioId = (body.audioId ?? "").trim();
  const author = (body.author ?? "").trim().slice(0, 50) || undefined;
  const domainName = (body.domainName ?? "").trim().slice(0, 50) || undefined;
  if (!musicTaskId || !audioId) {
    return NextResponse.json(
      { error: "taskId and audioId are required" },
      { status: 400 }
    );
  }

  // Verify user owns the track (via Generation or Track.generation)
  const track = await prisma.track.findFirst({
    where: { taskId: musicTaskId, audioId },
    include: { generation: true },
  });
  if (!track) {
    return NextResponse.json(
      { error: "Track not found" },
      { status: 404 }
    );
  }
  if (track.generation?.userId !== token.sub) {
    return NextResponse.json(
      { error: "Access denied" },
      { status: 404 }
    );
  }

  const res = await fetch(`${KIE_BASE}/mp4/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId: musicTaskId,
      audioId,
      callBackUrl: getVideoCallbackUrl(),
      ...(author && { author }),
      ...(domainName && { domainName }),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  const parsed = parseKieResponse(res, data);
  if (parsed.isError) {
    return NextResponse.json(
      { error: parsed.errorMessage, code: parsed.apiCode },
      { status: parsed.status }
    );
  }

  const videoTaskId =
    data?.data &&
    typeof data.data === "object" &&
    data.data !== null &&
    "taskId" in data.data
      ? (data.data as { taskId?: string }).taskId
      : undefined;

  if (!videoTaskId) {
    return NextResponse.json(
      { error: "No video taskId in response", code: parsed.apiCode },
      { status: 502 }
    );
  }

  await prisma.track.update({
    where: { id: track.id },
    data: { videoTaskId },
  });

  return NextResponse.json({ videoTaskId });
}

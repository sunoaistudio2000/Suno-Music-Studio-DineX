import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const KIE_BASE = "https://api.kie.ai/api/v1";

const FAILED_STATUSES = [
  "ERROR",
  "CREATE_TASK_FAILED",
  "GENERATE_AUDIO_FAILED",
  "CALLBACK_EXCEPTION",
  "SENSITIVE_WORD_ERROR",
];

const COMPLETED_STATUS = "COMPLETED";
const SUCCESS_STATUS = "SUCCESS";

export async function GET(request: NextRequest) {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KIE_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json(
      { error: "taskId is required" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${KIE_BASE}/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json(
      { error: data.msg || data.error || "KIE API error", code: data.code },
      { status: res.status >= 400 ? res.status : 502 }
    );
  }

  const status = data?.data?.status ?? data?.status;
  const tracksFromApi = (data?.data?.tracks ?? data?.tracks) as
    | { id?: string; audioUrl?: string; title?: string }[]
    | undefined;
  /** KIE docs: complete = all tracks done; we also accept COMPLETED, SUCCESS */
  const isCompleted =
    status === COMPLETED_STATUS ||
    status === SUCCESS_STATUS ||
    (typeof status === "string" && status.toLowerCase() === "complete");
  const isFinal =
    isCompleted ||
    (typeof status === "string" && FAILED_STATUSES.includes(status));

  if (isFinal && Array.isArray(tracksFromApi) && tracksFromApi.length > 0) {
    const generation = await prisma.generation.findFirst({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });
    if (generation) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);
      for (let i = 0; i < tracksFromApi.length; i++) {
        const t = tracksFromApi[i];
        const title = typeof t?.title === "string" ? t.title : `Track ${i + 1}`;
        const audioUrl = typeof t?.audioUrl === "string" ? t.audioUrl : null;
        const audioId = typeof t?.id === "string" ? t.id : null;
        const index = i + 1;
        const existing = await prisma.track.findFirst({
          where: { taskId, index },
        });
        if (existing) {
          await prisma.track.update({
            where: { id: existing.id },
            data: { audioUrl, expiresAt, title, audioId },
          });
        } else {
          await prisma.track.create({
            data: {
              generationId: generation.id,
              taskId,
              audioId,
              title,
              index,
              audioUrl,
              expiresAt,
            },
          });
        }
      }
    }
  }

  return NextResponse.json(data);
}

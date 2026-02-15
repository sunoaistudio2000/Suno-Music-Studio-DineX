import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadAndSaveCoverImages } from "@/lib/cover-images";

const KIE_BASE = "https://api.kie.ai/api/v1";

/** Handle cover generation completion callback from kie.ai.
 * Returns 200 immediately per docs (15s timeout), then processes async. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "received" }, { status: 200 });
  }

  const code = body?.code;
  const data = body?.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : null;
  if (code !== 200 || !data) {
    return NextResponse.json({ status: "received" }, { status: 200 });
  }

  // KIE may send taskId or task_id
  const coverTaskId = (typeof data.taskId === "string" ? data.taskId : null) ?? (typeof data.task_id === "string" ? data.task_id : null);
  if (!coverTaskId) {
    return NextResponse.json({ status: "received" }, { status: 200 });
  }

  // KIE sends images as array of URLs
  let images: string[] = Array.isArray(data.images)
    ? (data.images as unknown[]).filter((u): u is string => typeof u === "string" && u.startsWith("http"))
    : [];
  if (images.length === 0) {
    return NextResponse.json({ status: "received" }, { status: 200 });
  }

  // Return 200 immediately to avoid 15s timeout; process async
  void processCoverCallback(coverTaskId, images);
  return NextResponse.json({ status: "received" }, { status: 200 });
}

async function processCoverCallback(coverTaskId: string, images: string[]): Promise<void> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) return;

  try {
    // First try: find Generation by coverTaskId (we store it when creating - most reliable)
    let generation = await prisma.generation.findFirst({
      where: { coverTaskId },
      orderBy: { createdAt: "desc" },
      select: { id: true, taskId: true },
    });
    let parentTaskId = generation?.taskId ?? null;

    // Fallback: fetch record-info for parentTaskId (KIE may not return it or use different field)
    if (!generation) {
      const res = await fetch(
        `${KIE_BASE}/suno/cover/record-info?taskId=${encodeURIComponent(coverTaskId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      const infoData = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const apiData = infoData?.data && typeof infoData.data === "object" ? (infoData.data as Record<string, unknown>) : null;
      parentTaskId = (typeof apiData?.parentTaskId === "string" ? apiData.parentTaskId : null) ?? (typeof apiData?.parent_task_id === "string" ? apiData.parent_task_id : null);

      if (parentTaskId) {
        generation = await prisma.generation.findFirst({
          where: { taskId: parentTaskId },
          orderBy: { createdAt: "desc" },
          select: { id: true, taskId: true },
        });
      }
    }

    if (!generation || !parentTaskId) return;

    const coverFilenames = await downloadAndSaveCoverImages(parentTaskId, images, apiKey);
    if (coverFilenames.length > 0) {
      await prisma.generation.update({
        where: { id: generation.id },
        data: { coverTaskId, coverImages: coverFilenames },
      });
    }
  } catch {
    // ignore
  }
}

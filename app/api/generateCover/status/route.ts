import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { parseKieResponse } from "@/lib/api-error";
import { downloadAndSaveCoverImages } from "@/lib/cover-images";
import { resolveCoverImages } from "@/lib/audio";

const KIE_BASE = "https://api.kie.ai/api/v1";

const SUCCESS_FLAG = 1;

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

  const coverTaskId = request.nextUrl.searchParams.get("taskId");
  if (!coverTaskId?.trim()) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const res = await fetch(
    `${KIE_BASE}/suno/cover/record-info?taskId=${encodeURIComponent(coverTaskId.trim())}`,
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

  // Parse KIE response: { code, msg, data: { taskId, parentTaskId, response: { images, successFlag } } }
  const apiData =
    (data?.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : null) ??
    (typeof data === "object" && data !== null && "parentTaskId" in data ? (data as Record<string, unknown>) : null);
  const response = apiData?.response && typeof apiData.response === "object" ? (apiData.response as Record<string, unknown>) : null;

  // successFlag: 0=Pending, 1=Success, 2=Generating, 3=Failed
  let successFlag = typeof response?.successFlag === "number" ? response.successFlag : 0;
  if (successFlag === 0) {
    const altFlag = typeof apiData?.successFlag === "number" ? apiData.successFlag : undefined;
    if (altFlag !== undefined) successFlag = altFlag;
  }

  // images can be in data.response.images or data.images
  let images = Array.isArray(response?.images) ? (response.images as string[]) : [];
  if (images.length === 0 && Array.isArray(apiData?.images)) {
    images = apiData.images as string[];
  }
  if (images.length === 0 && Array.isArray(data?.images)) {
    images = data.images as string[];
  }

  let parentTaskId = typeof apiData?.parentTaskId === "string" ? apiData.parentTaskId : null;
  if (typeof apiData?.parent_task_id === "string") parentTaskId = apiData.parent_task_id;

  // Also treat status string "SUCCESS" as success (some APIs return this)
  const statusStr = (typeof apiData?.status === "string" ? apiData.status : null) ?? (typeof data?.status === "string" ? data.status : null);
  const isSuccessByStatus = statusStr === "SUCCESS" || statusStr === "COMPLETED";

  let savedCoverImages: string[] = [];
  const isSuccess = successFlag === SUCCESS_FLAG || isSuccessByStatus;
  if (isSuccess && images.length > 0) {
    let generation = parentTaskId
      ? await prisma.generation.findFirst({
          where: { userId: token.sub, taskId: parentTaskId },
          orderBy: { createdAt: "desc" },
        })
      : null;

    // Fallback: find Generation by coverTaskId (we store it when creating)
    if (!generation) {
      generation = await prisma.generation.findFirst({
        where: { userId: token.sub, coverTaskId: coverTaskId.trim() },
        orderBy: { createdAt: "desc" },
      });
      if (generation) parentTaskId = generation.taskId;
    }

    if (generation && parentTaskId) {
      try {
        savedCoverImages = await downloadAndSaveCoverImages(parentTaskId, images, apiKey);
        if (savedCoverImages.length > 0) {
          await prisma.generation.update({
            where: { id: generation.id },
            data: { coverTaskId: coverTaskId.trim(), coverImages: savedCoverImages },
          });
        }
      } catch(e) {
        console.error("Error downloading and saving cover images", e);
        // Continue - we still return the API data; images may be in DB from callback
      }
    }
  }

  const status =
    isSuccess ? "SUCCESS" : successFlag === 3 ? "FAILED" : successFlag === 2 ? "GENERATING" : "PENDING";

  const resolvedCovers = parentTaskId
    ? resolveCoverImages(parentTaskId, savedCoverImages.length > 0 ? savedCoverImages : undefined)
    : savedCoverImages;

  return NextResponse.json({
    successFlag,
    images,
    coverImages: resolvedCovers.length > 0 ? resolvedCovers : undefined,
    parentTaskId,
    status,
  });
}

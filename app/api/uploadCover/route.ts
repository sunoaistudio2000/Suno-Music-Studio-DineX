import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseKieResponse } from "@/lib/api-error";
import { validateRequired } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

const KIE_BASE = "https://api.kie.ai/api/v1";

export type UploadCoverBody = {
  uploadUrl: string;
  customMode: boolean;
  instrumental: boolean;
  model?: string;
  prompt?: string;
  style?: string;
  title?: string;
  negativeTags?: string;
  vocalGender?: "m" | "f" | "d";
  personaId?: string;
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
};

function getCallbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/suno-callback`;
}

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json(
      { error: "Sign in to cover music" },
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

  let body: UploadCoverBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const {
    uploadUrl,
    customMode,
    instrumental,
    model = "V4",
    prompt,
    style,
    title,
    negativeTags,
    vocalGender,
    personaId,
    styleWeight,
    weirdnessConstraint,
    audioWeight,
  } = body;

  const uploadUrlError = validateRequired(body, ["uploadUrl"]);
  if (uploadUrlError) return uploadUrlError;

  if (customMode) {
    const customError = instrumental
      ? validateRequired(body, ["style", "title"], "In custom instrumental mode, style and title are required")
      : validateRequired(body, ["prompt", "style", "title"], "In custom mode, prompt, style, and title are required");
    if (customError) return customError;
  }

  const payload: Record<string, unknown> = {
    uploadUrl: uploadUrl.trim(),
    customMode,
    instrumental,
    model,
    callBackUrl: getCallbackUrl(),
  };

  if (prompt?.trim()) {
    payload.prompt = prompt.trim();
  }
  if (customMode) {
    payload.style = style;
    payload.title = title;
  }
  if (negativeTags !== undefined && negativeTags !== "")
    payload.negativeTags = negativeTags;
  if (vocalGender) payload.vocalGender = vocalGender;
  if (personaId?.trim()) payload.personaId = personaId.trim();
  if (typeof styleWeight === "number") payload.styleWeight = styleWeight;
  if (typeof weirdnessConstraint === "number")
    payload.weirdnessConstraint = weirdnessConstraint;
  if (typeof audioWeight === "number") payload.audioWeight = audioWeight;

  const res = await fetch(`${KIE_BASE}/generate/upload-cover`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  const parsed = parseKieResponse(res, data);
  if (parsed.isError) {
    return NextResponse.json(
      { error: parsed.errorMessage, code: parsed.apiCode },
      { status: parsed.status }
    );
  }

  const apiCode = parsed.apiCode;
  const taskId =
    data?.data &&
    typeof data.data === "object" &&
    data.data !== null &&
    "taskId" in data.data
      ? (data.data as { taskId?: string }).taskId
      : undefined;
  if (!taskId) {
    return NextResponse.json(
      { error: "No taskId in response", code: apiCode },
      { status: 502 }
    );
  }

  await prisma.generation.create({
    data: {
      userId: token.sub,
      taskId,
      prompt: prompt?.trim() ?? "",
      customMode,
      instrumental,
      model,
      title: customMode ? (title ?? null) : null,
      style: customMode ? (style ?? null) : null,
      negativeTags: customMode ? (negativeTags ?? null) : null,
      vocalGender: customMode ? (vocalGender ?? null) : null,
      personaId: customMode ? (personaId?.trim() ?? null) : null,
      styleWeight: customMode ? (styleWeight ?? null) : null,
      weirdnessConstraint:
        customMode ? (weirdnessConstraint ?? null) : null,
      audioWeight: customMode ? (audioWeight ?? null) : null,
      isExtension: true,
      uploadUrl: uploadUrl.trim(),
      isUploadCover: true,
    },
  });

  return NextResponse.json({ taskId });
}

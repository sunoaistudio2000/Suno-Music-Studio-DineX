import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseKieResponse } from "@/lib/api-error";
import { getCallbackUrl } from "@/lib/api-callback";
import { validateRequired } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

const KIE_BASE = "https://api.kie.ai/api/v1";

export type MashupBody = {
  uploadUrlList: string[];
  customMode: boolean;
  instrumental: boolean;
  model?: string;
  prompt?: string;
  style?: string;
  title?: string;
  vocalGender?: "m" | "f" | "d";
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
};

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json(
      { error: "Sign in to create mashup" },
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

  let body: MashupBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const {
    uploadUrlList,
    customMode,
    instrumental,
    model = "V4",
    prompt,
    style,
    title,
    vocalGender,
    styleWeight,
    weirdnessConstraint,
    audioWeight,
  } = body;

  const uploadListError = validateRequired(body, ["uploadUrlList"], "uploadUrlList is required");
  if (uploadListError) return uploadListError;

  if (!Array.isArray(uploadUrlList) || uploadUrlList.length !== 2) {
    return NextResponse.json(
      { error: "uploadUrlList must contain exactly 2 audio file URLs" },
      { status: 422 }
    );
  }
  const urls = uploadUrlList.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
  if (urls.length !== 2) {
    return NextResponse.json(
      { error: "uploadUrlList must contain exactly 2 valid URLs" },
      { status: 422 }
    );
  }

  if (customMode) {
    const customError = instrumental
      ? validateRequired(body, ["style", "title"], "In custom instrumental mode, style and title are required")
      : validateRequired(body, ["prompt", "style", "title"], "In custom mode, prompt, style, and title are required");
    if (customError) return customError;
  } else {
    const promptError = validateRequired(body, ["prompt"], "Prompt is required in non-custom mode");
    if (promptError) return promptError;
  }

  const payload: Record<string, unknown> = {
    uploadUrlList: urls.map((u) => u.trim()),
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
  if (vocalGender) payload.vocalGender = vocalGender;
  if (typeof styleWeight === "number") payload.styleWeight = styleWeight;
  if (typeof weirdnessConstraint === "number") payload.weirdnessConstraint = weirdnessConstraint;
  if (typeof audioWeight === "number") payload.audioWeight = audioWeight;

  const res = await fetch(`${KIE_BASE}/generate/mashup`, {
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
      prompt: prompt?.trim() ?? (customMode && instrumental ? "Instrumental" : ""),
      customMode,
      instrumental,
      model,
      title: customMode ? (title ?? null) : null,
      style: customMode ? (style ?? null) : null,
      vocalGender: customMode ? (vocalGender ?? null) : null,
      styleWeight: customMode ? (styleWeight ?? null) : null,
      weirdnessConstraint: customMode ? (weirdnessConstraint ?? null) : null,
      audioWeight: customMode ? (audioWeight ?? null) : null,
      isExtension: false,
      isMashup: true,
    },
  });

  return NextResponse.json({ taskId });
}

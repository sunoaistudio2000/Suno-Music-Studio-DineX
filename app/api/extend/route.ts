import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseKieResponse } from "@/lib/api-error";
import { getCallbackUrl } from "@/lib/api-callback";
import { validateRequired } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

const KIE_BASE = "https://api.kie.ai/api/v1";

export type ExtendBody = {
  audioId: string;
  defaultParamFlag: boolean;
  instrumental?: boolean;
  model?: string;
  prompt?: string;
  style?: string;
  title?: string;
  continueAt?: number;
  negativeTags?: string;
  vocalGender?: "m" | "f" | "d";
  personaId?: string;
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
    return NextResponse.json({ error: "Sign in to extend music" }, { status: 401 });
  }

  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KIE_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: ExtendBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const {
    audioId,
    defaultParamFlag,
    instrumental = false,
    model = "V4",
    prompt,
    style,
    title,
    continueAt,
    negativeTags,
    vocalGender,
    personaId,
    styleWeight,
    weirdnessConstraint,
    audioWeight,
  } = body;

  const audioIdError = validateRequired(body, ["audioId"]);
  if (audioIdError) return audioIdError;

  if (defaultParamFlag) {
    const customError = validateRequired(body, ["style", "title"], "In custom mode, style, title, and continueAt are required");
    if (customError) return customError;
    if (continueAt == null || continueAt <= 0) {
      return NextResponse.json(
        { error: "In custom mode, style, title, and continueAt are required" },
        { status: 422 }
      );
    }
    if (!instrumental) {
      const promptError = validateRequired(body, ["prompt"], "In custom mode with vocals, prompt is required");
      if (promptError) return promptError;
    }
  }

  // When custom params are off, look up the source track's model from the database
  let effectiveModel = model;
  if (!defaultParamFlag) {
    const sourceTrack = await prisma.track.findFirst({
      where: { audioId: audioId.trim() },
      select: { generation: { select: { model: true } } },
    });
    effectiveModel = sourceTrack?.generation?.model || "V4";
  }

  const payload: Record<string, unknown> = {
    audioId: audioId.trim(),
    defaultParamFlag,
    instrumental,
    model: effectiveModel,
    callBackUrl: getCallbackUrl(),
    prompt: prompt?.trim() ?? "",
  };

  if (defaultParamFlag) {
    payload.style = style;
    payload.title = title;
    payload.continueAt = continueAt;
  }
  if (negativeTags !== undefined && negativeTags !== "") payload.negativeTags = negativeTags;
  if (vocalGender) payload.vocalGender = vocalGender;
  if (personaId?.trim()) payload.personaId = personaId.trim();
  if (typeof styleWeight === "number") payload.styleWeight = styleWeight;
  if (typeof weirdnessConstraint === "number") payload.weirdnessConstraint = weirdnessConstraint;
  if (typeof audioWeight === "number") payload.audioWeight = audioWeight;

  const res = await fetch(`${KIE_BASE}/generate/extend`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;

  const parsed = parseKieResponse(res, data);
  if (parsed.isError) {
    return NextResponse.json(
      { error: parsed.errorMessage, code: parsed.apiCode },
      { status: parsed.status }
    );
  }

  const apiCode = parsed.apiCode;
  const taskId = data?.data && typeof data.data === "object" && data.data !== null && "taskId" in data.data
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
      customMode: false,
      instrumental,
      model: effectiveModel,
      title: defaultParamFlag ? (title ?? null) : null,
      style: defaultParamFlag ? (style ?? null) : null,
      negativeTags: defaultParamFlag ? (negativeTags ?? null) : null,
      vocalGender: defaultParamFlag ? (vocalGender ?? null) : null,
      personaId: defaultParamFlag ? (personaId?.trim() ?? null) : null,
      styleWeight: defaultParamFlag ? (styleWeight ?? null) : null,
      weirdnessConstraint: defaultParamFlag ? (weirdnessConstraint ?? null) : null,
      audioWeight: defaultParamFlag ? (audioWeight ?? null) : null,
      // Extension-specific fields
      isExtension: true,
      sourceAudioId: audioId.trim(),
      continueAt: defaultParamFlag ? (continueAt ?? null) : null,
      defaultParamFlag,
    },
  });

  return NextResponse.json({ taskId });
}

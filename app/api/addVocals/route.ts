import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseKieResponse } from "@/lib/api-error";
import { getCallbackUrl } from "@/lib/api-callback";
import { validateRequired } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

const KIE_BASE = "https://api.kie.ai/api/v1";

export type AddVocalsBody = {
  uploadUrl: string;
  title: string;
  prompt: string;
  style: string;
  negativeTags: string;
  model?: string;
  vocalGender?: "m" | "f" | "d";
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
};

const ADD_VOCALS_MODELS = ["V4_5PLUS", "V5"] as const;

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json(
      { error: "Sign in to add vocals" },
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

  let body: AddVocalsBody;
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
    title,
    prompt,
    style,
    negativeTags,
    model = "V4_5PLUS",
    vocalGender,
    styleWeight,
    weirdnessConstraint,
    audioWeight,
  } = body;

  const validationError = validateRequired(body, [
    "uploadUrl",
    "title",
    "prompt",
    "style",
    "negativeTags",
  ]);
  if (validationError) return validationError;

  const modelVal = ADD_VOCALS_MODELS.includes(model as (typeof ADD_VOCALS_MODELS)[number])
    ? model
    : "V4_5PLUS";

  const payload: Record<string, unknown> = {
    uploadUrl: uploadUrl.trim(),
    title: title.trim(),
    prompt: prompt.trim(),
    style: style.trim(),
    negativeTags: negativeTags.trim(),
    model: modelVal,
    callBackUrl: getCallbackUrl(),
  };
  if (vocalGender === "m" || vocalGender === "f" || vocalGender === "d") payload.vocalGender = vocalGender;
  if (typeof styleWeight === "number") payload.styleWeight = styleWeight;
  if (typeof weirdnessConstraint === "number")
    payload.weirdnessConstraint = weirdnessConstraint;
  if (typeof audioWeight === "number") payload.audioWeight = audioWeight;

  const res = await fetch(`${KIE_BASE}/generate/add-vocals`, {
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

  const taskId =
    data?.data &&
    typeof data.data === "object" &&
    data.data !== null &&
    "taskId" in data.data
      ? (data.data as { taskId?: string }).taskId
      : undefined;
  if (!taskId) {
    return NextResponse.json(
      { error: "No taskId in response", code: parsed.apiCode },
      { status: 502 }
    );
  }

  await prisma.generation.create({
    data: {
      userId: token.sub,
      taskId,
      prompt: prompt.trim(),
      customMode: false,
      instrumental: false,
      model: modelVal,
      title: title.trim(),
      style: style.trim(),
      negativeTags: negativeTags.trim(),
      vocalGender: vocalGender ?? null,
      styleWeight: typeof styleWeight === "number" ? styleWeight : null,
      weirdnessConstraint:
        typeof weirdnessConstraint === "number" ? weirdnessConstraint : null,
      audioWeight: typeof audioWeight === "number" ? audioWeight : null,
      isExtension: false,
      uploadUrl: uploadUrl.trim(),
      isAddVocals: true,
    },
  });

  return NextResponse.json({ taskId });
}

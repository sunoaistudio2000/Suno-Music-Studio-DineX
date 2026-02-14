import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseKieResponse } from "@/lib/api-error";
import { getCallbackUrl } from "@/lib/api-callback";
import { validateRequired } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

const KIE_BASE = "https://api.kie.ai/api/v1";

export type SeparateVocalsBody = {
  taskId: string;
  audioId: string;
};

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json(
      { error: "Sign in to separate vocals" },
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

  let body: SeparateVocalsBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { taskId, audioId } = body;

  const validationError = validateRequired(body, ["taskId", "audioId"]);
  if (validationError) return validationError;

  const payload = {
    taskId: taskId.trim(),
    audioId: audioId.trim(),
    type: "separate_vocal",
    callBackUrl: getCallbackUrl(),
  };

  const res = await fetch(`${KIE_BASE}/vocal-removal/generate`, {
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

  const sepTaskId =
    data?.data &&
    typeof data.data === "object" &&
    data.data !== null &&
    "taskId" in data.data
      ? (data.data as { taskId?: string }).taskId
      : undefined;
  if (!sepTaskId) {
    return NextResponse.json(
      { error: "No taskId in response", code: parsed.apiCode },
      { status: 502 }
    );
  }

  await prisma.generation.create({
    data: {
      userId: token.sub,
      taskId: sepTaskId,
      prompt: "Separate vocals",
      customMode: false,
      instrumental: false,
      model: "vocal-separation",
      title: "Vocals + Instrumental",
      style: "",
      negativeTags: "",
      isExtension: false,
      isSeparateVocals: true,
    },
  });

  return NextResponse.json({ taskId: sepTaskId });
}

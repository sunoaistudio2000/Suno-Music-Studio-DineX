import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId?.trim()) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const generation = await prisma.generation.findFirst({
    where: { userId: token.sub, taskId: taskId.trim() },
  });
  if (!generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  return NextResponse.json({
    generation: {
      prompt: generation.prompt,
      title: generation.title ?? undefined,
      style: generation.style ?? undefined,
      negativeTags: generation.negativeTags ?? undefined,
      model: generation.model,
      instrumental: generation.instrumental,
      customMode: generation.customMode,
      vocalGender: generation.vocalGender ?? undefined,
      personaId: generation.personaId ?? undefined,
      styleWeight: generation.styleWeight ?? undefined,
      weirdnessConstraint: generation.weirdnessConstraint ?? undefined,
      audioWeight: generation.audioWeight ?? undefined,
    },
  });
}

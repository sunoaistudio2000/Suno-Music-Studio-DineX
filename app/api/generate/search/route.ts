import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { buildGenerationSearchWhere } from "@/lib/generation-search";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ taskIds: [] });
  }

  const where = buildGenerationSearchWhere(q.trim(), token.sub);
  const generations = await prisma.generation.findMany({
    where,
    select: { taskId: true },
  });
  const taskIds = Array.from(
    new Set(generations.map((g: { taskId: string }) => g.taskId))
  );

  return NextResponse.json({ taskIds });
}

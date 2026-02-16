import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCoverImage } from "@/lib/audio";

/** GET /api/tracks/shared - List shared tracks with metadata. Public, no auth required. */
export async function GET() {
  try {
    const tracks = await prisma.track.findMany({
      where: {
        isShared: true,
        localFilename: { not: null },
      },
      select: {
        id: true,
        localFilename: true,
        title: true,
        taskId: true,
        generationId: true,
        sharedCoverIndex: true,
        sharedAt: true,
        createdAt: true,
        generation: {
          select: {
            coverImages: true,
            style: true,
            prompt: true,
            user: {
              select: { name: true, email: true },
            },
          },
        },
      },
    });

    const filtered = tracks.filter(
      (t): t is typeof t & { localFilename: string } => t.localFilename != null
    );
    const sorted = [...filtered].sort((a, b) => {
      const aDate = a.sharedAt ?? a.createdAt;
      const bDate = b.sharedAt ?? b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });
    const items = sorted.map((t) => ({
        id: t.id,
        localFilename: t.localFilename,
        title: t.title,
        taskId: t.taskId,
        coverImage: resolveCoverImage(
          t.taskId,
          t.generation?.coverImages,
          t.sharedCoverIndex ?? null
        ),
        style: t.generation?.style ?? null,
        prompt: t.generation?.prompt ?? null,
        creatorName: t.generation?.user?.name ?? null,
        creatorEmail: t.generation?.user?.email ?? null,
        createdAt: t.createdAt.toISOString(),
      }));

    return NextResponse.json({ tracks: items });
  } catch {
    return NextResponse.json({ error: "Failed to list shared tracks" }, { status: 500 });
  }
}

import { prisma } from "@/lib/prisma";
import { downloadAndSaveVideo } from "@/lib/video-download";
import { getVideoFilename, isSafeVideoFilename } from "@/lib/audio";

/** Find track by videoTaskId. Returns track with generation or null. */
export async function findTrackByVideoTaskId(videoTaskId: string) {
  return prisma.track.findFirst({
    where: { videoTaskId },
    include: { generation: true },
  });
}

/** Download video from URL, save to audio folder, update track. Returns filename or null. */
export async function saveVideoAndUpdateTrack(
  videoTaskId: string,
  videoUrl: string,
  apiKey: string
): Promise<string | null> {
  const track = await findTrackByVideoTaskId(videoTaskId);
  if (!track) return null;

  const filename = await downloadAndSaveVideo(
    track.taskId,
    track.index,
    track.title,
    videoUrl,
    apiKey
  );
  if (filename) {
    await prisma.track.update({
      where: { id: track.id },
      data: { videoFilename: filename },
    });
  }
  return filename;
}

/** Clear videoTaskId and videoFilename on track (e.g. on generation failure). */
export async function clearTrackVideo(videoTaskId: string): Promise<void> {
  const track = await findTrackByVideoTaskId(videoTaskId);
  if (!track) return;

  await prisma.track.update({
    where: { id: track.id },
    data: { videoTaskId: null, videoFilename: null },
  });
}

export type TrackForVideoCheck = {
  videoTaskId: string | null;
  taskId: string;
  index: number;
  title: string;
  generation: { userId: string } | null;
};

/** Find track and derive video filename for existence check. */
export async function findTrackForVideoCheck(params: {
  musicTaskId?: string;
  audioId?: string;
  index?: number;
  filename?: string;
}): Promise<{ track: TrackForVideoCheck; videoFilename: string } | null> {
  const { musicTaskId, audioId, index, filename } = params;

  if (filename?.trim()?.toLowerCase().endsWith(".mp3")) {
    const base = filename.replace(/\.mp3$/i, "");
    const candidate = `${base}.mp4`;
    if (isSafeVideoFilename(candidate)) {
      const parts = base.split("-");
      if (parts.length >= 2) {
        const [taskId, indexStr] = parts;
        const idx = parseInt(indexStr, 10);
        if (!Number.isNaN(idx) && idx >= 1) {
          const track = await prisma.track.findFirst({
            where: { taskId: taskId.trim(), index: idx },
            include: { generation: true },
          });
          if (track) return { track, videoFilename: candidate };
        }
      }
    }
  }

  if (!musicTaskId?.trim()) return null;
  const where = audioId?.trim()
    ? { taskId: musicTaskId.trim(), audioId: audioId.trim() }
    : typeof index === "number" && !Number.isNaN(index) && index >= 1
      ? { taskId: musicTaskId.trim(), index }
      : null;
  if (!where) return null;

  const track = await prisma.track.findFirst({
    where,
    include: { generation: true },
  });
  if (!track) return null;

  const videoFilename = getVideoFilename(track.taskId, track.index, track.title);
  if (!isSafeVideoFilename(videoFilename)) return null;
  return { track, videoFilename };
}

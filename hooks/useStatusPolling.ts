"use client";

import { useCallback, useRef } from "react";
import { type StatusState, FAILED_STATUSES } from "@/app/types";
import type { SunoTrack } from "@/app/types";

type UseStatusPollingOptions = {
  setStatusState: (state: StatusState) => void;
};

/**
 * Shared polling hook for Generate and Extend music.
 * Polls `/api/generate/status`, maps tracks, auto-saves on success.
 */
export function useStatusPolling({ setStatusState }: UseStatusPollingOptions) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const setError = useCallback(
    (error: string) => setStatusState({ taskId: "", status: "ERROR", tracks: [], error }),
    [setStatusState]
  );

  const pollStatus = useCallback(
    async (taskId: string) => {
      try {
        const res = await fetch(`/api/generate/status?taskId=${encodeURIComponent(taskId)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to fetch status");
          stopPolling();
          return;
        }
        const d = data?.data;
        const status = (d?.status ?? data?.status ?? "PENDING").toString();
        const response = d?.response ?? {};
        const rawSuno = response.sunoData ?? response.suno_data ?? response.data;
        const rawArray = Array.isArray(rawSuno)
          ? rawSuno.filter((t: unknown) => t != null)
          : rawSuno != null
            ? [rawSuno]
            : [];
        const tracks: SunoTrack[] = rawArray.map((t: Record<string, unknown>, index: number) => ({
          id: String(t.id ?? index),
          audioUrl: String(t.audioUrl ?? t.audio_url ?? ""),
          streamAudioUrl: t.streamAudioUrl ?? t.stream_audio_url != null ? String(t.stream_audio_url) : undefined,
          imageUrl: t.imageUrl ?? t.image_url != null ? String(t.image_url) : undefined,
          prompt: t.prompt != null ? String(t.prompt) : undefined,
          modelName: t.modelName ?? t.model_name != null ? String(t.model_name) : undefined,
          title: String(t.title ?? "Untitled"),
          tags: t.tags != null ? String(t.tags) : undefined,
          createTime: t.createTime != null ? String(t.createTime) : undefined,
          duration: typeof t.duration === "number" ? t.duration : undefined,
        }));
        const errorMessage =
          d?.errorMessage ?? d?.error_message ?? d?.msg ?? (typeof d?.error === "string" ? d.error : null);
        const isSuccessStatus =
          status === "SUCCESS" || status === "COMPLETED" || status?.toLowerCase() === "complete";
        const displayError =
          !isSuccessStatus && errorMessage && typeof errorMessage === "string" ? errorMessage : undefined;
        setStatusState({
          taskId,
          status,
          tracks,
          error: displayError,
        });
        if (isSuccessStatus && tracks.length > 0) {
          try {
            await fetch("/api/audio/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId,
                tracks: tracks.map((t) => ({ id: t.id, audioUrl: t.audioUrl, title: t.title })),
              }),
            });
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("audio-saved"));
            }
          } catch {
            // ignore save errors
          }
        }
        if (isSuccessStatus || FAILED_STATUSES.includes(status as (typeof FAILED_STATUSES)[number])) {
          stopPolling();
        }
      } catch (err) {
        setError((err as Error).message);
        stopPolling();
      }
    },
    [setStatusState, setError, stopPolling]
  );

  /** Start polling immediately then every 8 seconds. Returns cleanup function. */
  const startPolling = useCallback(
    (taskId: string) => {
      stopPolling();
      pollStatus(taskId);
      pollRef.current = setInterval(() => pollStatus(taskId), 8000);
    },
    [pollStatus, stopPolling]
  );

  return { pollStatus, startPolling, stopPolling, setError, pollRef };
}

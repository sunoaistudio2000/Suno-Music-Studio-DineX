"use client";

import { type StatusState, IN_PROGRESS_STATUSES, FAILED_STATUSES } from "@/app/types";
import { GenerationProgress } from "./GenerationProgress";

type GenerationStatusProps = {
  statusState: StatusState;
};

export function GenerationStatus({ statusState }: GenerationStatusProps) {
  if (!statusState) return null;

  const inProgress = IN_PROGRESS_STATUSES.includes(statusState.status as (typeof IN_PROGRESS_STATUSES)[number]);
  const isError = FAILED_STATUSES.includes(statusState.status as (typeof FAILED_STATUSES)[number]);
  const err = (statusState.error ?? "").toLowerCase();
  const isCreditsError =
    err.includes("credit") || err.includes("insufficient") || err.includes("top up");
  const errorSectionClass = isCreditsError
    ? "rounded-xl border border-amber-800/50 bg-amber-950/30 p-6"
    : "rounded-xl border border-red-900/50 bg-red-950/30 p-6";
  const errorTitleClass = isCreditsError
    ? "mb-2 text-sm font-semibold uppercase tracking-wide text-amber-400"
    : "mb-2 text-sm font-semibold uppercase tracking-wide text-red-400";
  const errorTextClass = isCreditsError
    ? "whitespace-pre-wrap text-sm text-amber-300/95"
    : "whitespace-pre-wrap text-sm text-red-300/95";

  return (
    <div className="mb-10 min-h-0" aria-live="polite">
      {inProgress && <GenerationProgress isActive={true} status={statusState.status} />}

      {isError && statusState.error && (
        <section className={errorSectionClass} role="alert">
          <h3 className={errorTitleClass}>
            {isCreditsError ? "Insufficient credits" : "Generation failed"}
          </h3>
          <p className={errorTextClass}>{statusState.error}</p>
        </section>
      )}
    </div>
  );
}

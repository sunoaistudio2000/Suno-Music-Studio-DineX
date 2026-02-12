"use client";

import type { StatusState } from "@/app/types";
import { AddVocalsForm } from "./AddVocalsForm";
import { GenerationStatus } from "@/components/generate/GenerationStatus";

type AddVocalsSectionProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  onClearSelection?: () => void;
  loadTaskId?: string | null;
  resetKey?: number;
};

export function AddVocalsSection({
  statusState,
  setStatusState,
  selectedTrackFilename,
  selectedTrackName,
  onClearSelection,
  loadTaskId,
  resetKey,
}: AddVocalsSectionProps) {
  return (
    <>
      <AddVocalsForm
        statusState={statusState}
        setStatusState={setStatusState}
        selectedTrackFilename={selectedTrackFilename}
        selectedTrackName={selectedTrackName}
        onClearSelection={onClearSelection}
        loadTaskId={loadTaskId}
        resetKey={resetKey}
      />
      <GenerationStatus statusState={statusState} />
    </>
  );
}

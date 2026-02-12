"use client";

import type { StatusState } from "@/app/types";
import { AddInstrumentalForm } from "./AddInstrumentalForm";
import { GenerationStatus } from "@/components/generate/GenerationStatus";

type AddInstrumentalSectionProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  onClearSelection?: () => void;
  loadTaskId?: string | null;
  resetKey?: number;
};

export function AddInstrumentalSection({
  statusState,
  setStatusState,
  selectedTrackFilename,
  selectedTrackName,
  onClearSelection,
  loadTaskId,
  resetKey,
}: AddInstrumentalSectionProps) {
  return (
    <>
      <AddInstrumentalForm
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

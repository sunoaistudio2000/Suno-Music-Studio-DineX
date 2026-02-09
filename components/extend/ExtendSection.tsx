"use client";

import type { StatusState, SavedPersona } from "@/app/types";
import { ExtendForm } from "./ExtendForm";
import { GenerationStatus } from "@/components/generate/GenerationStatus";

type ExtendSectionProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  selectedAudioId?: string | null;
  /** taskId of the selected track's generation, used to populate form fields. */
  loadTaskId?: string | null;
  personas?: SavedPersona[];
  resetKey?: number;
};

export function ExtendSection({
  statusState,
  setStatusState,
  selectedAudioId,
  loadTaskId,
  personas,
  resetKey,
}: ExtendSectionProps) {
  return (
    <>
      <ExtendForm
        statusState={statusState}
        setStatusState={setStatusState}
        selectedAudioId={selectedAudioId}
        loadTaskId={loadTaskId}
        personas={personas}
        resetKey={resetKey}
      />
      <GenerationStatus statusState={statusState} />
    </>
  );
}

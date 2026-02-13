"use client";

import type { StatusState } from "@/app/types";
import { SeparateVocalsForm } from "./SeparateVocalsForm";
import { GenerationStatus } from "@/components/generate/GenerationStatus";

type SeparateVocalsSectionProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  selectedAudioId?: string | null;
  onClearSelection?: () => void;
};

export function SeparateVocalsSection({
  statusState,
  setStatusState,
  selectedTrackFilename,
  selectedTrackName,
  selectedAudioId,
  onClearSelection,
}: SeparateVocalsSectionProps) {
  return (
    <>
      <SeparateVocalsForm
        statusState={statusState}
        setStatusState={setStatusState}
        selectedTrackFilename={selectedTrackFilename}
        selectedTrackName={selectedTrackName}
        selectedAudioId={selectedAudioId}
        onClearSelection={onClearSelection}
      />
      <GenerationStatus statusState={statusState} />
    </>
  );
}

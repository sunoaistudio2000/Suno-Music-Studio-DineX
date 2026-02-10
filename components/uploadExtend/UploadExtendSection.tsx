"use client";

import type { StatusState, SavedPersona } from "@/app/types";
import { UploadExtendForm } from "./UploadExtendForm";
import { GenerationStatus } from "@/components/generate/GenerationStatus";

type UploadExtendSectionProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  /** Filename of the track selected in the Suno Audio Panel (e.g. taskId-1-title.mp3). */
  selectedTrackFilename?: string | null;
  /** Display name of the selected track. */
  selectedTrackName?: string | null;
  /** Called when user clears the audio source. */
  onClearSelection?: () => void;
  /** taskId of the selected track's generation, used to populate form fields. */
  loadTaskId?: string | null;
  personas?: SavedPersona[];
  resetKey?: number;
};

export function UploadExtendSection({
  statusState,
  setStatusState,
  selectedTrackFilename,
  selectedTrackName,
  onClearSelection,
  loadTaskId,
  personas,
  resetKey,
}: UploadExtendSectionProps) {
  return (
    <>
      <UploadExtendForm
        statusState={statusState}
        setStatusState={setStatusState}
        selectedTrackFilename={selectedTrackFilename}
        selectedTrackName={selectedTrackName}
        onClearSelection={onClearSelection}
        loadTaskId={loadTaskId}
        personas={personas}
        resetKey={resetKey}
      />
      <GenerationStatus statusState={statusState} />
    </>
  );
}

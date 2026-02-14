"use client";

import type { StatusState } from "@/app/types";
import { MashupForm } from "./MashupForm";
import { GenerationStatus } from "@/components/generate/GenerationStatus";

type MashupSectionProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  resetKey?: number;
  selectingForSlot?: 1 | 2;
  onSelectingForSlotChange?: (slot: 1 | 2) => void;
  slot1SelectedFilename?: string | null;
  slot2SelectedFilename?: string | null;
  slot1SelectedTrackName?: string | null;
  slot2SelectedTrackName?: string | null;
  onClearSlot1?: () => void;
  onClearSlot2?: () => void;
};

export function MashupSection({
  statusState,
  setStatusState,
  resetKey,
  selectingForSlot = 1,
  onSelectingForSlotChange,
  slot1SelectedFilename,
  slot2SelectedFilename,
  slot1SelectedTrackName,
  slot2SelectedTrackName,
  onClearSlot1,
  onClearSlot2,
}: MashupSectionProps) {
  return (
    <>
      <MashupForm
        statusState={statusState}
        setStatusState={setStatusState}
        resetKey={resetKey}
        selectingForSlot={selectingForSlot}
        onSelectingForSlotChange={onSelectingForSlotChange}
        slot1SelectedFilename={slot1SelectedFilename}
        slot2SelectedFilename={slot2SelectedFilename}
        slot1SelectedTrackName={slot1SelectedTrackName}
        slot2SelectedTrackName={slot2SelectedTrackName}
        onClearSlot1={onClearSlot1}
        onClearSlot2={onClearSlot2}
      />
      <GenerationStatus statusState={statusState} />
    </>
  );
}

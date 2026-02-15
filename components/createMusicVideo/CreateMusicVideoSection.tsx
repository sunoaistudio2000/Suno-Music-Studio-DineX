"use client";

import { CreateMusicVideoForm } from "./CreateMusicVideoForm";

type CreateMusicVideoSectionProps = {
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  selectedAudioId?: string | null;
  onClearSelection?: () => void;
};

export function CreateMusicVideoSection({
  selectedTrackFilename,
  selectedTrackName,
  selectedAudioId,
  onClearSelection,
}: CreateMusicVideoSectionProps) {
  return (
    <CreateMusicVideoForm
      selectedTrackFilename={selectedTrackFilename}
      selectedTrackName={selectedTrackName}
      selectedAudioId={selectedAudioId}
      onClearSelection={onClearSelection}
    />
  );
}

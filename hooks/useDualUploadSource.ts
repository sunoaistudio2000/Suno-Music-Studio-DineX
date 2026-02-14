"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { parseSavedFilename } from "@/components/SavedTracksList";

type SlotState = {
  pickedFile: File | null;
  uploadedUrl: string | null;
  uploadedFileName: string | null;
  isUploading: boolean;
  error: string | null;
};

type UseDualUploadSourceOptions = {
  resetKey?: number;
  selectedTrackFilename1?: string | null;
  selectedTrackName1?: string | null;
  selectedTrackFilename2?: string | null;
  selectedTrackName2?: string | null;
  onClearSelection1?: () => void;
  onClearSelection2?: () => void;
};

export function useDualUploadSource({
  resetKey = 0,
  selectedTrackFilename1,
  selectedTrackName1,
  selectedTrackFilename2,
  selectedTrackName2,
  onClearSelection1,
  onClearSelection2,
}: UseDualUploadSourceOptions = {}) {
  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

  const [slot1, setSlot1] = useState<SlotState>({
    pickedFile: null,
    uploadedUrl: null,
    uploadedFileName: null,
    isUploading: false,
    error: null,
  });
  const [slot2, setSlot2] = useState<SlotState>({
    pickedFile: null,
    uploadedUrl: null,
    uploadedFileName: null,
    isUploading: false,
    error: null,
  });

  const clearSlot = useCallback(
    (slot: 1 | 2) => {
      const setter = slot === 1 ? setSlot1 : setSlot2;
      setter({
        pickedFile: null,
        uploadedUrl: null,
        uploadedFileName: null,
        isUploading: false,
        error: null,
      });
      const ref = slot === 1 ? fileInput1Ref : fileInput2Ref;
      if (ref.current) ref.current.value = "";
      if (slot === 1) onClearSelection1?.();
      else onClearSelection2?.();
    },
    [onClearSelection1, onClearSelection2]
  );

  const clearAll = useCallback(() => {
    clearSlot(1);
    clearSlot(2);
  }, [clearSlot]);

  useEffect(() => {
    if (resetKey === 0) return;
    clearAll();
  }, [resetKey, clearAll]);

  const handleFileChange = useCallback(
    (slot: 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const isMp3 =
        file.type === "audio/mpeg" ||
        file.type === "audio/mp3" ||
        file.name?.toLowerCase().endsWith(".mp3");
      const setter = slot === 1 ? setSlot1 : setSlot2;
      const ref = slot === 1 ? fileInput1Ref : fileInput2Ref;
      if (!isMp3) {
        setter((prev) => ({ ...prev, error: "Only MP3 files are allowed", pickedFile: null }));
        if (ref.current) ref.current.value = "";
        return;
      }
      if (slot === 1) onClearSelection1?.();
      else onClearSelection2?.();
      setter({
        pickedFile: file,
        uploadedUrl: null,
        uploadedFileName: null,
        isUploading: false,
        error: null,
      });
      if (ref.current) ref.current.value = "";
    },
    [onClearSelection1, onClearSelection2]
  );

  const handleUpload = useCallback(
    async (slot: 1 | 2) => {
      const setter = slot === 1 ? setSlot1 : setSlot2;
      const state = slot === 1 ? slot1 : slot2;
      const selectedFilename = slot === 1 ? selectedTrackFilename1 : selectedTrackFilename2;
      const hasSource = state.pickedFile || selectedFilename;
      if (state.isUploading || !hasSource) return;

      setter((prev) => ({ ...prev, isUploading: true, error: null }));

      try {
        const formData = new FormData();
        if (state.pickedFile) {
          formData.append("file", state.pickedFile);
        } else if (selectedFilename) {
          formData.append("localFilename", selectedFilename);
        } else {
          setter((prev) => ({ ...prev, isUploading: false, error: "No audio source selected" }));
          return;
        }

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setter((prev) => ({
            ...prev,
            isUploading: false,
            error: data.error ?? "Upload failed",
          }));
          return;
        }
        const url = data.downloadUrl;
        const fileName =
          data.fileName ?? state.pickedFile?.name ?? selectedFilename ?? "uploaded.mp3";
        setter((prev) => ({
          ...prev,
          uploadedUrl: url,
          uploadedFileName: fileName,
          isUploading: false,
          error: null,
        }));
      } catch (err) {
        setter((prev) => ({
          ...prev,
          isUploading: false,
          error: (err as Error).message,
        }));
      }
    },
    [slot1, slot2, selectedTrackFilename1, selectedTrackFilename2]
  );

  const bothUploaded = !!slot1.uploadedUrl && !!slot2.uploadedUrl;
  const uploadUrlList =
    slot1.uploadedUrl && slot2.uploadedUrl ? [slot1.uploadedUrl, slot2.uploadedUrl] : null;

  const slot1HasPickedSource = !!slot1.pickedFile || !!selectedTrackFilename1;
  const slot2HasPickedSource = !!slot2.pickedFile || !!selectedTrackFilename2;
  const slot1PickedSourceName =
    slot1.pickedFile?.name ??
    selectedTrackName1 ??
    (selectedTrackFilename1 ? parseSavedFilename(selectedTrackFilename1)?.title ?? selectedTrackFilename1 : null);
  const slot2PickedSourceName =
    slot2.pickedFile?.name ??
    selectedTrackName2 ??
    (selectedTrackFilename2 ? parseSavedFilename(selectedTrackFilename2)?.title ?? selectedTrackFilename2 : null);

  return {
    fileInput1Ref,
    fileInput2Ref,
    slot1: {
      ...slot1,
      hasPickedSource: slot1HasPickedSource,
      pickedSourceName: slot1PickedSourceName,
      handleFileChange: handleFileChange(1),
      handleUpload: () => handleUpload(1),
      clearSlot: () => clearSlot(1),
    },
    slot2: {
      ...slot2,
      hasPickedSource: slot2HasPickedSource,
      pickedSourceName: slot2PickedSourceName,
      handleFileChange: handleFileChange(2),
      handleUpload: () => handleUpload(2),
      clearSlot: () => clearSlot(2),
    },
    bothUploaded,
    uploadUrlList,
    clearAll,
  };
}

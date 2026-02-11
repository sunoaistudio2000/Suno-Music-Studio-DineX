"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { parseSavedFilename } from "@/components/SavedTracksList";

type UseUploadSourceOptions = {
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  onClearSelection?: () => void;
  /** Called when source is cleared (clear selection + reset form-level overrides). */
  onClearSource?: () => void;
  resetKey?: number;
  onUploadSuccess: (params: {
    url: string;
    fileName: string;
    titleForSave: string;
  }) => void | Promise<void>;
  resetForm: () => void;
};

export function useUploadSource({
  selectedTrackFilename,
  selectedTrackName,
  onClearSelection,
  onClearSource,
  resetKey = 0,
  onUploadSuccess,
  resetForm,
}: UseUploadSourceOptions) {
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasPickedSource = pickedFile != null || !!selectedTrackFilename;
  const pickedSourceName = pickedFile
    ? pickedFile.name
    : (selectedTrackName ?? selectedTrackFilename ?? null);
  const hasUploaded = !!uploadedUrl;

  useEffect(() => {
    if (!selectedTrackFilename) return;
    setPickedFile(null);
    setUploadedUrl(null);
    setUploadedFileName(null);
    setUploadError(null);
  }, [selectedTrackFilename]);

  useEffect(() => {
    if (resetKey === 0) return;
    setPickedFile(null);
    setUploadedUrl(null);
    setUploadedFileName(null);
    setUploadError(null);
  }, [resetKey]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const isMp3 =
        file.type === "audio/mpeg" ||
        file.type === "audio/mp3" ||
        file.name?.toLowerCase().endsWith(".mp3");
      if (!isMp3) {
        setUploadError("Only MP3 files are allowed");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setUploadError(null);
      setPickedFile(file);
      setUploadedUrl(null);
      setUploadedFileName(null);
      onClearSelection?.();
      resetForm();
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [onClearSelection, resetForm]
  );

  const handleUpload = useCallback(async () => {
    if (isUploading) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadedUrl(null);
    setUploadedFileName(null);

    try {
      const formData = new FormData();
      if (pickedFile) {
        formData.append("file", pickedFile);
      } else if (selectedTrackFilename) {
        formData.append("localFilename", selectedTrackFilename);
      } else {
        setUploadError("No audio source selected");
        return;
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
        return;
      }
      const url = data.downloadUrl;
      setUploadedUrl(url);
      const resolvedName =
        data.fileName ?? pickedFile?.name ?? selectedTrackFilename ?? "uploaded.mp3";
      setUploadedFileName(resolvedName);
      const titleForSave = selectedTrackFilename
        ? parseSavedFilename(selectedTrackFilename)?.title ?? resolvedName.replace(/\.mp3$/i, "")
        : resolvedName.replace(/\.mp3$/i, "");
      await onUploadSuccess({ url, fileName: resolvedName, titleForSave });
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, pickedFile, selectedTrackFilename, onUploadSuccess]);

  const clearAll = useCallback(() => {
    setPickedFile(null);
    setUploadedUrl(null);
    setUploadedFileName(null);
    setUploadError(null);
    setShowDeleteConfirm(false);
    onClearSelection?.();
    onClearSource?.();
  }, [onClearSelection, onClearSource]);

  const handleClearSource = useCallback(() => {
    clearAll();
  }, [clearAll]);

  const handleDeleteUploaded = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    clearAll();
  }, [clearAll]);

  const handleCloseDeleteConfirm = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  return {
    pickedFile,
    fileInputRef,
    uploadedUrl,
    uploadedFileName,
    isUploading,
    uploadError,
    showDeleteConfirm,
    hasPickedSource,
    pickedSourceName,
    hasUploaded,
    handleFileChange,
    handleUpload,
    handleClearSource,
    handleDeleteUploaded,
    handleConfirmDelete,
    handleCloseDeleteConfirm,
  };
}

"use client";

import type { StatusState, SavedPersona } from "@/app/types";
import { InfoHint } from "@/components/shared/InfoHint";
import { Toggle } from "@/components/shared/Toggle";
import { StyledAudioPlayer } from "@/components/StyledAudioPlayer";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CustomModeFields } from "@/components/shared/CustomModeFields";
import { useExtendFormState } from "@/hooks/useExtendFormState";
import { useUploadSource } from "@/hooks/useUploadSource";
import { INPUT_CLASS } from "@/lib/generation-constants";

type UploadCoverFormProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  /** Filename of the track selected in the Suno Audio Panel (e.g. taskId-1-title.mp3). */
  selectedTrackFilename?: string | null;
  /** Display name of the selected track. */
  selectedTrackName?: string | null;
  /** Called when the user clears the audio source (deselects panel track too). */
  onClearSelection?: () => void;
  personas?: SavedPersona[];
  /** When set, fetch this generation from the database and populate the form. */
  loadTaskId?: string | null;
  /** Increment to reset the form to defaults. */
  resetKey?: number;
};

const BTN_CLASS =
  "flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] disabled:opacity-50";

export function UploadCoverForm({
  statusState,
  setStatusState,
  selectedTrackFilename,
  selectedTrackName,
  onClearSelection,
  personas: personasProp,
  loadTaskId,
  resetKey = 0,
}: UploadCoverFormProps) {
  const fs = useExtendFormState({
    statusState,
    setStatusState,
    personas: personasProp,
    loadTaskId,
    resetKey,
  });

  const upload = useUploadSource({
    selectedTrackFilename,
    selectedTrackName,
    onClearSelection,
    onClearSource: () => fs.setTrackTitleOverride(null),
    resetKey,
    onUploadSuccess: ({ titleForSave }) => {
      fs.setTrackTitleOverride(titleForSave.replace(/\s+/g, "_"));
    },
    resetForm: fs.resetToDefaults,
  });

  const noUploadUrl = !upload.uploadedUrl;
  const missingCustomFields = fs.defaultParamFlag
    ? fs.instrumental
      ? !fs.style.trim() || !fs.title.trim() || !fs.model
      : !fs.prompt.trim() || !fs.style.trim() || !fs.title.trim() || !fs.model
    : false;
  const invalidForm = noUploadUrl || missingCustomFields;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fs.isSubmitting || fs.isGenerating || invalidForm) return;
    fs.setIsSubmitting(true);
    setStatusState(null);
    fs.stopPolling();
    try {
      const body: Record<string, unknown> = {
        uploadUrl: upload.uploadedUrl!,
        customMode: fs.defaultParamFlag,
        instrumental: fs.instrumental,
        model: fs.model || "V4",
      };
      if (fs.prompt.trim()) body.prompt = fs.prompt.trim();

      if (fs.defaultParamFlag) {
        body.style = fs.style;
        body.title = fs.title;
        if (fs.negativeTags) body.negativeTags = fs.negativeTags;
        body.vocalGender = fs.vocalGender;
        if (fs.selectedPersonaId.trim()) body.personaId = fs.selectedPersonaId.trim();
        body.styleWeight = fs.styleWeight;
        body.weirdnessConstraint = fs.weirdnessConstraint;
        body.audioWeight = fs.audioWeight;
      }

      const res = await fetch("/api/uploadCover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const credits = res.status === 402 || data.code === 402;
        const fallback = credits
          ? "Your balance isn't enough to run this request. Please top up to continue."
          : "Upload cover failed";
        const displayMessage = data.error ?? data.message ?? data.msg ?? fallback;
        const msg = typeof displayMessage === "string" ? displayMessage : "Upload cover failed";
        setStatusState({ taskId: "", status: "ERROR", tracks: [], error: msg });
        return;
      }
      const taskId = data.taskId;
      if (!taskId) {
        fs.setError("No task ID returned");
        return;
      }
      setStatusState({ taskId, status: "PENDING", tracks: [] });
      fs.startPolling(taskId);
    } catch (err) {
      fs.setError((err as Error).message);
    } finally {
      fs.setIsSubmitting(false);
    }
  };

  const isBusy = fs.isSubmitting || fs.isGenerating;

  return (
    <section
      className={`relative mb-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 ${isBusy ? "select-none opacity-90" : ""}`}
      aria-busy={isBusy}
    >
      {isBusy && (
        <div
          className="absolute inset-0 z-10 cursor-not-allowed rounded-xl"
          aria-hidden
        />
      )}
      <div className={isBusy ? "pointer-events-none" : ""}>
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Upload &amp; Cover Music</h2>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Audio Source ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Audio Source<span className="text-red-500"> *</span>
              </label>
              <InfoHint
                text="Upload then cover"
                tooltip="Choose an MP3 file or select a saved track, then click Upload to send it to the server. The Cover button is enabled only after a successful upload."
                id="upload-cover-source-tooltip"
                tooltipShiftRight={60}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={upload.fileInputRef}
                type="file"
                accept=".mp3,audio/mpeg"
                onChange={upload.handleFileChange}
                className="hidden"
                id="upload-cover-file-input"
              />
              <button
                type="button"
                onClick={() => upload.fileInputRef.current?.click()}
                disabled={upload.isUploading}
                className={BTN_CLASS}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                Choose File
              </button>
              {(upload.hasPickedSource || upload.hasUploaded) && (
                <button
                  type="button"
                  onClick={upload.handleClearSource}
                  className="text-sm text-gray-500 hover:text-red-400"
                  title="Clear audio source"
                >
                  Clear
                </button>
              )}
            </div>

            {upload.hasPickedSource && !upload.hasUploaded && !upload.isUploading && (
              <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <span className="text-gray-300">{upload.pickedSourceName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={upload.handleUpload}
                    disabled={upload.isUploading}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f] disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload
                  </button>
                </div>
              </div>
            )}

            {upload.isUploading && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-3 text-sm text-gray-400">
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-blue-500"
                  aria-hidden
                />
                Uploading…
              </div>
            )}

            {upload.uploadError && (
              <p className="mt-2 text-sm text-red-400">{upload.uploadError}</p>
            )}

            {upload.hasUploaded && !upload.isUploading && (
              <div className="mt-3 rounded-lg border border-green-900/50 bg-[#0f0f0f] p-3">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="inline-flex h-2 w-2 rounded-full bg-green-500" aria-hidden />
                  <span className="text-green-400">Uploaded: {upload.uploadedFileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StyledAudioPlayer
                    className="min-w-[280px] flex-1"
                    src={upload.uploadedUrl!}
                    preload="metadata"
                    aria-label={`Preview ${upload.uploadedFileName ?? "uploaded file"}`}
                  />
                  <button
                    type="button"
                    onClick={upload.handleDeleteUploaded}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-900/50 bg-red-950/30 text-red-400 transition-colors hover:border-red-600/50 hover:bg-red-950/50 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]"
                    title="Remove uploaded file"
                    aria-label="Remove uploaded file"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {!upload.hasPickedSource && !upload.hasUploaded && !upload.isUploading && (
              <p className="mt-2 text-xs text-gray-500">
                Choose an MP3 file or select a track from the Suno Audio Folder above, then click Upload.
              </p>
            )}
          </div>

          {/* ── Prompt ── */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-gray-400">
                Prompt{(!fs.defaultParamFlag || !fs.instrumental) && <span className="text-red-500"> *</span>}
              </label>
              <InfoHint
                text="Description of the desired style"
                tooltip={`Max ${fs.promptLimit} characters`}
                id="upload-cover-prompt-limit-tooltip"
                compact
                highlighted={fs.modelHighlight}
              />
            </div>
            <textarea
              value={fs.prompt}
              onChange={(e) => fs.setPrompt(e.target.value)}
              rows={6}
              className={INPUT_CLASS}
              placeholder="Transform the music into a new style while keeping the melody. Describe the desired genre, instruments, or mood."
            />
          </div>

          {/* ── Toggles ── */}
          <div className="flex flex-wrap gap-6">
            <Toggle label="Custom Mode" on={fs.defaultParamFlag} onChange={fs.setDefaultParamFlag} />
            <Toggle label="Instrumental" on={fs.instrumental} onChange={fs.setInstrumental} />
          </div>

          {/* ── Custom Mode fields (no Continue At) ── */}
          {fs.defaultParamFlag && (
            <CustomModeFields
              fs={fs}
              idPrefix="upload-cover"
              radioGroupName="uploadCoverVocalGender"
              showContinueAt={false}
            />
          )}

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={fs.isSubmitting || fs.isGenerating || invalidForm}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
            >
              {fs.isSubmitting || fs.isGenerating ? (
                <>
                  <span
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-white"
                    aria-hidden
                  />
                  {fs.isSubmitting ? "Starting\u2026" : "Covering\u2026"}
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  Cover
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={upload.showDeleteConfirm}
        onClose={upload.handleCloseDeleteConfirm}
        onConfirm={upload.handleConfirmDelete}
        title="Remove Uploaded File"
        message="Are you sure you want to remove the uploaded file? You will need to upload again to cover."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
      />
    </section>
  );
}

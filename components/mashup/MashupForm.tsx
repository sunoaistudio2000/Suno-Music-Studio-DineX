"use client";

import type { StatusState } from "@/app/types";
import { InfoHint } from "@/components/shared/InfoHint";
import { Toggle } from "@/components/shared/Toggle";
import { StyledAudioPlayer } from "@/components/StyledAudioPlayer";
import { CustomModeFields } from "@/components/shared/CustomModeFields";
import { useExtendFormState } from "@/hooks/useExtendFormState";
import { useDualUploadSource } from "@/hooks/useDualUploadSource";
import { INPUT_CLASS, BTN_CLASS } from "@/lib/generation-constants";
import { getApiErrorMessage } from "@/lib/api-error";

type MashupFormProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  /** Increment to reset the form to defaults. */
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

function UploadSlot({
  slot,
  slotLabel,
  inputId,
  fileInputRef,
}: {
  slot: ReturnType<typeof useDualUploadSource>["slot1"];
  slotLabel: string;
  inputId: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const hasPickedSource = slot.hasPickedSource;
  const hasUploaded = !!slot.uploadedUrl;

  return (
    <div>
      <div className="mb-2">
        <label className="text-sm font-medium text-gray-300">{slotLabel}</label>
      </div>

      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef as React.Ref<HTMLInputElement>}
          type="file"
          accept=".mp3,audio/mpeg"
          onChange={slot.handleFileChange}
          className="hidden"
          id={inputId}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={slot.isUploading}
          className={BTN_CLASS}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
          Choose File
        </button>
        {(hasPickedSource || hasUploaded) && (
          <button
            type="button"
            onClick={slot.clearSlot}
            className="text-sm text-gray-500 hover:text-red-400"
            title={`Clear ${slotLabel}`}
          >
            Clear
          </button>
        )}
      </div>

      {hasPickedSource && !hasUploaded && !slot.isUploading && (
        <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <span className="text-gray-300">{slot.pickedSourceName ?? slot.pickedFile?.name}</span>
            </div>
            <button
              type="button"
              onClick={slot.handleUpload}
              disabled={slot.isUploading}
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

      {slot.isUploading && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-3 text-sm text-gray-400">
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-blue-500"
            aria-hidden
          />
          Uploading…
        </div>
      )}

      {slot.error && (
        <p className="mt-2 text-sm text-red-400">{slot.error}</p>
      )}

      {hasUploaded && !slot.isUploading && (
        <div className="mt-3 rounded-lg border border-green-900/50 bg-[#0f0f0f] p-3">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-500" aria-hidden />
            <span className="text-green-400">Uploaded: {slot.uploadedFileName}</span>
          </div>
          <StyledAudioPlayer
            className="min-w-[280px] flex-1"
            src={slot.uploadedUrl!}
            preload="metadata"
            aria-label={`Preview ${slot.uploadedFileName ?? "uploaded file"}`}
          />
        </div>
      )}

      {!hasPickedSource && !hasUploaded && !slot.isUploading && (
        <p className="mt-2 text-xs text-gray-500">
          Choose an MP3 file or select a track from the Suno Audio Folder above, then click Upload.
        </p>
      )}
    </div>
  );
}

export function MashupForm({
  statusState,
  setStatusState,
  resetKey = 0,
  selectingForSlot = 1,
  onSelectingForSlotChange,
  slot1SelectedFilename,
  slot2SelectedFilename,
  slot1SelectedTrackName,
  slot2SelectedTrackName,
  onClearSlot1,
  onClearSlot2,
}: MashupFormProps) {
  const fs = useExtendFormState({
    statusState,
    setStatusState,
    loadTaskId: null,
    resetKey,
    fullDefaults: true,
  });

  const upload = useDualUploadSource({
    resetKey,
    selectedTrackFilename1: slot1SelectedFilename,
    selectedTrackName1: slot1SelectedTrackName,
    selectedTrackFilename2: slot2SelectedFilename,
    selectedTrackName2: slot2SelectedTrackName,
    onClearSelection1: onClearSlot1,
    onClearSelection2: onClearSlot2,
  });

  const promptLimit = fs.defaultParamFlag ? fs.charLimits.prompt : 500;
  const missingCustomFields = fs.defaultParamFlag
    ? fs.instrumental
      ? !fs.style.trim() || !fs.title.trim()
      : !fs.style.trim() || !fs.prompt.trim() || !fs.title.trim()
    : fs.prompt.trim() === "";
  const invalidForm = !upload.bothUploaded || missingCustomFields;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fs.isSubmitting || fs.isGenerating || invalidForm || !upload.uploadUrlList) return;
    fs.setIsSubmitting(true);
    setStatusState(null);
    fs.stopPolling();
    try {
      const body: Record<string, unknown> = {
        uploadUrlList: upload.uploadUrlList,
        customMode: fs.defaultParamFlag,
        instrumental: fs.instrumental,
        model: fs.model || "V4",
      };
      if (fs.prompt.trim()) body.prompt = fs.prompt.trim();

      if (fs.defaultParamFlag) {
        body.style = fs.style;
        body.title = fs.title;
        if (!fs.instrumental) body.vocalGender = fs.vocalGender;
        body.styleWeight = fs.styleWeight;
        body.weirdnessConstraint = fs.weirdnessConstraint;
        body.audioWeight = fs.audioWeight;
      }

      const res = await fetch("/api/mashup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusState({ taskId: "", status: "ERROR", tracks: [], error: getApiErrorMessage(res, data, "Mashup failed") });
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
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Mashup</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Two Audio Sources ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Audio Sources<span className="text-red-500"> *</span>
              </label>
              <InfoHint
                text="Upload or select 2 tracks"
                tooltip="Choose an MP3 file or select a track from the Suno Audio Folder above, then click Upload. Both must be uploaded before generating."
                id="mashup-sources-tooltip"
                tooltipCenter
              />
            </div>
            {onSelectingForSlotChange && (
              <div className="mb-3 flex gap-2">
                <span className="text-sm text-gray-400">Selecting for:</span>
                <button
                  type="button"
                  onClick={() => onSelectingForSlotChange(1)}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    selectingForSlot === 1
                      ? "bg-blue-600 text-white"
                      : "border border-[#2a2a2a] bg-[#0f0f0f] text-gray-400 hover:border-blue-600/50 hover:text-blue-400"
                  }`}
                >
                  File 1
                </button>
                <button
                  type="button"
                  onClick={() => onSelectingForSlotChange(2)}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    selectingForSlot === 2
                      ? "bg-blue-600 text-white"
                      : "border border-[#2a2a2a] bg-[#0f0f0f] text-gray-400 hover:border-blue-600/50 hover:text-blue-400"
                  }`}
                >
                  File 2
                </button>
              </div>
            )}
            <div className="flex flex-col gap-4">
              <UploadSlot
                slot={upload.slot1}
                slotLabel="File 1"
                inputId="mashup-file-1"
                fileInputRef={upload.fileInput1Ref}
              />
              <UploadSlot
                slot={upload.slot2}
                slotLabel="File 2"
                inputId="mashup-file-2"
                fileInputRef={upload.fileInput2Ref}
              />
            </div>
          </div>

          {/* ── Prompt ── */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-gray-400">
                Prompt{(!fs.defaultParamFlag || !fs.instrumental) && <span className="text-red-500"> *</span>}
              </label>
              <InfoHint
                text="Description of the desired audio content"
                tooltip={`Max ${promptLimit} characters`}
                id="mashup-prompt-limit-tooltip"
                compact
                highlighted={fs.modelHighlight}
              />
            </div>
            <textarea
              value={fs.prompt}
              onChange={(e) => fs.setPrompt(e.target.value)}
              rows={6}
              className={INPUT_CLASS}
              placeholder="A calm and relaxing piano track..."
            />
          </div>

          {/* ── Toggles ── */}
          <div className="flex flex-wrap gap-6">
            <Toggle label="Custom Mode" on={fs.defaultParamFlag} onChange={fs.setDefaultParamFlag} />
            <Toggle label="Instrumental" on={fs.instrumental} onChange={fs.setInstrumental} />
          </div>

          {/* ── Custom Mode fields (no Continue At, no Negative Tags, no Persona) ── */}
          {fs.defaultParamFlag && (
            <CustomModeFields
              fs={fs}
              idPrefix="mashup"
              radioGroupName="mashupVocalGender"
              showContinueAt={false}
              hideNegativeTags
              hidePersona
            />
          )}

          {/* ── Submit ── */}
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
                  {fs.isSubmitting ? "Starting\u2026" : "Generating\u2026"}
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Create Mashup
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

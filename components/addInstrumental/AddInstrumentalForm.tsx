"use client";

import type { StatusState } from "@/app/types";
import { InfoHint } from "@/components/shared/InfoHint";
import { StyledAudioPlayer } from "@/components/StyledAudioPlayer";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useAddInstrumentalFormState, ADD_INSTRUMENTAL_MODELS } from "@/hooks/useAddInstrumentalFormState";
import { useUploadSource } from "@/hooks/useUploadSource";
import { INPUT_CLASS, SELECT_CLASS, NUMBER_WRAPPER_CLASS, STEPPER_BTN, clampStep, BTN_CLASS } from "@/lib/generation-constants";
import { getApiErrorMessage } from "@/lib/api-error";
import { PlusIcon, MinusIcon } from "@/components/shared/FormIcons";

type AddInstrumentalFormProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  onClearSelection?: () => void;
  loadTaskId?: string | null;
  resetKey?: number;
};

export function AddInstrumentalForm({
  statusState,
  setStatusState,
  selectedTrackFilename,
  selectedTrackName,
  onClearSelection,
  loadTaskId,
  resetKey = 0,
}: AddInstrumentalFormProps) {
  const fs = useAddInstrumentalFormState({
    statusState,
    setStatusState,
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
  const invalidForm =
    noUploadUrl ||
    !fs.title.trim() ||
    !fs.tags.trim() ||
    !fs.negativeTags.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fs.isSubmitting || fs.isGenerating || invalidForm) return;
    fs.setIsSubmitting(true);
    setStatusState(null);
    fs.stopPolling();
    try {
      const res = await fetch("/api/addInstrumental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadUrl: upload.uploadedUrl!,
          title: fs.title.trim(),
          tags: fs.tags.trim(),
          negativeTags: fs.negativeTags.trim(),
          model: fs.model,
          vocalGender: fs.vocalGender,
          styleWeight: fs.styleWeight,
          weirdnessConstraint: fs.weirdnessConstraint,
          audioWeight: fs.audioWeight,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusState({ taskId: "", status: "ERROR", tracks: [], error: getApiErrorMessage(res, data, "Add instrumental failed") });
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
        <h2 className="mb-4 text-lg font-semibold text-gray-200">
          Add Instrumental
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Audio Source ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Audio Source<span className="text-red-500"> *</span>
              </label>
              <InfoHint
                text="Upload vocals or stems"
                tooltip="Choose an MP3 file (vocals or melody) or select a saved track, then click Upload. The Add Instrumental button is enabled only after a successful upload."
                id="add-instrumental-source-tooltip"
                tooltipCenter
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={upload.fileInputRef}
                type="file"
                accept=".mp3,audio/mpeg"
                onChange={upload.handleFileChange}
                className="hidden"
                id="add-instrumental-file-input"
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
                Choose an MP3 file (vocals or stems) or select a track from the Suno Audio Folder above, then click Upload.
              </p>
            )}
          </div>

          {/* ── Model ── */}
          <div>
            <label className="mb-1 block text-sm text-gray-400">Model</label>
            <select
              value={fs.model}
              onChange={(e) => fs.setModel(e.target.value as typeof fs.model)}
              className={SELECT_CLASS}
            >
              {ADD_INSTRUMENTAL_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* ── Title ── */}
          <div>
            <label className="mb-1 block text-sm text-gray-400">
              Title<span className="text-red-500"> *</span>
            </label>
            <input
              type="text"
              value={fs.title}
              onChange={(e) => fs.setTitle(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Relaxing Piano"
            />
          </div>

          {/* ── Tags ── */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-gray-400">
                Tags<span className="text-red-500"> *</span>
              </label>
              <InfoHint
                text="music tags to include"
                tooltip="Define the desired music styles or tags and characteristics for the instrumental accompaniment."
                id="add-instrumental-tags-tooltip"
                tooltipShiftRight={60}
              />
            </div>
            <input
              type="text"
              value={fs.tags}
              onChange={(e) => fs.setTags(e.target.value)}
              className={INPUT_CLASS}
              placeholder="relaxing, piano, soothing"
            />
          </div>

          {/* ── Negative Tags ── */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-gray-400">
                Negative Tags<span className="text-red-500"> *</span>
              </label>
              <InfoHint
                text="Styles to exclude"
                tooltip="Music styles or characteristics to exclude from the generated accompaniment."
                id="add-instrumental-negative-tags-tooltip"
                tooltipShiftRight={60}
              />
            </div>
            <input
              type="text"
              value={fs.negativeTags}
              onChange={(e) => fs.setNegativeTags(e.target.value)}
              className={INPUT_CLASS}
              placeholder="heavy metal, fast drums"
            />
          </div>

          {/* ── Vocal Gender ── */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-gray-400">Vocal Gender</label>
              <InfoHint
                text="Only affects vocals"
                tooltip="Increases probability of male/female/duet; does not guarantee it."
                id="add-instrumental-vocal-gender-tooltip"
                tooltipShiftRight={34}
              />
            </div>
            <fieldset>
              <div className="flex gap-4">
                {(["m", "f", "d"] as const).map((g) => (
                  <label key={g} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="addInstrumentalVocalGender"
                      checked={fs.vocalGender === g}
                      onChange={() => fs.setVocalGender(g)}
                      className="text-blue-600"
                    />
                    <span className="text-sm">{g === "m" ? "Male" : g === "f" ? "Female" : "Duet"}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {/* ── Weights ── */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "Style Weight",
                value: fs.styleWeight,
                set: fs.setStyleWeight,
                tooltip: "Strength of adherence to style. Range 0–1.",
              },
              {
                label: "Weirdness",
                value: fs.weirdnessConstraint,
                set: fs.setWeirdnessConstraint,
                tooltip: "Controls creative deviation. Range 0–1.",
              },
              {
                label: "Audio Weight",
                value: fs.audioWeight,
                set: fs.setAudioWeight,
                tooltip: "Balance weight for audio features. Range 0–1.",
              },
            ].map(({ label, value, set, tooltip }) => (
              <div key={label}>
                <div className="mb-1 flex items-center gap-0.5">
                  <label className="text-sm text-gray-400">{label}</label>
                  <InfoHint
                    text=""
                    tooltip={tooltip}
                    id={`add-instrumental-${label.toLowerCase().replace(/\s+/g, "-")}-tooltip`}
                    compact={false}
                    tooltipCenter
                  />
                </div>
                <div className={NUMBER_WRAPPER_CLASS}>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full min-w-0 rounded-l-lg border-0 bg-transparent px-3 py-2 text-[#f5f5f5] focus:outline-none"
                  />
                  <div className="flex flex-col border-l border-[#2a2a2a]">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => set((v) => clampStep(v, 0.01))}
                      className={`${STEPPER_BTN} rounded-tr-lg`}
                      aria-label="Increase"
                    >
                      <PlusIcon />
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => set((v) => clampStep(v, -0.01))}
                      className={`${STEPPER_BTN} rounded-br-lg`}
                      aria-label="Decrease"
                    >
                      <MinusIcon />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

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
                  {fs.isSubmitting ? "Starting…" : "Adding Instrumental…"}
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Instrumental
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
        message="Are you sure you want to remove the uploaded file? You will need to upload again to add instrumental."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
      />
    </section>
  );
}

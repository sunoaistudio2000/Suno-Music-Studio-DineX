"use client";

import type { StatusState, SavedPersona } from "@/app/types";
import { InfoHint } from "@/components/shared/InfoHint";
import { Toggle } from "@/components/shared/Toggle";
import { CustomModeFields } from "@/components/shared/CustomModeFields";
import { useExtendFormState } from "@/hooks/useExtendFormState";
import { INPUT_CLASS } from "@/lib/generation-constants";

type ExtendFormProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  /** audioId of the selected source track. */
  selectedAudioId?: string | null;
  /** Personas available for selection. */
  personas?: SavedPersona[];
  /** When set, fetch this generation from the database and populate the form. */
  loadTaskId?: string | null;
  /** Increment to reset the form to defaults. */
  resetKey?: number;
};

export function ExtendForm({
  statusState,
  setStatusState,
  selectedAudioId,
  personas: personasProp,
  loadTaskId,
  resetKey = 0,
}: ExtendFormProps) {
  const fs = useExtendFormState({
    statusState,
    setStatusState,
    personas: personasProp,
    loadTaskId,
    resetKey,
    instrumentalDefault: false,
  });

  /* ── Validation (matches Generate Music pattern) ── */
  const noAudioSelected = !selectedAudioId?.trim();
  const missingCustomFields = fs.defaultParamFlag
    ? fs.instrumental
      ? !fs.style.trim() || !fs.title.trim() || !fs.model || fs.continueAt === "" || Number(fs.continueAt) <= 0
      : !fs.prompt.trim() || !fs.style.trim() || !fs.title.trim() || !fs.model || fs.continueAt === "" || Number(fs.continueAt) <= 0
    : fs.prompt.trim() === "";
  const invalidForm = noAudioSelected || missingCustomFields;

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fs.isSubmitting || fs.isGenerating || invalidForm) return;
    fs.setIsSubmitting(true);
    setStatusState(null);
    fs.stopPolling();
    try {
      const body: Record<string, unknown> = {
        audioId: selectedAudioId!.trim(),
        defaultParamFlag: fs.defaultParamFlag,
        instrumental: fs.instrumental,
      };
      if (fs.prompt.trim()) body.prompt = fs.prompt.trim();
      if (!fs.instrumental) body.vocalGender = fs.vocalGender;

      if (fs.defaultParamFlag) {
        body.model = fs.model;
        body.style = fs.style;
        body.title = fs.title;
        body.continueAt = Number(fs.continueAt);
        if (fs.negativeTags) body.negativeTags = fs.negativeTags;
        if (!fs.instrumental && fs.selectedPersonaId.trim()) body.personaId = fs.selectedPersonaId.trim();
        body.styleWeight = fs.styleWeight;
        body.weirdnessConstraint = fs.weirdnessConstraint;
        body.audioWeight = fs.audioWeight;
      }

      const res = await fetch("/api/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const credits = res.status === 402 || data.code === 402;
        const fallback = credits
          ? "Your balance isn't enough to run this request. Please top up to continue."
          : "Extension failed";
        const displayMessage = data.error ?? data.message ?? data.msg ?? fallback;
        const msg = typeof displayMessage === "string" ? displayMessage : "Extension failed";
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
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Extend Music</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Prompt (always visible, like Generate Music) ── */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-gray-400">
                Prompt{(!fs.defaultParamFlag || !fs.instrumental) && <span className="text-red-500"> *</span>}
              </label>
              <InfoHint
                text="Description of the desired audio extension content"
                tooltip={`Max ${fs.promptLimit} characters`}
                id="extend-prompt-limit-tooltip"
                compact
                highlighted={fs.modelHighlight}
              />
            </div>
            <textarea
              value={fs.prompt}
              onChange={(e) => fs.setPrompt(e.target.value)}
              rows={6}
              className={INPUT_CLASS}
              placeholder="Extend the music with more relaxing notes and a gentle bridge section"
            />
          </div>

          {/* ── Toggles (below prompt, like Generate Music) ── */}
          <div className="flex flex-wrap gap-6">
            <Toggle label="Custom Mode" on={fs.defaultParamFlag} onChange={fs.setDefaultParamFlag} />
          </div>

          {fs.defaultParamFlag && (
            <CustomModeFields
              fs={fs}
              idPrefix="extend"
              radioGroupName="extendVocalGender"
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
                  {fs.isSubmitting ? "Starting\u2026" : "Extending\u2026"}
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                    aria-hidden
                  >
                    <path d="M9 13c0 1.105-1.12 2-2.5 2S4 14.105 4 13s1.12-2 2.5-2 2.5.895 2.5 2z" />
                    <path fillRule="evenodd" d="M9 3v10H8V3z" />
                    <path d="M8 2.82a1 1 0 0 1 .804-.98l3-.6A1 1 0 0 1 13 2.22V4L8 5V2.82z" />
                  </svg>
                  Extend Music
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

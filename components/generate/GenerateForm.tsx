"use client";

import type { StatusState } from "@/app/types";
import { InfoHint } from "@/components/shared/InfoHint";
import { Toggle } from "@/components/shared/Toggle";
import { CustomModeFields } from "@/components/shared/CustomModeFields";
import { useExtendFormState } from "@/hooks/useExtendFormState";
import { INPUT_CLASS } from "@/lib/generation-constants";

type GenerateFormProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  /** When set, fetch this generation from the database and populate the form. */
  loadTaskId?: string | null;
  /** Increment to reset the form to defaults. */
  resetKey?: number;
};

export function GenerateForm({ statusState, setStatusState, loadTaskId, resetKey = 0 }: GenerateFormProps) {
  const fs = useExtendFormState({
    statusState,
    setStatusState,
    loadTaskId,
    resetKey,
    fullDefaults: true,
  });

  /* ── Validation ── */
  const invalidForm = fs.defaultParamFlag
    ? fs.instrumental
      ? !fs.style.trim() || !fs.title.trim()
      : !fs.style.trim() || !fs.prompt.trim() || !fs.title.trim()
    : fs.prompt.trim() === "";

  const promptLimit = fs.defaultParamFlag ? fs.charLimits.prompt : 500;

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fs.isSubmitting || fs.isGenerating) return;
    fs.setIsSubmitting(true);
    setStatusState(null);
    fs.stopPolling();
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          fs.defaultParamFlag
            ? {
                prompt: fs.prompt,
                customMode: fs.defaultParamFlag,
                instrumental: fs.instrumental,
                model: fs.model,
                style: fs.style,
                title: fs.title,
                negativeTags: fs.negativeTags || undefined,
                vocalGender: !fs.instrumental ? fs.vocalGender : undefined,
                personaId: !fs.instrumental && fs.selectedPersonaId.trim() ? fs.selectedPersonaId.trim() : undefined,
                styleWeight: fs.styleWeight,
                weirdnessConstraint: fs.weirdnessConstraint,
                audioWeight: fs.audioWeight,
              }
            : {
                prompt: fs.prompt,
                customMode: fs.defaultParamFlag,
                instrumental: fs.instrumental,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        const credits = res.status === 402 || data.code === 402;
        const fallback = credits ? "Your balance isn't enough to run this request. Please top up to continue." : "Generation failed";
        const displayMessage = data.error ?? data.message ?? data.msg ?? fallback;
        const msg = typeof displayMessage === "string" ? displayMessage : "Generation failed";
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
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Generate</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Prompt ── */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-gray-400">
                Prompt{(!fs.defaultParamFlag || !fs.instrumental) && <span className="text-red-500"> *</span>}
              </label>
              <InfoHint
                text="Description of the desired audio content"
                tooltip={`Max ${promptLimit} characters`}
                id="prompt-limit-tooltip"
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

          {/* ── Custom Mode fields (no Continue At for Generate) ── */}
          {fs.defaultParamFlag && (
            <CustomModeFields
              fs={fs}
              idPrefix="generate"
              radioGroupName="vocalGender"
              showContinueAt={false}
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
                    fill="currentColor"
                    viewBox="0 0 16 16"
                    aria-hidden
                  >
                    <path d="M9 13c0 1.105-1.12 2-2.5 2S4 14.105 4 13s1.12-2 2.5-2 2.5.895 2.5 2z" />
                    <path fillRule="evenodd" d="M9 3v10H8V3z" />
                    <path d="M8 2.82a1 1 0 0 1 .804-.98l3-.6A1 1 0 0 1 13 2.22V4L8 5V2.82z" />
                  </svg>
                  Generate Music
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

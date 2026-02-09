"use client";

import { useState, useEffect } from "react";
import type { StatusState, SavedPersona } from "@/app/types";
import { IN_PROGRESS_STATUSES } from "@/app/types";
import { InfoHint } from "@/components/shared/InfoHint";
import { Toggle } from "@/components/shared/Toggle";
import { PlusIcon, MinusIcon } from "@/components/shared/FormIcons";
import { useStatusPolling } from "@/hooks/useStatusPolling";
import { useModelHighlight } from "@/hooks/useModelHighlight";
import { usePersonas } from "@/hooks/usePersonas";
import {
  MODELS,
  MODEL_CHAR_LIMITS,
  MODEL_DESCRIPTIONS,
  DEFAULTS,
  clampStep,
  INPUT_CLASS,
  SELECT_CLASS,
  NUMBER_WRAPPER_CLASS,
  STEPPER_BTN,
  type ModelKey,
} from "@/lib/generation-constants";

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
  const [defaultParamFlag, setDefaultParamFlag] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [style, setStyle] = useState("");
  const [title, setTitle] = useState("");
  const [continueAt, setContinueAt] = useState<number | "">(60);
  const [negativeTags, setNegativeTags] = useState("");
  const [vocalGender, setVocalGender] = useState<"m" | "f" | "d">("m");
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [styleWeight, setStyleWeight] = useState(DEFAULTS.styleWeight);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(DEFAULTS.weirdnessConstraint);
  const [audioWeight, setAudioWeight] = useState(DEFAULTS.audioWeight);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { startPolling, stopPolling, setError } = useStatusPolling({ setStatusState });
  const modelHighlight = useModelHighlight(model);
  const personas = usePersonas(personasProp);

  // Reset form when resetKey changes
  useEffect(() => {
    if (resetKey === 0) return;
    setDefaultParamFlag(false);
    setPrompt("");
    setModel("");
    setStyle("");
    setTitle("");
    setContinueAt(60);
    setNegativeTags("");
    setVocalGender("m");
    setSelectedPersonaId("");
    setStyleWeight(DEFAULTS.styleWeight);
    setWeirdnessConstraint(DEFAULTS.weirdnessConstraint);
    setAudioWeight(DEFAULTS.audioWeight);
  }, [resetKey]);

  // Populate form from the selected track's generation data
  useEffect(() => {
    if (!loadTaskId?.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/generate/generation?taskId=${encodeURIComponent(loadTaskId.trim())}`
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const g = data?.generation;
        if (!g || typeof g !== "object") return;
        setDefaultParamFlag(g.defaultParamFlag === true);
        setPrompt(typeof g.prompt === "string" ? g.prompt : "");
        setModel(typeof g.model === "string" && MODELS.includes(g.model) ? g.model : "");
        setStyle(typeof g.style === "string" ? g.style : "");
        setTitle(typeof g.title === "string" ? g.title : "");
        setContinueAt(typeof g.continueAt === "number" && g.continueAt > 0 ? g.continueAt : 60);
        setNegativeTags(typeof g.negativeTags === "string" ? g.negativeTags : "");
        setVocalGender(g.vocalGender === "f" ? "f" : g.vocalGender === "d" ? "d" : "m");
        setSelectedPersonaId(typeof g.personaId === "string" ? g.personaId : "");
        setStyleWeight(typeof g.styleWeight === "number" ? g.styleWeight : DEFAULTS.styleWeight);
        setWeirdnessConstraint(
          typeof g.weirdnessConstraint === "number" ? g.weirdnessConstraint : DEFAULTS.weirdnessConstraint
        );
        setAudioWeight(typeof g.audioWeight === "number" ? g.audioWeight : DEFAULTS.audioWeight);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTaskId]);

  const isGenerating =
    statusState != null && IN_PROGRESS_STATUSES.includes(statusState.status as (typeof IN_PROGRESS_STATUSES)[number]);

  const noAudioSelected = !selectedAudioId?.trim();
  const missingCustomFields =
    prompt.trim() === "" || style.trim() === "" || title.trim() === "" || !model || continueAt === "" || Number(continueAt) <= 0;
  const invalidForm = noAudioSelected || (defaultParamFlag ? missingCustomFields : false);

  const charLimits = MODEL_CHAR_LIMITS[model as ModelKey] ?? MODEL_CHAR_LIMITS.V4;
  const promptLimit = charLimits.prompt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isGenerating || invalidForm) return;
    setIsSubmitting(true);
    setStatusState(null);
    stopPolling();
    try {
      const body: Record<string, unknown> = {
        audioId: selectedAudioId!.trim(),
        defaultParamFlag,
      };
      if (defaultParamFlag) {
        body.model = model;
        body.prompt = prompt;
        body.style = style;
        body.title = title;
        body.continueAt = Number(continueAt);
        if (negativeTags) body.negativeTags = negativeTags;
        body.vocalGender = vocalGender;
        if (selectedPersonaId.trim()) body.personaId = selectedPersonaId.trim();
        body.styleWeight = styleWeight;
        body.weirdnessConstraint = weirdnessConstraint;
        body.audioWeight = audioWeight;
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
        setError("No task ID returned");
        return;
      }
      setStatusState({ taskId, status: "PENDING", tracks: [] });
      startPolling(taskId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || isGenerating;

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
          {/* Default Param Flag toggle */}
          <div className="flex flex-wrap gap-6">
            <Toggle label="Use Custom Parameters" on={defaultParamFlag} onChange={setDefaultParamFlag} />
          </div>

          {defaultParamFlag && (
            <>
              {/* Continue At */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm text-gray-400">
                    Continue At (seconds)<span className="text-red-500"> *</span>
                  </label>
                  <InfoHint
                    text="Time point in source track"
                    tooltip="The time point (in seconds) from which to start extending the music. Must be greater than 0 and less than the total duration of the source audio."
                    id="continue-at-tooltip"
                    tooltipShiftRight={60}
                  />
                </div>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={continueAt}
                  onChange={(e) => setContinueAt(e.target.value === "" ? "" : Number(e.target.value))}
                  className={INPUT_CLASS}
                  placeholder="60"
                />
              </div>

              {/* Prompt */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm text-gray-400">
                    Prompt<span className="text-red-500"> *</span>
                  </label>
                  <InfoHint
                    text="Description of the desired audio extension content"
                    tooltip={`Max ${promptLimit} characters`}
                    id="extend-prompt-limit-tooltip"
                    compact
                    highlighted={modelHighlight}
                  />
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  className={INPUT_CLASS}
                  placeholder="Extend the music with more relaxing notes and a gentle bridge section"
                />
              </div>

              {/* Model */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm text-gray-400">Model</label>
                  <span aria-label="Model version">
                    <InfoHint
                      text={MODEL_DESCRIPTIONS[model as ModelKey] ?? MODEL_DESCRIPTIONS.V4}
                      tooltip="Options"
                      id="extend-model-version-tooltip"
                      compact
                    />
                  </span>
                </div>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {!model && <option value="">Select model</option>}
                  {MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm text-gray-400">
                    Title<span className="text-red-500"> *</span>
                  </label>
                  <InfoHint
                    text="Title for the generated music track"
                    tooltip="Max 80 characters"
                    id="extend-title-limit-tooltip"
                    compact
                  />
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Peaceful Piano Extended"
                />
              </div>

              {/* Style */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm text-gray-400">
                    Style<span className="text-red-500"> *</span>
                  </label>
                  {charLimits && (
                    <InfoHint
                      text="Music style specification for the generated audio"
                      tooltip={`Max ${charLimits.style} characters`}
                      id="extend-style-limit-tooltip"
                      compact
                      highlighted={modelHighlight}
                    />
                  )}
                </div>
                <input
                  type="text"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="e.g. Classical, Pop, Jazz"
                />
              </div>

              {/* Negative Tags */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm text-gray-400">Negative Tags</label>
                  <InfoHint
                    text="Exclude styles"
                    tooltip="Music styles or traits to exclude from the extended audio. Optional."
                    id="extend-negative-tags-tooltip"
                    tooltipShiftRight={60}
                  />
                </div>
                <input
                  type="text"
                  value={negativeTags}
                  onChange={(e) => setNegativeTags(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Heavy Metal, Upbeat Drums"
                />
              </div>

              {/* Vocal Gender */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm text-gray-400">Vocal Gender</label>
                  <InfoHint
                    text="Only affects vocals"
                    tooltip="Increases probability of male/female voice; does not guarantee it."
                    id="extend-vocal-gender-tooltip"
                    tooltipShiftRight={34}
                  />
                </div>
                <fieldset>
                  <div className="flex gap-4">
                    {(["m", "f", "d"] as const).map((g) => (
                      <label key={g} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="extendVocalGender"
                          checked={vocalGender === g}
                          onChange={() => setVocalGender(g)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{g === "m" ? "Male" : g === "f" ? "Female" : "Duet"}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              {/* Persona */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm text-gray-400">Persona</label>
                  <InfoHint
                    text="Apply to the extended music"
                    tooltip="Use this to apply a specific persona style to your music extension."
                    id="extend-persona-tooltip"
                    compact
                  />
                </div>
                <select
                  value={selectedPersonaId}
                  onChange={(e) => setSelectedPersonaId(e.target.value)}
                  className={SELECT_CLASS}
                  aria-label="Select persona"
                >
                  <option value="">No persona</option>
                  {personas.map((p) => (
                    <option key={p.personaId} value={p.personaId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Advanced Controls */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Style Weight",
                    value: styleWeight,
                    set: setStyleWeight,
                    tooltip: "Strength of adherence to style. Range 0\u20131, up to 2 decimals.",
                    tooltipCenter: true,
                  },
                  {
                    label: "Weirdness",
                    value: weirdnessConstraint,
                    set: setWeirdnessConstraint,
                    tooltip: "Controls creative deviation. Range 0\u20131, up to 2 decimals.",
                    tooltipCenter: true,
                  },
                  {
                    label: "Audio Weight",
                    value: audioWeight,
                    set: setAudioWeight,
                    tooltip: "Balance weight for audio features. Range 0\u20131, up to 2 decimals.",
                    tooltipCenter: true,
                  },
                ].map(({ label, value, set, tooltip, tooltipCenter }) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center gap-0.5">
                      <label className="text-sm text-gray-400">{label}</label>
                      {tooltip && (
                        <InfoHint
                          text=""
                          tooltip={tooltip}
                          id={`extend-${label.toLowerCase().replace(/\s+/g, "-")}-tooltip`}
                          compact={false}
                          tooltipCenter={tooltipCenter}
                        />
                      )}
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
            </>
          )}

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || isGenerating || invalidForm}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
            >
              {isSubmitting || isGenerating ? (
                <>
                  <span
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-white"
                    aria-hidden
                  />
                  {isSubmitting ? "Starting\u2026" : "Extending\u2026"}
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

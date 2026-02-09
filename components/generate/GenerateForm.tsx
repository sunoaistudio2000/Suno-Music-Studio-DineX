"use client";

import { useState, useEffect } from "react";
import type { StatusState } from "@/app/types";
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

type GenerateFormProps = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  /** When set, fetch this generation from the database and populate the form. */
  loadTaskId?: string | null;
  /** Increment to reset the form to defaults. */
  resetKey?: number;
};

export function GenerateForm({ statusState, setStatusState, loadTaskId, resetKey = 0 }: GenerateFormProps) {
  const [prompt, setPrompt] = useState(DEFAULTS.prompt);
  const [customMode, setCustomMode] = useState(DEFAULTS.customMode);
  const [instrumental, setInstrumental] = useState(DEFAULTS.instrumental);
  const [model, setModel] = useState(DEFAULTS.model);
  const [style, setStyle] = useState(DEFAULTS.style);
  const [title, setTitle] = useState(DEFAULTS.title);
  const [negativeTags, setNegativeTags] = useState(DEFAULTS.negativeTags);
  const [vocalGender, setVocalGender] = useState<"m" | "f" | "d">(DEFAULTS.vocalGender);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [styleWeight, setStyleWeight] = useState(DEFAULTS.styleWeight);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(DEFAULTS.weirdnessConstraint);
  const [audioWeight, setAudioWeight] = useState(DEFAULTS.audioWeight);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { startPolling, stopPolling, setError } = useStatusPolling({ setStatusState });
  const modelHighlight = useModelHighlight(model);
  const personas = usePersonas();

  useEffect(() => {
    if (resetKey === 0) return;
    setPrompt(DEFAULTS.prompt);
    setCustomMode(DEFAULTS.customMode);
    setInstrumental(DEFAULTS.instrumental);
    setModel(DEFAULTS.model);
    setStyle(DEFAULTS.style);
    setTitle(DEFAULTS.title);
    setNegativeTags(DEFAULTS.negativeTags);
    setVocalGender(DEFAULTS.vocalGender);
    setSelectedPersonaId("");
    setStyleWeight(DEFAULTS.styleWeight);
    setWeirdnessConstraint(DEFAULTS.weirdnessConstraint);
    setAudioWeight(DEFAULTS.audioWeight);
  }, [resetKey]);

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
        setPrompt(typeof g.prompt === "string" ? g.prompt : DEFAULTS.prompt);
        setCustomMode(Boolean(g.customMode));
        setInstrumental(Boolean(g.instrumental));
        setModel(typeof g.model === "string" && MODELS.includes(g.model) ? g.model : DEFAULTS.model);
        setStyle(typeof g.style === "string" ? g.style : DEFAULTS.style);
        setTitle(typeof g.title === "string" ? g.title : DEFAULTS.title);
        setNegativeTags(typeof g.negativeTags === "string" ? g.negativeTags : DEFAULTS.negativeTags);
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
  const missingStyleOrTitle = instrumental && (style.trim() === "" || title.trim() === "");
  const missingStylePromptOrTitle =
    !instrumental && (style.trim() === "" || prompt.trim() === "" || title.trim() === "");
  const invalidForm = customMode
    ? (instrumental ? missingStyleOrTitle : missingStylePromptOrTitle)
    : prompt.trim() === "";
  const charLimits = MODEL_CHAR_LIMITS[model as ModelKey];
  const promptLimit = customMode ? charLimits.prompt : 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isGenerating) return;
    setIsSubmitting(true);
    setStatusState(null);
    stopPolling();
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          customMode
            ? {
                prompt,
                customMode,
                instrumental,
                model,
                style,
                title,
                negativeTags: negativeTags || undefined,
                vocalGender: !instrumental ? vocalGender : undefined,
                personaId: !instrumental && selectedPersonaId.trim() ? selectedPersonaId.trim() : undefined,
                styleWeight,
                weirdnessConstraint,
                audioWeight,
              }
            : {
                prompt,
                customMode,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        const credits = res.status === 402 || data.code === 402;
        const fallback = credits ? "Your balance isn't enough to run this request. Please top up to continue." : "Generation failed";
        const displayMessage = (data.error ?? data.message ?? data.msg ?? fallback);
        const msg = typeof displayMessage === "string" ? displayMessage : "Generation failed";
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
      <h2 className="mb-4 text-lg font-semibold text-gray-200">Generate</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm text-gray-400">
              Prompt{(!customMode || !instrumental) && <span className="text-red-500"> *</span>}
            </label>
            <InfoHint
            text="Description of the desired audio content"
            tooltip={`Max ${promptLimit} characters`}
            id="prompt-limit-tooltip"
            compact
            highlighted={modelHighlight}
          />
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            className={INPUT_CLASS}
            placeholder="A calm and relaxing piano track..."
          />
        </div>

        <div className="flex flex-wrap gap-6">
          <Toggle label="Custom Mode" on={customMode} onChange={setCustomMode} />
          {customMode && (
            <Toggle label="Instrumental" on={instrumental} onChange={setInstrumental} />
          )}
        </div>

        {customMode && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-gray-400">Model</label>
              <span aria-label="Model version">
                <InfoHint
                  text={MODEL_DESCRIPTIONS[model as ModelKey] ?? MODEL_DESCRIPTIONS.V4}
                  tooltip="Options"
                  id="model-version-tooltip"
                  compact
                />
              </span>
            </div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={SELECT_CLASS}
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}

        {customMode && (
          <>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm text-gray-400">
                  Title<span className="text-red-500"> *</span>
                </label>
                <InfoHint
                text="Title for the generated music track"
                tooltip="Max 80 characters"
                id="title-limit-tooltip"
                compact
              />
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Peaceful Piano Meditation"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm text-gray-400">
                  Style<span className="text-red-500"> *</span>
                </label>
                {charLimits && (
                <InfoHint
                  text="Music style specification for the generated audio"
                  tooltip={`Max ${charLimits.style} characters`}
                  id="style-limit-tooltip"
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
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm text-gray-400">Negative Tags</label>
                <InfoHint
                  text="Exclude styles"
                  tooltip="Music styles or traits to exclude from the generated audio. Optional. Use to avoid specific styles."
                  id="negative-tags-tooltip"
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
            {!instrumental && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm text-gray-400">
                    Vocal Gender
                  </label>
                  <InfoHint
                    text="Only affects vocals"
                    tooltip="Increases probability of male/female voice; does not guarantee it."
                    id="vocal-gender-tooltip"
                    tooltipShiftRight={34}
                  />
                </div>
                <fieldset>
                  <div className="flex gap-4">
                    {(["m", "f", "d"] as const).map((g) => (
                      <label key={g} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="vocalGender"
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
            )}
            {!instrumental && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm text-gray-400">Persona</label>
                  <InfoHint
                    text="Apply to the generated music"
                    tooltip="Use this to apply a specific persona style to your music generation."
                    id="persona-tooltip"
                    compact
                  />
                </div>
                <select
                  value={selectedPersonaId}
                  onChange={(e) => setSelectedPersonaId(e.target.value)}
                  className={SELECT_CLASS}
                  aria-label="Select persona for vocals"
                >
                  <option value="">No persona</option>
                  {personas.map((p) => (
                    <option key={p.personaId} value={p.personaId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {customMode && (
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Style Weight",
              value: styleWeight,
              set: setStyleWeight,
              tooltip:
                "Strength of adherence to style. Range 0–1, up to 2 decimals.",
              tooltipCenter: true,
            },
            {
              label: "Weirdness",
              value: weirdnessConstraint,
              set: setWeirdnessConstraint,
              tooltip: "Controls creative deviation. Range 0–1, up to 2 decimals.",
              tooltipCenter: true,
            },
            {
              label: "Audio Weight",
              value: audioWeight,
              set: setAudioWeight,
              tooltip: "Balance weight for audio features. Range 0–1, up to 2 decimals.",
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
                    id={`${label.toLowerCase().replace(/\s+/g, "-")}-tooltip`}
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
        )}

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
                {isSubmitting ? "Starting…" : "Generating…"}
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

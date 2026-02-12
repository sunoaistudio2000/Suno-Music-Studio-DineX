"use client";

import type { ExtendFormState } from "@/hooks/useExtendFormState";
import { InfoHint } from "@/components/shared/InfoHint";
import { PlusIcon, MinusIcon } from "@/components/shared/FormIcons";
import {
  MODELS,
  MODEL_DESCRIPTIONS,
  clampStep,
  INPUT_CLASS,
  SELECT_CLASS,
  NUMBER_WRAPPER_CLASS,
  STEPPER_BTN,
  type ModelKey,
} from "@/lib/generation-constants";

type CustomModeFieldsProps = {
  /** Form state returned by useExtendFormState. */
  fs: ExtendFormState;
  /** Prefix for unique tooltip IDs to avoid collisions between forms. */
  idPrefix: string;
  /** HTML name for the vocal-gender radio group. */
  radioGroupName?: string;
  /** Whether to show the Continue At field. Defaults to true. Set false for Generate Music. */
  showContinueAt?: boolean;
};

export function CustomModeFields({
  fs,
  idPrefix,
  radioGroupName,
  showContinueAt = true,
}: CustomModeFieldsProps) {
  const radioName = radioGroupName ?? `${idPrefix}VocalGender`;

  return (
    <>
      {/* Continue At (only for Extend forms, not Generate) */}
      {showContinueAt && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm text-gray-400">
              Continue At (seconds)<span className="text-red-500"> *</span>
            </label>
            <InfoHint
              text="Time point in source track"
              tooltip="The time point (in seconds) from which to start extending the music. Must be greater than 0 and less than the total duration of the source audio."
              id={`${idPrefix}-continue-at-tooltip`}
              tooltipShiftRight={60}
            />
          </div>
          <input
            type="number"
            min={1}
            step={1}
            value={fs.continueAt}
            onChange={(e) => fs.setContinueAt(e.target.value === "" ? "" : Number(e.target.value))}
            className={INPUT_CLASS}
            placeholder="60"
          />
        </div>
      )}

      {/* Model */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm text-gray-400">Model</label>
          <span aria-label="Model version">
            <InfoHint
              text={MODEL_DESCRIPTIONS[fs.model as ModelKey] ?? MODEL_DESCRIPTIONS.V4}
              tooltip="Options"
              id={`${idPrefix}-model-version-tooltip`}
              compact
            />
          </span>
        </div>
        <select
          value={fs.model}
          onChange={(e) => fs.setModel(e.target.value)}
          className={SELECT_CLASS}
        >
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
            id={`${idPrefix}-title-limit-tooltip`}
            compact
          />
        </div>
        <input
          type="text"
          value={fs.title}
          onChange={(e) => fs.setTitle(e.target.value)}
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
          {fs.charLimits && (
            <InfoHint
              text="Music style specification for the generated audio"
              tooltip={`Max ${fs.charLimits.style} characters`}
              id={`${idPrefix}-style-limit-tooltip`}
              compact
              highlighted={fs.modelHighlight}
            />
          )}
        </div>
        <input
          type="text"
          value={fs.style}
          onChange={(e) => fs.setStyle(e.target.value)}
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
            id={`${idPrefix}-negative-tags-tooltip`}
            tooltipShiftRight={60}
          />
        </div>
        <input
          type="text"
          value={fs.negativeTags}
          onChange={(e) => fs.setNegativeTags(e.target.value)}
          className={INPUT_CLASS}
          placeholder="Heavy Metal, Upbeat Drums"
        />
      </div>

      {/* Vocal Gender (hidden when instrumental) */}
      {!fs.instrumental && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm text-gray-400">Vocal Gender</label>
            <InfoHint
              text="Only affects vocals"
              tooltip="Increases probability of male/female/duet; does not guarantee it."
              id={`${idPrefix}-vocal-gender-tooltip`}
              tooltipShiftRight={34}
            />
          </div>
          <fieldset>
            <div className="flex gap-4">
              {(["m", "f", "d"] as const).map((g) => (
                <label key={g} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name={radioName}
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
      )}

      {/* Persona (hidden when instrumental) */}
      {!fs.instrumental && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm text-gray-400">Persona</label>
            <InfoHint
              text="Apply to the extended music"
              tooltip="Use this to apply a specific persona style to your music extension."
              id={`${idPrefix}-persona-tooltip`}
              compact
            />
          </div>
          <select
            value={fs.selectedPersonaId}
            onChange={(e) => fs.setSelectedPersonaId(e.target.value)}
            className={SELECT_CLASS}
            aria-label="Select persona"
          >
            <option value="">No persona</option>
            {fs.personas.map((p) => (
              <option key={p.personaId} value={p.personaId}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Advanced Controls */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Style Weight",
            value: fs.styleWeight,
            set: fs.setStyleWeight,
            tooltip: "Strength of adherence to style. Range 0\u20131, up to 2 decimals.",
            tooltipCenter: true,
          },
          {
            label: "Weirdness",
            value: fs.weirdnessConstraint,
            set: fs.setWeirdnessConstraint,
            tooltip: "Controls creative deviation. Range 0\u20131, up to 2 decimals.",
            tooltipCenter: true,
          },
          {
            label: "Audio Weight",
            value: fs.audioWeight,
            set: fs.setAudioWeight,
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
                  id={`${idPrefix}-${label.toLowerCase().replace(/\s+/g, "-")}-tooltip`}
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
  );
}

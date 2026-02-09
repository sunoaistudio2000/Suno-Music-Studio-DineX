/** Shared constants for Generate and Extend forms. */

export const MODELS = ["V4", "V4_5", "V4_5PLUS", "V4_5ALL", "V5"] as const;

export type ModelKey = (typeof MODELS)[number];

export const MODEL_CHAR_LIMITS: Record<ModelKey, { prompt: number; style: number }> = {
  V4: { prompt: 3000, style: 200 },
  V4_5: { prompt: 5000, style: 1000 },
  V4_5PLUS: { prompt: 5000, style: 1000 },
  V4_5ALL: { prompt: 5000, style: 1000 },
  V5: { prompt: 5000, style: 1000 },
};

/** Model version tooltip text (description only, no version prefix). */
export const MODEL_DESCRIPTIONS: Record<ModelKey, string> = {
  V5: "Superior musical expression, faster generation",
  V4_5PLUS: "Delivers richer sound, new ways to create, max 8 min",
  V4_5: "Enables smarter prompts, faster generations, max 8 min",
  V4_5ALL: "ALL enables smarter prompts, faster generations, max 8 min",
  V4: "Improves vocal quality, max 4 min",
};

export const DEFAULTS = {
  prompt: "A calm and relaxing piano track with soft melodies",
  customMode: true,
  instrumental: true,
  model: "V4",
  style: "Classical",
  title: "Peaceful Piano Meditation",
  negativeTags: "Heavy Metal, Upbeat Drums",
  vocalGender: "m" as const,
  styleWeight: 0.65,
  weirdnessConstraint: 0.65,
  audioWeight: 0.65,
};

/** Clamp a 0-1 value after applying a delta, rounding to 2 decimals. */
export function clampStep(v: number, delta: number): number {
  return Math.max(0, Math.min(1, Math.round((v + delta) * 100) / 100));
}

/** Shared CSS classes for form inputs. */
export const INPUT_CLASS =
  "w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-[#f5f5f5] placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
export const SELECT_CLASS =
  "w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] pl-3 pr-8 py-2 text-[#f5f5f5] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
export const NUMBER_WRAPPER_CLASS =
  "flex rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500";
export const STEPPER_BTN =
  "flex flex-1 items-center justify-center px-2 text-[#f5f5f5] hover:bg-[#2a2a2a]";

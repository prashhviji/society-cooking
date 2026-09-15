/**
 * Daily calorie + protein targets shown in onboarding step 3.
 *
 * Mifflin-St Jeor BMR × a light activity factor, then a goal modifier.
 * The user can override both numbers; this module only proposes them.
 */

import type { Goal, UserProfile } from "@/lib/types";

/** Lightly active — the app has no activity question, so this is a constant. */
export const ACTIVITY_FACTOR = 1.4;

/** kcal added to (or removed from) maintenance for each goal. */
export const GOAL_KCAL_MODIFIER: Record<Goal, number> = {
  muscle_gain: 300,
  weight_loss: -400,
  improve_energy: 100,
  maintenance: 0,
  balanced: 0,
};

/** Grams of protein per kg of body weight for each goal. */
export const GOAL_PROTEIN_PER_KG: Record<Goal, number> = {
  muscle_gain: 1.8,
  weight_loss: 1.6,
  improve_energy: 1.2,
  maintenance: 1.2,
  balanced: 1.2,
};

/** Used when the user skipped their weight. */
export const FALLBACK_PROTEIN_G = 130;
/** Used when height / weight / age are not all known. */
export const FALLBACK_KCAL = 2000;

export interface ComputedTargets {
  dailyCalorieTarget: number;
  proteinTargetG: number;
  /** True when height, weight and age were all available (a real estimate). */
  personalised: boolean;
}

/** Mifflin-St Jeor resting energy expenditure, kcal/day. */
export function mifflinStJeor(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender?: UserProfile["gender"];
}): number {
  const { weightKg, heightCm, age, gender } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === "male") return base + 5;
  if (gender === "female") return base - 161;
  // "other" / "prefer not to say" / unknown: the average of the two formulas.
  return base - 78;
}

/** Round to the nearest 10 kcal so the number reads like a target, not a maths result. */
function roundKcal(kcal: number): number {
  return Math.max(1200, Math.round(kcal / 10) * 10);
}

/**
 * Propose `dailyCalorieTarget` / `proteinTargetG` from what the draft knows.
 * Always returns usable numbers — see the `FALLBACK_*` constants.
 */
export function computeTargets(draft: Partial<UserProfile>): ComputedTargets {
  const goal: Goal = draft.goal ?? "balanced";
  const modifier = GOAL_KCAL_MODIFIER[goal];
  const { weightKg, heightCm, age } = draft;
  const personalised = Boolean(weightKg && heightCm && age);

  const dailyCalorieTarget = personalised
    ? roundKcal(
        mifflinStJeor({
          weightKg: weightKg as number,
          heightCm: heightCm as number,
          age: age as number,
          gender: draft.gender,
        }) *
          ACTIVITY_FACTOR +
          modifier,
      )
    : roundKcal(FALLBACK_KCAL + modifier);

  const proteinTargetG = weightKg
    ? Math.round(weightKg * GOAL_PROTEIN_PER_KG[goal])
    : FALLBACK_PROTEIN_G;

  return { dailyCalorieTarget, proteinTargetG, personalised };
}

/**
 * The onboarding draft: everything the wizard collects before it ever touches
 * `useProfileStore`. `/profile/edit` reuses the same shape so the step
 * components work unchanged in both screens.
 */

import type { UserProfile } from "@/lib/types";
import { DEFAULT_PRIORITIES } from "./options";

/** A profile under construction — nothing is required until the step validates. */
export type ProfileDraft = Partial<UserProfile>;

export type DraftPatch = ProfileDraft;

export const TOTAL_STEPS = 7;

export interface StepMeta {
  /** 1-based step number, also the `?step=` value. */
  step: number;
  title: string;
  caption: string;
  /** Short tab label for `/profile/edit`. */
  tab: string;
}

export const STEPS: StepMeta[] = [
  { step: 1, title: "About you", caption: "A few basics so we can size your meals.", tab: "About" },
  { step: 2, title: "Your diet", caption: "What can we put on your plate?", tab: "Diet" },
  { step: 3, title: "Your goal", caption: "What are you cooking towards?", tab: "Goals" },
  { step: 4, title: "Your kitchen", caption: "We only plan meals you can actually cook.", tab: "Kitchen" },
  { step: 5, title: "Your taste", caption: "Flavours you love — and ones to avoid.", tab: "Taste" },
  { step: 6, title: "Budget & time", caption: "How much you spend and how long you cook.", tab: "Budget" },
  { step: 7, title: "Priorities", caption: "What matters most when we plan your week.", tab: "Priorities" },
];

/** A blank draft for a brand-new user. */
export function emptyDraft(): ProfileDraft {
  return {
    name: "",
    allergies: [],
    restrictions: [],
    equipment: [],
    favoriteFoods: [],
    dislikedIngredients: [],
    cuisines: [],
    spiceLevel: 2,
    budgetMonthly: 5000,
    skill: "beginner",
    timeAvailability: "medium",
    priorities: [...DEFAULT_PRIORITIES],
    servingsDefault: 2,
    currency: "INR",
  };
}

/** Pre-fill the wizard (or the edit form) from an existing profile. */
export function draftFromProfile(profile: UserProfile): ProfileDraft {
  const draft: ProfileDraft = { ...emptyDraft(), ...profile };
  // Identity and lifecycle fields belong to the store, not to the draft.
  delete draft.id;
  delete draft.onboardingComplete;
  delete draft.createdAt;
  delete draft.updatedAt;
  return draft;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type StepErrors = Partial<
  Record<"name" | "diet" | "goal" | "equipment" | "budgetMonthly", string>
>;

/** Inline errors for one step. An empty object means the step is complete. */
export function validateStep(step: number, draft: ProfileDraft): StepErrors {
  switch (step) {
    case 1:
      return draft.name?.trim() ? {} : { name: "Please tell us your name." };
    case 2:
      return draft.diet ? {} : { diet: "Pick the diet that fits you best." };
    case 3:
      return draft.goal ? {} : { goal: "Pick one goal — you can change it later." };
    case 4:
      return draft.equipment && draft.equipment.length > 0
        ? {}
        : { equipment: "Select at least one thing you cook with." };
    case 6:
      return draft.budgetMonthly && draft.budgetMonthly > 0
        ? {}
        : { budgetMonthly: "Enter a monthly budget above ₹0." };
    default:
      return {};
  }
}

/** The first step that still has an error, or `null` when the draft is complete. */
export function firstInvalidStep(draft: ProfileDraft): number | null {
  for (let step = 1; step <= TOTAL_STEPS; step += 1) {
    if (Object.keys(validateStep(step, draft)).length > 0) return step;
  }
  return null;
}

/** `true` when every step validates. */
export function isDraftComplete(draft: ProfileDraft): boolean {
  return firstInvalidStep(draft) === null;
}

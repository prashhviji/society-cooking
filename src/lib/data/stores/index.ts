/**
 * Barrel for every Zustand store.
 *
 * Importing this module registers all persisted stores with the hydration gate
 * (`useHydrated()`), so `AppProviders` importing it once is enough.
 */

export {
  PROFILE_STORE_KEY,
  demoUserId,
  useProfileStore,
  type ProfileState,
} from "./profile";

export {
  RECIPE_STORE_KEY,
  totalTimeMin,
  useRecipeStore,
  type RecipeFilters,
  type RecipeState,
} from "./recipes";

export {
  DEFAULT_GRAMS_PER_PIECE,
  DEFAULT_SHELF_LIFE_DAYS,
  PANTRY_STORE_KEY,
  fromGrams,
  gramsPerPieceFor,
  pantryItemGrams,
  toGrams,
  usePantryStore,
  type PantryAddInput,
  type PantryState,
} from "./pantry";

export {
  MEAL_ORDER,
  PLAN_STORE_KEY,
  sortMeals,
  usePlanStore,
  type GenerateOptions,
  type PlanState,
  type ScheduleChangeInput,
} from "./plan";

export {
  GROCERY_STORE_KEY,
  useGroceryStore,
  type GroceryState,
} from "./grocery";

export {
  COOK_STORE_KEY,
  MAX_SESSIONS,
  MAX_TEMP_SAMPLES,
  capTemperatureHistory,
  useCookStore,
  type CookState,
} from "./cook";

export {
  FEEDBACK_STORE_KEY,
  useFeedbackStore,
  type FeedbackInput,
  type FeedbackState,
} from "./feedback";

export {
  PREFERENCE_STORE_KEY,
  usePreferenceStore,
  type PreferenceState,
} from "./preference";

/** Every persisted store key, in the order they should be reset. */
export const STORE_KEYS = [
  "cookwise:profile",
  "cookwise:recipes",
  "cookwise:pantry",
  "cookwise:plans",
  "cookwise:grocery",
  "cookwise:cook",
  "cookwise:feedback",
  "cookwise:preferences",
] as const;

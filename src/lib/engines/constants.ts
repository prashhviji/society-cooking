/**
 * Tunable constants for the Cookwise engines.
 *
 * Everything the heuristics depend on lives here so a product person can read
 * (and a test can pin) the numbers without digging through the algorithms.
 */

import type {
  Equipment,
  ID,
  IngredientCategory,
  MealType,
  Priority,
  Recipe,
  RecipeTag,
  TimeAvailability,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

/** The three slots a week plan fills for every day. */
export const PLAN_MEAL_TYPES: readonly MealType[] = [
  "breakfast",
  "lunch",
  "dinner",
] as const;

export const DAYS_PER_WEEK = 7;
export const SLOTS_PER_WEEK = DAYS_PER_WEEK * PLAN_MEAL_TYPES.length; // 21

/** Share of the daily calorie target that belongs to each slot. */
export const MEAL_KCAL_SPLIT: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.4,
  dinner: 0.35,
  snack: 0.1,
};

/** Weight given to the 1st, 2nd, … priority in `profile.priorities`. Sums to 1. */
export const PRIORITY_WEIGHTS: readonly number[] = [0.35, 0.25, 0.2, 0.12, 0.08];

/** Used to back-fill priorities the user did not rank. */
export const DEFAULT_PRIORITY_ORDER: readonly Priority[] = [
  "nutrition",
  "time",
  "budget",
  "taste",
  "waste_reduction",
] as const;

/** Total prep+cook minutes tolerated per `timeAvailability`. */
export const TIME_LIMIT_MIN: Record<TimeAvailability, number> = {
  low: 20,
  medium: 35,
  high: Number.POSITIVE_INFINITY,
  /** "varies" is treated as `medium`-ish on weekdays and unrestricted at weekends. */
  varies: 30,
};

/** Monday..Friday are dayIndex 0..4. */
export const LAST_WEEKDAY_INDEX = 4;

/** Equipment that any stove-owning kitchen can substitute for one another. */
export const BASIC_STOVE_EQUIPMENT: readonly Equipment[] = [
  "stove",
  "frying_pan",
  "kadai",
  "tawa",
] as const;

/** `budgetMonthly / WEEKS_PER_MONTH` is the weekly grocery allowance. */
export const WEEKS_PER_MONTH = 4.3;

/** Pantry stock expiring within this many days earns a waste-reduction bonus. */
export const WASTE_WINDOW_DAYS = 4;

/** Grams of expiring stock that saturate the waste-reduction score. */
export const WASTE_SATURATION_G = 250;

/** Repeating a recipe within this many days is penalised. */
export const VARIETY_WINDOW_DAYS = 3;

/** Penalty applied when the same recipe repeats on the same day. */
export const VARIETY_SAME_RECIPE_PENALTY = 40;
export const VARIETY_SAME_METHOD_PENALTY = 10;
export const VARIETY_SAME_CUISINE_PENALTY = 6;

/** Maximum points of seeded random jitter added to a score (breaks ties). */
export const SCORE_JITTER = 6;

/** Fallback when a `pcs` pantry item has no catalog entry. */
export const DEFAULT_GRAMS_PER_PIECE = 50;

/** Ingredients that read as "slow-release energy" for the improve_energy goal. */
export const ENERGY_INGREDIENT_HINTS: readonly string[] = [
  "oat",
  "oats",
  "banana",
  "ragi",
  "millet",
  "poha",
  "quinoa",
  "dates",
  "jaggery",
  "semolina",
  "rice",
  "barley",
] as const;

/** Short human phrase used by `explainMeal`. */
export const TAG_PHRASES: Partial<Record<RecipeTag, string>> = {
  high_protein: "high protein",
  low_cal: "light on calories",
  high_fiber: "high fibre",
  quick: "quick to make",
  budget: "budget friendly",
  comfort: "comfort food",
  one_pot: "one pot",
  kid_friendly: "kid friendly",
  guest_friendly: "great for guests",
};

/** How a `ScheduleChange.moodTags` entry biases recipe selection. */
export interface MoodSpec {
  tags: RecipeTag[];
  /** Hard-ish preference; candidates matching it are tried first. */
  match?: (r: Recipe) => boolean;
}

export const MOOD_SPECS: Record<string, MoodSpec> = {
  light: { tags: ["low_cal", "high_fiber"] },
  comfort: { tags: ["comfort", "one_pot"] },
  spicy: { tags: [], match: (r) => r.spiceLevel >= 3 },
  mild: { tags: [], match: (r) => r.spiceLevel <= 2 },
  no_cooking: {
    tags: ["quick"],
    match: (r) => r.prepTimeMin + r.cookTimeMin <= 10 || r.primaryMethod === "raw",
  },
  quick: { tags: ["quick"], match: (r) => r.prepTimeMin + r.cookTimeMin <= 20 },
  healthy: { tags: ["low_cal", "high_fiber", "high_protein"] },
  protein: { tags: ["high_protein"] },
  budget: { tags: ["budget"] },
};

/** When `eating_out` trims the rest of a weight-loss day. */
export const EATING_OUT_KCAL_FACTOR = 0.8;

// ---------------------------------------------------------------------------
// Allergens
// ---------------------------------------------------------------------------

/**
 * Allergy label (normalised: lowercase, alphanumeric only) → ingredient tokens.
 * Tokens are matched word-wise against ingredient ids and names, so "egg"
 * matches `egg` / "Eggs" but not "eggplant".
 */
export const ALLERGEN_TOKENS: Record<string, string[]> = {
  egg: ["egg"],
  eggs: ["egg"],
  dairy: [
    "milk",
    "curd",
    "yogurt",
    "yoghurt",
    "paneer",
    "ghee",
    "butter",
    "buttermilk",
    "cheese",
    "cream",
    "khoya",
  ],
  lactose: ["milk", "curd", "yogurt", "paneer", "ghee", "butter", "cheese", "cream"],
  milk: ["milk", "curd", "paneer", "ghee", "butter", "cheese", "cream"],
  nuts: [
    "peanut",
    "groundnut",
    "cashew",
    "almond",
    "walnut",
    "pistachio",
    "hazelnut",
    "pecan",
  ],
  treenuts: ["cashew", "almond", "walnut", "pistachio", "hazelnut", "pecan"],
  peanut: ["peanut", "groundnut"],
  peanuts: ["peanut", "groundnut"],
  gluten: [
    "wheat",
    "wheat flour",
    "maida",
    "atta",
    "bread",
    "pasta",
    "semolina",
    "rava",
    "barley",
    "rye",
  ],
  wheat: ["wheat", "wheat flour", "maida", "atta", "bread", "pasta", "semolina", "rava"],
  shellfish: ["prawn", "shrimp", "crab", "lobster", "squid"],
  soy: ["soy", "soya", "soya chunks", "soybean", "soyabean", "tofu"],
  soya: ["soy", "soya", "soya chunks", "soybean", "soyabean", "tofu"],
  fish: ["fish", "tuna", "salmon", "sardine", "mackerel", "pomfret"],
  sesame: ["sesame", "til"],
  mustard: ["mustard"],
};

// ---------------------------------------------------------------------------
// Grocery
// ---------------------------------------------------------------------------

/** Round a shortfall up to the next multiple of these grams / millilitres. */
export const PACK_SIZE_G: Record<IngredientCategory, number> = {
  spices: 50,
  oils: 200,
  grains: 500,
  legumes: 500,
  vegetables: 100,
  proteins: 250,
  dairy: 500,
  fruits: 100,
  nuts: 100,
  other: 100,
};

/** Per-ingredient overrides (ids that do not follow their category's pack size). */
export const PACK_SIZE_OVERRIDE_G: Record<ID, number> = {
  salt: 50,
  sugar: 500,
  "baking-soda": 50,
};

export const DEFAULT_PACK_SIZE_G = 100;

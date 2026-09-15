/**
 * Nutrient-retention reference data.
 *
 * `BASE_RETENTION` approximates the **USDA Table of Nutrient Retention Factors,
 * Release 6 (2007)** — the fraction of a nutrient that survives a given cooking
 * method, before any allowance for how long or how hot. Values are rounded to
 * the nearest 0.01 and, where the USDA table distinguishes food groups, we use
 * the vegetable/meat average that fits Indian home cooking.
 *
 * The time/temperature term on top of it is first-order degradation kinetics:
 *
 *     R = base · exp(−k(T) · Δt_min),   k(T) = k_ref · Q10^((T − 100) / 10)
 *
 * `k_ref` is the rate constant at 100 °C (from published thermal-degradation
 * studies for ascorbic acid, folate and pyridoxine); `Q10` is the classic
 * van 't Hoff temperature coefficient — ≈2 for water-soluble vitamins, ≈1.5 for
 * the more heat-stable vitamin A.
 */

import type { CookingMethod, NutrientKey, RetentionNutrient } from "@/lib/types";

export const RETENTION_NUTRIENTS: readonly RetentionNutrient[] = [
  "vitaminC",
  "vitaminB6",
  "folate",
  "vitaminA",
  "protein",
  "fat",
  "iron",
  "calcium",
  "fiber",
] as const;

/** Display order used by the retention screen (SCREENS.md §10). */
export const RETENTION_DISPLAY_ORDER: readonly RetentionNutrient[] = [
  "vitaminC",
  "vitaminB6",
  "folate",
  "protein",
  "fat",
  "iron",
  "vitaminA",
  "calcium",
  "fiber",
] as const;

export const NUTRIENT_LABELS: Record<RetentionNutrient, string> = {
  vitaminC: "Vitamin C",
  vitaminB6: "Vitamin B6",
  folate: "Folate",
  vitaminA: "Vitamin A",
  protein: "Protein",
  fat: "Fats (healthy)",
  iron: "Iron",
  calcium: "Calcium",
  fiber: "Fiber",
};

/** Which `NutritionPer100` key carries each retention nutrient. */
export const NUTRIENT_SOURCE_KEY: Record<RetentionNutrient, NutrientKey> = {
  vitaminC: "vitaminCMg",
  vitaminB6: "vitaminB6Mg",
  folate: "folateUg",
  vitaminA: "vitaminAUg",
  protein: "proteinG",
  fat: "fatG",
  iron: "ironMg",
  calcium: "calciumMg",
  fiber: "fiberG",
};

/** Typical adult daily value; used to hide nutrients a dish barely contains. */
export const DAILY_VALUE: Record<RetentionNutrient, number> = {
  vitaminC: 90, // mg
  vitaminB6: 1.7, // mg
  folate: 400, // µg
  vitaminA: 900, // µg
  protein: 50, // g
  fat: 70, // g
  iron: 18, // mg
  calcium: 1000, // mg
  fiber: 28, // g
};

/** A nutrient below this share of its daily value is omitted from the report. */
export const NEGLIGIBLE_DV_FRACTION = 0.02;

/** Weights for the overall score (ARCHITECTURE §5). Renormalised over shown nutrients. */
export const OVERALL_WEIGHTS: Record<RetentionNutrient, number> = {
  vitaminC: 0.25,
  folate: 0.15,
  vitaminB6: 0.15,
  vitaminA: 0.1,
  protein: 0.2,
  fat: 0.05,
  iron: 0.05,
  calcium: 0.025,
  fiber: 0.025,
};

type FactorRow = Record<RetentionNutrient, number>;

const ALL_RETAINED: FactorRow = {
  vitaminC: 1,
  vitaminB6: 1,
  folate: 1,
  vitaminA: 1,
  protein: 1,
  fat: 1,
  iron: 1,
  calcium: 1,
  fiber: 1,
};

/** Base retention fraction per cooking method (USDA RF Release 6, approximated). */
export const BASE_RETENTION: Record<CookingMethod, FactorRow> = {
  raw: { ...ALL_RETAINED },

  // Wet methods lose water-soluble vitamins and minerals to the cooking liquid.
  boil: {
    vitaminC: 0.55,
    folate: 0.6,
    vitaminB6: 0.7,
    vitaminA: 0.9,
    protein: 0.95,
    fat: 0.95,
    iron: 0.85,
    calcium: 0.9,
    fiber: 1.0,
  },
  simmer: {
    vitaminC: 0.65,
    folate: 0.65,
    vitaminB6: 0.75,
    vitaminA: 0.9,
    protein: 0.95,
    fat: 0.95,
    iron: 0.85,
    calcium: 0.9,
    fiber: 1.0,
  },
  steam: {
    vitaminC: 0.8,
    folate: 0.85,
    vitaminB6: 0.85,
    vitaminA: 0.95,
    protein: 0.97,
    fat: 0.97,
    iron: 0.95,
    calcium: 0.95,
    fiber: 1.0,
  },
  pressure_cook: {
    vitaminC: 0.6,
    folate: 0.7,
    vitaminB6: 0.75,
    vitaminA: 0.9,
    protein: 0.95,
    fat: 0.95,
    iron: 0.9,
    calcium: 0.92,
    fiber: 1.0,
  },

  // Dry / fat methods: little leaching, more thermal and oxidative loss.
  saute: {
    vitaminC: 0.7,
    folate: 0.75,
    vitaminB6: 0.85,
    vitaminA: 0.85,
    protein: 0.95,
    fat: 0.9,
    iron: 0.95,
    calcium: 0.95,
    fiber: 1.0,
  },
  stir_fry: {
    vitaminC: 0.75,
    folate: 0.8,
    vitaminB6: 0.85,
    vitaminA: 0.88,
    protein: 0.95,
    fat: 0.9,
    iron: 0.95,
    calcium: 0.95,
    fiber: 1.0,
  },
  shallow_fry: {
    vitaminC: 0.65,
    folate: 0.72,
    vitaminB6: 0.8,
    vitaminA: 0.82,
    protein: 0.92,
    fat: 0.88,
    iron: 0.92,
    calcium: 0.93,
    fiber: 0.98,
  },
  /** `fat: 0.85` also stands in for oil uptake changing the fat profile. */
  deep_fry: {
    vitaminC: 0.6,
    folate: 0.7,
    vitaminB6: 0.78,
    vitaminA: 0.8,
    protein: 0.9,
    fat: 0.85,
    iron: 0.9,
    calcium: 0.92,
    fiber: 0.95,
  },
  /** `protein: 0.92` reflects surface charring / Maillard losses. */
  bake: {
    vitaminC: 0.65,
    folate: 0.7,
    vitaminB6: 0.8,
    vitaminA: 0.85,
    protein: 0.92,
    fat: 0.92,
    iron: 0.95,
    calcium: 0.95,
    fiber: 1.0,
  },
  roast: {
    vitaminC: 0.65,
    folate: 0.7,
    vitaminB6: 0.78,
    vitaminA: 0.85,
    protein: 0.92,
    fat: 0.9,
    iron: 0.95,
    calcium: 0.95,
    fiber: 1.0,
  },
  grill: {
    vitaminC: 0.65,
    folate: 0.7,
    vitaminB6: 0.75,
    vitaminA: 0.83,
    protein: 0.92,
    fat: 0.88,
    iron: 0.95,
    calcium: 0.95,
    fiber: 1.0,
  },

  microwave: {
    vitaminC: 0.85,
    folate: 0.85,
    vitaminB6: 0.9,
    vitaminA: 0.95,
    protein: 0.97,
    fat: 0.97,
    iron: 0.97,
    calcium: 0.97,
    fiber: 1.0,
  },
};

/** Reference temperature for the kinetics term. */
export const T_REF_C = 100;

/** First-order rate constant at 100 °C, per minute. */
export const K_REF_PER_MIN: Record<RetentionNutrient, number> = {
  vitaminC: 0.01,
  folate: 0.007,
  vitaminB6: 0.004,
  vitaminA: 0.003,
  protein: 0,
  fat: 0,
  iron: 0,
  calcium: 0,
  fiber: 0,
};

/** van 't Hoff temperature coefficient. */
export const Q10: Record<RetentionNutrient, number> = {
  vitaminC: 2.0,
  folate: 2.0,
  vitaminB6: 2.0,
  vitaminA: 1.5,
  protein: 1,
  fat: 1,
  iron: 1,
  calcium: 1,
  fiber: 1,
};

/** Fallback pan temperature when neither a log nor a target range is available. */
export const METHOD_DEFAULT_TEMP_C: Record<CookingMethod, number> = {
  raw: 25,
  boil: 100,
  simmer: 95,
  steam: 100,
  pressure_cook: 115,
  saute: 150,
  stir_fry: 180,
  shallow_fry: 170,
  deep_fry: 180,
  bake: 180,
  roast: 200,
  grill: 220,
  microwave: 100,
};

/** Methods where a hot dry pan is expected; above this the oil and vitamins suffer. */
export const PAN_FRY_METHODS: readonly CookingMethod[] = [
  "saute",
  "stir_fry",
  "shallow_fry",
] as const;

export const SAUTE_MAX_SAFE_TEMP_C = 180;

/** Above this, surface charring starts to damage protein and fat quality. */
export const CHARRING_TEMP_C = 200;

/** Step ran longer than this multiple of its planned duration → overcooking. */
export const OVERCOOK_RATIO = 1.5;

/** Effective rate constant at temperature `tempC`. */
export function rateConstant(nutrient: RetentionNutrient, tempC: number): number {
  const kRef = K_REF_PER_MIN[nutrient];
  if (!kRef) return 0;
  return kRef * Q10[nutrient] ** ((tempC - T_REF_C) / 10);
}

/** Share of the pan's excess heat (above 100 °C) that reaches the bulk food. */
export const FOOD_HEAT_COUPLING = 0.25;
/** Bulk food never gets hotter than this while it still holds water. */
export const FOOD_TEMP_CAP_C = 140;

/**
 * Convert a measured pan temperature into the temperature the food itself
 * experiences. Water-rich food stays near 100 °C until it dries out, so only a
 * fraction of the pan's excess heat reaches it. Without this correction a
 * 190 °C stir-fry would zero every heat-labile vitamin within a minute.
 * Mirrors `effective_food_temp_c()` in the Python ML service.
 */
export function effectiveFoodTempC(panTempC: number): number {
  if (!Number.isFinite(panTempC)) return T_REF_C;
  if (panTempC <= T_REF_C) return panTempC;
  return Math.min(
    FOOD_TEMP_CAP_C,
    T_REF_C + FOOD_HEAT_COUPLING * (panTempC - T_REF_C),
  );
}

/**
 * Nutrient retention model.
 *
 * Two layers (see `retention-factors.ts` for the numbers and their sources):
 *
 *  1. **Method** — a USDA-style base retention factor per cooking method.
 *  2. **Kinetics** — first-order thermal degradation on top of it,
 *     `R *= exp(−k(T)·Δt)` with `k(T) = k_ref · Q10^((T−100)/10)`,
 *     applied per heat step and only to the ingredients already in the pan.
 *
 * Nutrients are then combined by how much of each the dish actually contains
 * (measured grams when the scale logged them, recipe grams otherwise).
 */

import type {
  ID,
  Ingredient,
  IngredientLog,
  NutrientKey,
  NutrientRetention,
  NutritionPerServing,
  Recipe,
  RecipeStep,
  RetentionEstimate,
  RetentionNutrient,
  RetentionWarning,
  StepLog,
  TempSample,
} from "@/lib/types";
import { clamp, nowIso } from "@/lib/utils";
import { round } from "./helpers";
import { indexIngredients, nutritionFromGrams, recipeGrams } from "./nutrition";
import {
  BASE_RETENTION,
  CHARRING_TEMP_C,
  DAILY_VALUE,
  METHOD_DEFAULT_TEMP_C,
  NEGLIGIBLE_DV_FRACTION,
  NUTRIENT_LABELS,
  NUTRIENT_SOURCE_KEY,
  OVERALL_WEIGHTS,
  OVERCOOK_RATIO,
  PAN_FRY_METHODS,
  RETENTION_DISPLAY_ORDER,
  RETENTION_NUTRIENTS,
  SAUTE_MAX_SAFE_TEMP_C,
  rateConstant,
  effectiveFoodTempC,
} from "./retention-factors";

export interface RetentionInput {
  recipe: Recipe;
  ingredients: Ingredient[];
  ingredientLogs: IngredientLog[];
  stepLogs: StepLog[];
  temperatureHistory: TempSample[];
  servings: number;
}

export type HintTone = "ok" | "warn" | "danger";

export interface LiveHint {
  tone: HintTone;
  message: string;
}

export function nutrientLabel(n: RetentionNutrient): string {
  return NUTRIENT_LABELS[n] ?? n;
}

/** 0..1 fraction (or a `NutrientRetention`) → whole percent. */
export function retentionPercent(r: number | NutrientRetention): number {
  const value = typeof r === "number" ? r : r.retained;
  return Math.round(clamp(value, 0, 1) * 100);
}

// ---------------------------------------------------------------------------
// Step conditions
// ---------------------------------------------------------------------------

interface StepConditions {
  step: RecipeStep;
  index: number;
  method: RecipeStep["method"];
  tempC: number;
  maxTempC: number;
  minutes: number;
  plannedMinutes: number;
  /** Was the pan inside `step.targetTempC` the whole time? */
  inTargetRange: boolean;
}

function sessionStartMs(stepLogs: readonly StepLog[]): number | undefined {
  let min: number | undefined;
  for (const log of stepLogs) {
    const t = Date.parse(log.startedAt);
    if (Number.isNaN(t)) continue;
    if (min === undefined || t < min) min = t;
  }
  return min;
}

function samplesInWindow(
  history: readonly TempSample[],
  log: StepLog | undefined,
  startMs: number | undefined,
): number[] {
  if (!history.length) return [];
  if (!log || startMs === undefined) return history.map((s) => s.tempC);
  const from = Date.parse(log.startedAt) - startMs;
  const to = log.endedAt ? Date.parse(log.endedAt) - startMs : Number.POSITIVE_INFINITY;
  if (Number.isNaN(from)) return history.map((s) => s.tempC);
  const inside = history.filter((s) => s.t >= from && s.t <= to).map((s) => s.tempC);
  return inside;
}

function resolveSteps(input: RetentionInput): StepConditions[] {
  const { recipe, stepLogs, temperatureHistory } = input;
  const startMs = sessionStartMs(stepLogs);
  const logById = new Map(stepLogs.map((l) => [l.stepId, l]));

  const steps: RecipeStep[] = [...(recipe.steps ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  // A recipe with no steps still cooked: treat it as one step of its primary method.
  if (steps.length === 0) {
    steps.push({
      id: `${recipe.id}-whole`,
      order: 1,
      title: recipe.name,
      instruction: recipe.description ?? "",
      method: recipe.primaryMethod,
      durationSec: Math.max(0, (recipe.cookTimeMin ?? 0) * 60),
    });
  }

  return steps.map((step, index) => {
    const log = logById.get(step.id);
    const method = step.method ?? recipe.primaryMethod;

    let minutes: number;
    if (log?.durationSec != null) {
      minutes = log.durationSec / 60;
    } else if (log?.startedAt && log?.endedAt) {
      minutes = Math.max(0, (Date.parse(log.endedAt) - Date.parse(log.startedAt)) / 60000);
    } else {
      minutes = (step.durationSec ?? 0) / 60;
    }
    if (!Number.isFinite(minutes) || minutes < 0) minutes = 0;

    const samples = samplesInWindow(temperatureHistory ?? [], log, startMs);
    let tempC: number;
    if (log?.avgTempC != null) {
      tempC = log.avgTempC;
    } else if (samples.length > 0) {
      tempC = samples.reduce((a, b) => a + b, 0) / samples.length;
    } else if (step.targetTempC) {
      tempC = (step.targetTempC.min + step.targetTempC.max) / 2;
    } else {
      tempC = METHOD_DEFAULT_TEMP_C[method] ?? 100;
    }

    const maxTempC =
      log?.maxTempC ?? (samples.length > 0 ? Math.max(...samples) : tempC);

    const range = step.targetTempC;
    const inTargetRange = range
      ? samples.length > 0
        ? samples.every((s) => s >= range.min && s <= range.max)
        : tempC >= range.min && tempC <= range.max
      : true;

    return {
      step,
      index,
      method,
      tempC,
      maxTempC,
      minutes,
      plannedMinutes: (step.durationSec ?? 0) / 60,
      inTargetRange,
    };
  });
}

// ---------------------------------------------------------------------------
// Core estimate
// ---------------------------------------------------------------------------

function noteFor(retained: number, tempOk: boolean): string {
  if (retained >= 0.9) return "Well preserved.";
  if (retained >= 0.75) return "Good retention!";
  if (retained >= 0.6 && tempOk) return "Optimal temperature.";
  return "Some loss due to heat. Consider shorter cooking time.";
}

export function estimateRetention(input: RetentionInput): RetentionEstimate {
  const { recipe, ingredients, ingredientLogs, servings } = input;
  const catalog = indexIngredients(ingredients);
  const conditions = resolveSteps(input);

  // ---- grams actually used, per ingredient -------------------------------
  const grams = recipeGrams(recipe, servings);
  for (const log of ingredientLogs ?? []) {
    if (log.actualGrams > 0) grams.set(log.ingredientId, log.actualGrams);
  }

  // ---- when was each ingredient added? -----------------------------------
  const addIndex = new Map<ID, number>();
  for (const c of conditions) {
    for (const add of c.step.addIngredients ?? []) {
      if (!addIndex.has(add.ingredientId)) addIndex.set(add.ingredientId, c.index);
    }
  }

  // ---- per-ingredient, per-nutrient retention ----------------------------
  const contentByNutrient: Record<RetentionNutrient, number> = {
    vitaminC: 0,
    vitaminB6: 0,
    folate: 0,
    vitaminA: 0,
    protein: 0,
    fat: 0,
    iron: 0,
    calcium: 0,
    fiber: 0,
  };
  const retainedByNutrient: Record<RetentionNutrient, number> = { ...contentByNutrient };

  for (const [ingredientId, g] of grams) {
    if (g <= 0) continue;
    const ingredient = catalog.get(ingredientId);
    if (!ingredient) continue;
    const from = addIndex.get(ingredientId) ?? 0;
    const exposed = conditions.filter((c) => c.index >= from && c.method !== "raw");
    const baseMethod = exposed[0]?.method ?? recipe.primaryMethod;

    for (const nutrient of RETENTION_NUTRIENTS) {
      const key: NutrientKey = NUTRIENT_SOURCE_KEY[nutrient];
      const per100 = ingredient.nutrition[key];
      if (typeof per100 !== "number" || per100 <= 0) continue;
      const content = (per100 * g) / 100;

      let r =
        exposed.length === 0
          ? 1
          : (BASE_RETENTION[baseMethod] ?? BASE_RETENTION.raw)[nutrient];
      for (const c of exposed) {
        const k = rateConstant(nutrient, effectiveFoodTempC(c.tempC));
        if (k > 0 && c.minutes > 0) r *= Math.exp(-k * c.minutes);
      }
      r = clamp(r, 0, 1);

      contentByNutrient[nutrient] += content;
      retainedByNutrient[nutrient] += content * r;
    }
  }

  // ---- build the report --------------------------------------------------
  const tempOk = conditions.every((c) => c.inTargetRange);
  const perServing = Math.max(1, servings);
  const nutrients: NutrientRetention[] = [];

  for (const nutrient of RETENTION_DISPLAY_ORDER) {
    const content = contentByNutrient[nutrient];
    if (content <= 0) continue;
    // Hide anything the dish barely contains.
    if (content / perServing < NEGLIGIBLE_DV_FRACTION * DAILY_VALUE[nutrient]) continue;
    const retained = clamp(retainedByNutrient[nutrient] / content, 0, 1);
    nutrients.push({
      nutrient,
      label: nutrientLabel(nutrient),
      retained: round(retained, 4),
      note: noteFor(retained, tempOk),
    });
  }

  // ---- overall: weighted mean, renormalised over the nutrients shown -----
  let wSum = 0;
  let acc = 0;
  for (const n of nutrients) {
    const w = OVERALL_WEIGHTS[n.nutrient] ?? 0;
    wSum += w;
    acc += w * n.retained;
  }
  const overall = wSum > 0 ? round(acc / wSum, 4) : 1;

  return {
    overall,
    nutrients,
    warnings: buildWarnings(nutrients, conditions),
    tips: buildTips(nutrients, conditions, overall),
    computedAt: nowIso(),
  };
}

function buildWarnings(
  nutrients: readonly NutrientRetention[],
  conditions: readonly StepConditions[],
): RetentionWarning[] {
  const warnings: RetentionWarning[] = [];

  for (const n of nutrients) {
    if (n.retained >= 0.6) continue;
    const pct = retentionPercent(n);
    warnings.push({
      nutrient: n.nutrient,
      severity: n.retained < 0.4 ? "critical" : "warn",
      message: `Only ${pct}% of the ${n.label} survived cooking.`,
      suggestion:
        n.retained < 0.4
          ? "Cut the cooking time sharply, or add this ingredient near the end."
          : "Cook for less time on a lower flame, or add it later in the process.",
    });
  }

  for (const c of conditions) {
    if (
      PAN_FRY_METHODS.includes(c.method ?? "saute") &&
      c.maxTempC > SAUTE_MAX_SAFE_TEMP_C
    ) {
      warnings.push({
        nutrient: "vitaminC",
        severity: c.maxTempC > CHARRING_TEMP_C ? "critical" : "warn",
        message: `The pan reached ${Math.round(c.maxTempC)}°C during "${c.step.title}".`,
        suggestion: `Keep sautéing below ${SAUTE_MAX_SAFE_TEMP_C}°C — hotter oil destroys vitamins fast.`,
      });
    }

    if (c.maxTempC > CHARRING_TEMP_C) {
      warnings.push({
        nutrient: "protein",
        severity: "info",
        message: `"${c.step.title}" went past ${CHARRING_TEMP_C}°C, so the surface started to char.`,
        suggestion: "Lower the flame once the pan is hot; charring damages protein and fats.",
      });
    }

    if (c.plannedMinutes > 0 && c.minutes > c.plannedMinutes * OVERCOOK_RATIO) {
      const extra = Math.max(1, Math.round(c.minutes - c.plannedMinutes));
      warnings.push({
        nutrient: "vitaminC",
        severity: "warn",
        message: `"${c.step.title}" ran ${extra} min longer than planned.`,
        suggestion: "Shorter cooking preserves the heat-sensitive vitamins.",
      });
    }
  }

  return warnings;
}

function buildTips(
  nutrients: readonly NutrientRetention[],
  conditions: readonly StepConditions[],
  overall: number,
): string[] {
  const tips: string[] = [
    "Cooking at medium heat helps retain more vitamins. Avoid overcooking.",
  ];

  const wet = conditions.some(
    (c) => c.method === "boil" || c.method === "simmer" || c.method === "pressure_cook",
  );
  if (wet) {
    tips.push("Reuse the cooking water in a gravy, dal or soup — the lost vitamins are in it.");
  }

  const lowC = nutrients.find((n) => n.nutrient === "vitaminC" && n.retained < 0.7);
  if (lowC) {
    tips.push("Finish with lemon juice or fresh coriander to top the vitamin C back up.");
  }

  if (tips.length < 2) {
    tips.push(
      overall >= 0.85
        ? "Great result — steaming and short cooking times keep this high."
        : "Cut vegetables larger and add them later to slow vitamin loss.",
    );
  }

  return tips.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Live coaching during a step
// ---------------------------------------------------------------------------

/** Tone + one line for the cooking screen, refreshed as the sensor ticks. */
export function liveRetentionHint(
  step: RecipeStep,
  currentTempC: number | undefined,
  elapsedSec: number,
): LiveHint {
  const range = step.targetTempC;
  const planned = step.durationSec ?? 0;
  const title = step.title?.trim() || "This step";

  // Danger first: badly too hot, or badly overdue.
  if (range && currentTempC !== undefined && currentTempC > range.max + 20) {
    return {
      tone: "danger",
      message: "Too hot — lower the flame to protect vitamin C.",
    };
  }
  if (planned > 0 && elapsedSec > planned * 1.6) {
    const extra = Math.max(1, Math.round((elapsedSec - planned) / 60));
    return {
      tone: "danger",
      message: `${title} has cooked ${extra} min longer than planned; move on to the next step.`,
    };
  }

  if (range && currentTempC !== undefined && currentTempC > range.max) {
    return {
      tone: "warn",
      message: `Running hot — ease the flame back to ${range.min}°C – ${range.max}°C.`,
    };
  }
  if (planned > 0 && elapsedSec > planned * 1.25) {
    const extra = Math.max(1, Math.round((elapsedSec - planned) / 60));
    return {
      tone: "warn",
      message: `${title} is ${extra} min over the planned time — check it now.`,
    };
  }

  if (range && currentTempC !== undefined && currentTempC < range.min) {
    return {
      tone: "ok",
      message: `Still warming up — wait for ${range.min}°C before adding the next ingredient.`,
    };
  }
  if (range) {
    return {
      tone: "ok",
      message: `Keep temperature between ${range.min}°C – ${range.max}°C for better nutrient retention.`,
    };
  }
  return { tone: "ok", message: "Looking good — keep the heat steady." };
}

// ---------------------------------------------------------------------------
// Actual cooked nutrition (feedback / home screens)
// ---------------------------------------------------------------------------

/**
 * Nutrition of one serving as actually cooked: measured grams from the scale
 * where available, recipe grams (scaled to `servings`) everywhere else.
 */
export function computeNutritionFromLogs(
  recipe: Recipe,
  ingredients: Ingredient[],
  logs: IngredientLog[],
  servings: number,
): NutritionPerServing {
  const grams = recipeGrams(recipe, servings);
  for (const log of logs ?? []) {
    if (log.actualGrams > 0) grams.set(log.ingredientId, log.actualGrams);
  }
  return nutritionFromGrams(grams, ingredients, servings);
}

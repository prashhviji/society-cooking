/**
 * Nutrition arithmetic over the ingredient catalog.
 *
 * `Ingredient.nutrition` is per 100 g (or 100 ml); everything here works in
 * absolute amounts for a whole dish and only divides by servings at the end.
 */

import type {
  ID,
  Ingredient,
  NutrientKey,
  NutritionPer100,
  NutritionPerServing,
  Recipe,
} from "@/lib/types";
import { DEFAULT_GRAMS_PER_PIECE } from "./constants";

export const NUTRIENT_KEYS: readonly NutrientKey[] = [
  "kcal",
  "proteinG",
  "carbsG",
  "fatG",
  "fiberG",
  "vitaminCMg",
  "vitaminB6Mg",
  "folateUg",
  "vitaminAUg",
  "ironMg",
  "calciumMg",
  "potassiumMg",
] as const;

export function emptyNutrition(): NutritionPerServing {
  return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
}

/** Index a catalog array by id. */
export function indexIngredients(
  ingredients: readonly Ingredient[] | undefined,
): Map<ID, Ingredient> {
  const map = new Map<ID, Ingredient>();
  for (const i of ingredients ?? []) map.set(i.id, i);
  return map;
}

/** Nutrition contributed by `grams` of one catalog ingredient. */
export function nutritionForGrams(
  ingredient: Ingredient | undefined,
  grams: number,
): Partial<Record<NutrientKey, number>> {
  const out: Partial<Record<NutrientKey, number>> = {};
  if (!ingredient || grams <= 0) return out;
  const per100 = ingredient.nutrition as NutritionPer100;
  const factor = grams / 100;
  for (const key of NUTRIENT_KEYS) {
    const v = per100[key];
    if (typeof v === "number" && v !== 0) out[key] = v * factor;
  }
  return out;
}

export function addNutrition(
  into: Partial<Record<NutrientKey, number>>,
  part: Partial<Record<NutrientKey, number>>,
): Partial<Record<NutrientKey, number>> {
  for (const key of NUTRIENT_KEYS) {
    const v = part[key];
    if (typeof v === "number" && v !== 0) into[key] = (into[key] ?? 0) + v;
  }
  return into;
}

export function scaleNutrition(
  n: Partial<Record<NutrientKey, number>>,
  factor: number,
): Partial<Record<NutrientKey, number>> {
  const out: Partial<Record<NutrientKey, number>> = {};
  for (const key of NUTRIENT_KEYS) {
    const v = n[key];
    if (typeof v === "number") out[key] = v * factor;
  }
  return out;
}

/** Finish a partial tally into the required `NutritionPerServing` shape. */
export function toNutritionPerServing(
  n: Partial<Record<NutrientKey, number>>,
  digits = 1,
): NutritionPerServing {
  const f = 10 ** digits;
  const out: NutritionPerServing = {
    kcal: Math.round((n.kcal ?? 0) * f) / f,
    proteinG: Math.round((n.proteinG ?? 0) * f) / f,
    carbsG: Math.round((n.carbsG ?? 0) * f) / f,
    fatG: Math.round((n.fatG ?? 0) * f) / f,
    fiberG: Math.round((n.fiberG ?? 0) * f) / f,
  };
  for (const key of NUTRIENT_KEYS) {
    if (key in out) continue;
    const v = n[key];
    if (typeof v === "number" && v !== 0) out[key] = Math.round(v * f) / f;
  }
  return out;
}

/** Grams of one pantry/recipe quantity, converting `pcs` via the catalog. */
export function gramsOf(
  quantity: number,
  unit: "g" | "ml" | "pcs",
  ingredient?: Ingredient,
): number {
  if (unit === "pcs") {
    return quantity * (ingredient?.gramsPerPiece ?? DEFAULT_GRAMS_PER_PIECE);
  }
  // 1 ml of a household liquid ≈ 1 g; good enough for milk, oil and water.
  return quantity;
}

/**
 * Grams of every ingredient in one cook of `recipe` at `servings`.
 * Recipe quantities are stated for `recipe.servings`.
 */
export function recipeGrams(recipe: Recipe, servings: number): Map<ID, number> {
  const scale = servings / Math.max(1, recipe.servings || 1);
  const map = new Map<ID, number>();
  for (const ri of recipe.ingredients ?? []) {
    map.set(ri.ingredientId, (map.get(ri.ingredientId) ?? 0) + ri.grams * scale);
  }
  return map;
}

/** Nutrition of a whole dish from measured grams, then divided by servings. */
export function nutritionFromGrams(
  grams: Map<ID, number>,
  ingredients: readonly Ingredient[] | Map<ID, Ingredient>,
  servings = 1,
): NutritionPerServing {
  const index =
    ingredients instanceof Map ? ingredients : indexIngredients(ingredients);
  const total: Partial<Record<NutrientKey, number>> = {};
  for (const [id, g] of grams) {
    addNutrition(total, nutritionForGrams(index.get(id), g));
  }
  return toNutritionPerServing(scaleNutrition(total, 1 / Math.max(1, servings)));
}

/**
 * Plan − pantry → grocery list.
 *
 * For every meal still `planned` we sum the grams the recipe needs, subtract
 * pantry stock that will still be good on the day the meal is cooked (FIFO,
 * earliest-expiring lot first), round the shortfall up to a realistic pack size
 * and price it from `costPerKg`.
 */

import type {
  GroceryItem,
  GroceryList,
  ID,
  Ingredient,
  ISODate,
  MealPlan,
  PantryItem,
  Recipe,
  Unit,
} from "@/lib/types";
import { nowIso, uid } from "@/lib/utils";
import {
  DEFAULT_PACK_SIZE_G,
  PACK_SIZE_G,
  PACK_SIZE_OVERRIDE_G,
} from "./constants";
import { ceilTo, round } from "./helpers";
import { gramsOf, indexIngredients } from "./nutrition";

/** Pack size (grams / millilitres) a shortfall for this ingredient rounds up to. */
export function packSizeFor(ingredient: Ingredient | undefined): number {
  if (!ingredient) return DEFAULT_PACK_SIZE_G;
  const override = PACK_SIZE_OVERRIDE_G[ingredient.id];
  if (override) return override;
  return PACK_SIZE_G[ingredient.category] ?? DEFAULT_PACK_SIZE_G;
}

interface Requirement {
  date: ISODate;
  grams: number;
}

interface Lot {
  grams: number;
  expiresAt: ISODate;
}

/**
 * Consume `requirements` (in date order) from `lots` (FIFO by expiry) and
 * return the grams that could not be covered.
 *
 * A lot only counts for a requirement whose meal date is on or before the
 * lot's expiry — food that goes off on Tuesday cannot feed Thursday's dinner.
 */
export function shortfall(requirements: Requirement[], lots: Lot[]): number {
  const stock = lots
    .map((l) => ({ ...l }))
    .sort((a, b) => (a.expiresAt < b.expiresAt ? -1 : a.expiresAt > b.expiresAt ? 1 : 0));
  const needs = [...requirements].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );

  let missing = 0;
  for (const need of needs) {
    let left = need.grams;
    for (const lot of stock) {
      if (left <= 0) break;
      if (lot.grams <= 0) continue;
      if (lot.expiresAt < need.date) continue; // already spoiled by then
      const take = Math.min(lot.grams, left);
      lot.grams -= take;
      left -= take;
    }
    if (left > 0) missing += left;
  }
  return missing;
}

export function buildGroceryList(
  plan: MealPlan,
  recipes: Recipe[],
  pantry: PantryItem[],
  ingredients: Ingredient[],
): GroceryList {
  const ts = nowIso();
  const listId = uid();
  const recipeById = new Map<ID, Recipe>(recipes.map((r) => [r.id, r]));
  const catalog = indexIngredients(ingredients);

  // 1. Requirements per ingredient, tagged with the date they are needed.
  const requirements = new Map<ID, Requirement[]>();
  const displayName = new Map<ID, string>();
  for (const meal of plan.meals ?? []) {
    if (meal.status !== "planned") continue;
    const recipe = recipeById.get(meal.recipeId);
    if (!recipe) continue;
    const scale = meal.servings / Math.max(1, recipe.servings || 1);
    for (const ri of recipe.ingredients ?? []) {
      const grams = ri.grams * scale;
      if (grams <= 0) continue;
      const list = requirements.get(ri.ingredientId) ?? [];
      list.push({ date: meal.date, grams });
      requirements.set(ri.ingredientId, list);
      if (!displayName.has(ri.ingredientId)) displayName.set(ri.ingredientId, ri.name);
    }
  }

  // 2. Pantry lots per ingredient, in grams.
  const lots = new Map<ID, Lot[]>();
  for (const item of pantry ?? []) {
    const grams = gramsOf(item.quantity, item.unit, catalog.get(item.ingredientId));
    if (grams <= 0) continue;
    const list = lots.get(item.ingredientId) ?? [];
    list.push({ grams, expiresAt: item.expiresAt });
    lots.set(item.ingredientId, list);
  }

  // 3. Shortfall → pack sizes → cost.
  const items: GroceryItem[] = [];
  for (const [ingredientId, needs] of requirements) {
    const missing = shortfall(needs, lots.get(ingredientId) ?? []);
    if (missing <= 0.001) continue;

    const ingredient = catalog.get(ingredientId);
    const name = ingredient?.name ?? displayName.get(ingredientId) ?? ingredientId;
    const unit: Unit = ingredient?.defaultUnit ?? "g";

    let grams: number;
    let quantity: number;
    if (unit === "pcs") {
      const per = ingredient?.gramsPerPiece || 1;
      quantity = Math.max(1, Math.ceil(missing / per));
      grams = quantity * per;
    } else {
      const pack = packSizeFor(ingredient);
      grams = Math.max(pack, ceilTo(missing, pack));
      quantity = grams;
    }

    items.push({
      id: uid(),
      listId,
      ingredientId,
      name,
      quantity: round(quantity, 2),
      unit,
      grams: round(grams, 2),
      estimatedCost: round((grams / 1000) * (ingredient?.costPerKg ?? 0), 2),
      purchased: false,
      addedToPantry: false,
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: listId,
    userId: plan.userId,
    planId: plan.id,
    items,
    createdAt: ts,
    updatedAt: ts,
  };
}

export interface GroceryTotals {
  itemCount: number;
  purchasedCount: number;
  totalGrams: number;
  estimatedCost: number;
  purchasedCost: number;
  remainingCost: number;
}

export function groceryTotals(list: GroceryList): GroceryTotals {
  let totalGrams = 0;
  let estimatedCost = 0;
  let purchasedCost = 0;
  let purchasedCount = 0;
  for (const item of list.items ?? []) {
    totalGrams += item.grams;
    estimatedCost += item.estimatedCost;
    if (item.purchased) {
      purchasedCount += 1;
      purchasedCost += item.estimatedCost;
    }
  }
  return {
    itemCount: list.items?.length ?? 0,
    purchasedCount,
    totalGrams: round(totalGrams, 2),
    estimatedCost: round(estimatedCost, 2),
    purchasedCost: round(purchasedCost, 2),
    remainingCost: round(estimatedCost - purchasedCost, 2),
  };
}

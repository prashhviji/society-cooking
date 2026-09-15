/**
 * Hard filters shared by the planner and the recommender.
 *
 * A recipe that fails any of these is never shown to the user: diet, allergy,
 * disliked ingredients and missing equipment are non-negotiable.
 */

import type { DietType, Equipment, Recipe, UserProfile } from "@/lib/types";
import { BASIC_STOVE_EQUIPMENT, ALLERGEN_TOKENS } from "./constants";
import { matchesToken, normalizeText } from "./helpers";

/**
 * Which recipe diet labels satisfy a user's diet.
 * Vegan ⊂ vegetarian ⊂ eggetarian/pescatarian ⊂ non-vegetarian.
 */
export const DIET_COMPATIBILITY: Record<DietType, DietType[]> = {
  vegan: ["vegan"],
  vegetarian: ["vegetarian", "vegan"],
  eggetarian: ["eggetarian", "vegetarian", "vegan"],
  pescatarian: ["pescatarian", "vegetarian", "vegan"],
  non_vegetarian: [
    "non_vegetarian",
    "pescatarian",
    "eggetarian",
    "vegetarian",
    "vegan",
  ],
};

export function dietCompatible(recipe: Recipe, diet: DietType): boolean {
  const accepted = DIET_COMPATIBILITY[diet] ?? [diet];
  if (!recipe.diets || recipe.diets.length === 0) return false;
  return recipe.diets.some((d) => accepted.includes(d));
}

/** Expand free-text allergy labels ("Dairy", "tree nuts") into ingredient tokens. */
export function allergyTokens(allergies: readonly string[] | undefined): string[] {
  const out = new Set<string>();
  for (const raw of allergies ?? []) {
    const key = normalizeText(raw).replace(/ /g, "");
    const mapped = ALLERGEN_TOKENS[key];
    if (mapped) {
      for (const t of mapped) out.add(t);
    } else {
      const direct = normalizeText(raw);
      if (direct) out.add(direct);
    }
  }
  return [...out];
}

/** True when any ingredient id or name matches one of the tokens. */
export function recipeMatchesTokens(recipe: Recipe, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return false;
  for (const ri of recipe.ingredients ?? []) {
    const hay = `${ri.ingredientId} ${ri.name}`;
    for (const tok of tokens) {
      if (matchesToken(hay, tok)) return true;
    }
  }
  return false;
}

export function recipeHasAllergen(
  recipe: Recipe,
  allergies: readonly string[] | undefined,
): boolean {
  return recipeMatchesTokens(recipe, allergyTokens(allergies));
}

export function recipeHasDisliked(
  recipe: Recipe,
  disliked: readonly string[] | undefined,
): boolean {
  const tokens = (disliked ?? []).map(normalizeText).filter(Boolean);
  return recipeMatchesTokens(recipe, tokens);
}

/**
 * A kitchen with a stove can stand in for a frying pan, kadai or tawa
 * (and vice-versa) — they are the same basic hob-and-pan setup.
 */
export function effectiveEquipment(profile: UserProfile): Set<Equipment> {
  const set = new Set<Equipment>(profile.equipment ?? []);
  if (BASIC_STOVE_EQUIPMENT.some((e) => set.has(e))) {
    for (const e of BASIC_STOVE_EQUIPMENT) set.add(e);
  }
  return set;
}

export function equipmentAvailable(recipe: Recipe, profile: UserProfile): boolean {
  const have = effectiveEquipment(profile);
  return (recipe.equipment ?? []).every((e) => have.has(e));
}

/** Every hard filter combined. */
export function isRecipeAllowed(recipe: Recipe, profile: UserProfile): boolean {
  if (!dietCompatible(recipe, profile.diet)) return false;
  if (recipeHasAllergen(recipe, profile.allergies)) return false;
  if (recipeHasDisliked(recipe, profile.dislikedIngredients)) return false;
  if (!equipmentAvailable(recipe, profile)) return false;
  return true;
}

export function filterRecipes(recipes: readonly Recipe[], profile: UserProfile): Recipe[] {
  return recipes.filter((r) => isRecipeAllowed(r, profile));
}

/** Explains why a recipe was rejected — handy for debug UI and tests. */
export function rejectionReason(
  recipe: Recipe,
  profile: UserProfile,
): "diet" | "allergy" | "disliked" | "equipment" | null {
  if (!dietCompatible(recipe, profile.diet)) return "diet";
  if (recipeHasAllergen(recipe, profile.allergies)) return "allergy";
  if (recipeHasDisliked(recipe, profile.dislikedIngredients)) return "disliked";
  if (!equipmentAvailable(recipe, profile)) return "equipment";
  return null;
}

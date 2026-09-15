import type { SelectOption } from "@/components/ui";
import { INGREDIENTS, ingredientById } from "@/lib/data/seed/ingredients";
import type {
  Ingredient,
  IngredientCategory,
  StorageLocation,
  Unit,
} from "@/lib/types";
import { addDays, toISODate } from "@/lib/utils";

/** `{ id, name }[]` for the Gemini vision routes. */
export const CATALOG: { id: string; name: string }[] = INGREDIENTS.map((i) => ({
  id: i.id,
  name: i.name,
}));

export const UNIT_OPTIONS: SelectOption[] = [
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
  { value: "pcs", label: "pcs" },
];

export const STORAGE_OPTIONS: { value: StorageLocation; label: string }[] = [
  { value: "fridge", label: "Fridge" },
  { value: "freezer", label: "Freezer" },
  { value: "pantry", label: "Pantry" },
];

export const DEFAULT_SHELF_LIFE_DAYS = 7;

/** Today + the catalog shelf life, as `YYYY-MM-DD`. */
export function defaultExpiry(ingredientId?: string): string {
  const shelf =
    (ingredientId ? ingredientById(ingredientId)?.shelfLifeDays : undefined) ??
    DEFAULT_SHELF_LIFE_DAYS;
  return addDays(toISODate(), shelf);
}

/**
 * Turn a gram estimate (Gemini / the scale) into the quantity + unit the
 * catalog prefers — pieces for tomatoes and eggs, grams for rice.
 */
export function quantityFromGrams(
  ingredient: Ingredient | undefined,
  grams: number,
): { quantity: number; unit: Unit } {
  const safe = Number.isFinite(grams) && grams > 0 ? grams : 0;
  if (!ingredient) return { quantity: Math.round(safe), unit: "g" };
  if (ingredient.defaultUnit === "pcs") {
    const per = ingredient.gramsPerPiece ?? 100;
    return { quantity: Math.max(1, Math.round(safe / per)), unit: "pcs" };
  }
  return { quantity: Math.round(safe), unit: ingredient.defaultUnit };
}

/** Name / alias / id substring search over the catalog. */
export function searchIngredients(query: string, limit = 40): Ingredient[] {
  const term = query.trim().toLowerCase();
  if (!term) return INGREDIENTS.slice(0, limit);
  const out: Ingredient[] = [];
  for (const i of INGREDIENTS) {
    const hit =
      i.name.toLowerCase().includes(term) ||
      i.id.includes(term) ||
      i.aliases.some((a) => a.toLowerCase().includes(term));
    if (hit) out.push(i);
    if (out.length >= limit) break;
  }
  return out;
}

/** Best-effort catalog match for a free-text label coming back from Gemini. */
export function matchIngredientByName(name: string): Ingredient | undefined {
  const term = name.trim().toLowerCase();
  if (!term) return undefined;
  return (
    INGREDIENTS.find((i) => i.name.toLowerCase() === term) ??
    INGREDIENTS.find((i) => i.aliases.some((a) => a.toLowerCase() === term)) ??
    INGREDIENTS.find((i) => i.name.toLowerCase().includes(term))
  );
}

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

export type PantryFilter =
  | "all"
  | "vegetables"
  | "fruits"
  | "proteins"
  | "grains"
  | "dairy"
  | "legumes"
  | "spices"
  | "other";

export const FILTER_LABELS: Record<PantryFilter, string> = {
  all: "All",
  vegetables: "Vegetables",
  fruits: "Fruits",
  proteins: "Proteins",
  grains: "Grains",
  dairy: "Dairy",
  legumes: "Legumes",
  spices: "Spices",
  other: "Other",
};

/** Chip order from SCREENS §12; "Fruits" is only shown when relevant. */
export const FILTER_ORDER: PantryFilter[] = [
  "all",
  "vegetables",
  "fruits",
  "proteins",
  "grains",
  "dairy",
  "legumes",
  "spices",
  "other",
];

/** Catalog categories without a chip of their own fall into "Other". */
export function filterForCategory(
  category: IngredientCategory | undefined,
): PantryFilter {
  switch (category) {
    case "vegetables":
    case "fruits":
    case "proteins":
    case "grains":
    case "dairy":
    case "legumes":
    case "spices":
      return category;
    default:
      return "other";
  }
}

export function filterForIngredient(ingredientId: string): PantryFilter {
  return filterForCategory(ingredientById(ingredientId)?.category);
}

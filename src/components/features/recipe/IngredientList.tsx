"use client";

import { Check } from "lucide-react";
import { EmojiTile, ListRow } from "@/components/ui";
import type { CoverageRow } from "@/lib/data/selectors";
import { ingredientById } from "@/lib/data/seed/ingredients";
import type { Recipe } from "@/lib/types";
import { formatQuantity } from "@/lib/utils";

/** "1.2 kg" / "200 g" — grams rounded to one decimal at most. */
export function formatGrams(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${Number.isInteger(kg) ? kg : Number(kg.toFixed(1))} kg`;
  }
  return `${Math.round(grams * 10) / 10} g`;
}

/** "4 pcs (200 g)" — the piece/volume count with its gram equivalent. */
export function quantityLabel(
  quantity: number,
  unit: Recipe["ingredients"][number]["unit"],
  grams: number,
): string {
  const qty = Math.round(quantity * 100) / 100;
  const primary = formatQuantity(qty, unit);
  if (unit === "g") return formatGrams(grams);
  return `${primary} (${formatGrams(grams)})`;
}

export interface IngredientListProps {
  recipe: Recipe;
  /** Servings the list is scaled to. */
  servings: number;
  /** `pantryCoverage(recipe, pantry, servings)` from the screen. */
  coverage: CoverageRow[];
}

/** Scaled ingredient rows with a pantry-coverage indicator per row. */
export function IngredientList({ recipe, servings, coverage }: IngredientListProps) {
  const factor = recipe.servings > 0 ? servings / recipe.servings : 1;
  const byIngredient = new Map(coverage.map((c) => [c.ingredientId, c]));

  return (
    <div>
      {recipe.ingredients.map((ri, i) => {
        const grams = ri.grams * factor;
        const row = byIngredient.get(ri.ingredientId);
        const ok = row?.ok ?? false;
        const short = row ? Math.max(0, row.needGrams - row.haveGrams) : 0;
        const catalog = ingredientById(ri.ingredientId);

        return (
          <ListRow
            key={`${ri.ingredientId}-${i}`}
            divider={i < recipe.ingredients.length - 1}
            leading={
              <EmojiTile
                emoji={catalog?.emoji ?? "🥄"}
                size={40}
                tone={ok ? "green" : "neutral"}
              />
            }
            title={ri.name}
            subtitle={
              <>
                {ri.prep}
                {!ok && short > 0 && (
                  <span className="text-orange-600">
                    {ri.prep ? " · " : ""}need {formatGrams(short)}
                  </span>
                )}
                {ri.optional && (
                  <span className="text-text-3">{ri.prep ? " · " : ""}optional</span>
                )}
              </>
            }
            trailing={
              <>
                <span className="text-[13px] font-medium text-text-2 tabular-nums">
                  {quantityLabel(ri.quantity * factor, ri.unit, grams)}
                </span>
                {ok ? (
                  <span
                    title="In your pantry"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700"
                  >
                    <Check size={14} aria-hidden="true" />
                    <span className="sr-only">In your pantry</span>
                  </span>
                ) : (
                  <span
                    title={short > 0 ? `Need ${formatGrams(short)} more` : "Not in your pantry"}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-border"
                  >
                    <span className="sr-only">
                      {short > 0 ? `Need ${formatGrams(short)} more` : "Not in your pantry"}
                    </span>
                  </span>
                )}
              </>
            }
          />
        );
      })}
    </div>
  );
}

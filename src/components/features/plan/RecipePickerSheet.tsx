"use client";

import { useMemo, useState } from "react";
import { Chip, EmojiTile, EmptyState, ListRow, SearchInput, Sheet } from "@/components/ui";
import { useRecipeStore } from "@/lib/data/stores";
import type { MealType, RecipeTag } from "@/lib/types";
import { humanize } from "@/lib/utils";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const QUICK_MAX_MIN = 20;

export interface RecipePickerSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Pre-selects the meal-type filter. */
  mealType?: MealType;
  /** Receives the chosen recipe and the meal-type filter that was active. */
  onPick: (recipeId: string, mealType: MealType | "all") => void;
}

/**
 * Searchable recipe list used for both "Swap" and "+ Add meal".
 *
 * The filters are plain local state: give the component a fresh `key` each time
 * it is opened to start from a clean search.
 */
export function RecipePickerSheet({
  open,
  onClose,
  title = "Add or swap a meal",
  description,
  mealType,
  onPick,
}: RecipePickerSheetProps) {
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState<MealType | "all">(mealType ?? "all");
  const [tag, setTag] = useState<RecipeTag | null>(null);
  const [quickOnly, setQuickOnly] = useState(false);

  const recipes = useRecipeStore((s) => s.recipes);
  const search = useRecipeStore((s) => s.search);

  const results = useMemo(() => {
    if (!recipes.length) return [];
    return search(query, {
      mealType: slot === "all" ? undefined : slot,
      tag: tag ?? undefined,
      maxMinutes: quickOnly ? QUICK_MAX_MIN : undefined,
    });
  }, [recipes, search, query, slot, tag, quickOnly]);

  return (
    <Sheet open={open} onClose={onClose} title={title} description={description}>
      <SearchInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
        placeholder="Search recipes…"
        aria-label="Search recipes"
      />

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip selected={slot === "all"} onClick={() => setSlot("all")}>
          All
        </Chip>
        {MEAL_TYPES.map((m) => (
          <Chip key={m} selected={slot === m} onClick={() => setSlot(m)}>
            {humanize(m)}
          </Chip>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip selected={quickOnly} onClick={() => setQuickOnly((v) => !v)}>
          Quick ≤ {QUICK_MAX_MIN} min
        </Chip>
        <Chip
          selected={tag === "high_protein"}
          onClick={() => setTag(tag === "high_protein" ? null : "high_protein")}
        >
          High protein
        </Chip>
        <Chip
          selected={tag === "budget"}
          onClick={() => setTag(tag === "budget" ? null : "budget")}
        >
          Budget
        </Chip>
      </div>

      <p className="mt-3 text-xs text-text-2">
        {results.length} recipe{results.length === 1 ? "" : "s"}
      </p>

      <div className="mt-1 pb-2">
        {results.length === 0 ? (
          <EmptyState
            emoji="🔍"
            title="No recipes match"
            description="Try a different search or clear the filters."
          />
        ) : (
          results.map((r) => (
            <ListRow
              key={r.id}
              divider
              onClick={() => onPick(r.id, slot)}
              aria-label={`Choose ${r.name}`}
              leading={
                <EmojiTile emoji={r.emoji} imageUrl={r.imageUrl} alt={r.name} size={40} />
              }
              title={r.name}
              subtitle={`${Math.round(r.nutritionPerServing.kcal ?? 0)} kcal • ${
                r.prepTimeMin + r.cookTimeMin
              } min`}
              trailing={
                r.tags[0] ? (
                  <Chip tone="green" size="sm">
                    {humanize(r.tags[0])}
                  </Chip>
                ) : undefined
              }
            />
          ))
        )}
      </div>
    </Sheet>
  );
}

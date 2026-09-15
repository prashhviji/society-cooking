"use client";

import { Check, Play } from "lucide-react";
import Link from "next/link";
import { Button, Chip, EmojiTile } from "@/components/ui";
import type { PlannedMeal, Recipe } from "@/lib/types";
import { humanize } from "@/lib/utils";

export interface TodayCookingProps {
  meals: PlannedMeal[];
  recipeById: (id: string) => Recipe | undefined;
  onStart: (meal: PlannedMeal, recipe: Recipe) => void;
  /** Disables the Start buttons while a session is being created. */
  starting?: boolean;
}

/** Horizontally scrolling row of today's planned meals. */
export function TodayCooking({
  meals,
  recipeById,
  onStart,
  starting,
}: TodayCookingProps) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {meals.map((meal) => {
        const recipe = recipeById(meal.recipeId);
        const minutes = (recipe?.prepTimeMin ?? 0) + (recipe?.cookTimeMin ?? 0);
        const kcal = Math.round(recipe?.nutritionPerServing.kcal ?? 0);
        const cooked = meal.status === "cooked";

        return (
          <div
            key={meal.id}
            className="flex w-[148px] shrink-0 flex-col rounded-2xl border border-border bg-surface p-3 shadow-card"
          >
            <Link
              href={recipe ? `/recipes/${recipe.id}` : "#"}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <EmojiTile
                emoji={recipe?.emoji}
                imageUrl={recipe?.imageUrl}
                alt={recipe?.name ?? ""}
                size={88}
                tone={meal.mealType === "breakfast" ? "orange" : "green"}
                className="mx-auto"
              />
            </Link>

            <p className="mt-2 text-[10px] font-medium tracking-wide text-text-3 uppercase">
              {humanize(meal.mealType)}
            </p>
            <p className="line-clamp-2 min-h-[34px] text-[14px] leading-tight font-semibold text-text">
              {recipe?.name ?? "Recipe unavailable"}
            </p>
            <p className="mt-0.5 text-[11px] text-text-2">
              {minutes} min • {kcal} kcal
            </p>

            <div className="mt-2.5">
              {cooked ? (
                <Chip tone="green" size="sm" icon={<Check size={11} strokeWidth={3} />}>
                  Cooked
                </Chip>
              ) : (
                <Button
                  size="sm"
                  fullWidth
                  disabled={!recipe || starting}
                  leftIcon={<Play size={13} />}
                  onClick={() => recipe && onStart(meal, recipe)}
                >
                  Start
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

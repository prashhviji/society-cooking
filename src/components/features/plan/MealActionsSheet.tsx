"use client";

import { ArrowRightLeft, Trash2, Undo2, UtensilsCrossed } from "lucide-react";
import { Button, EmojiTile, Sheet, Stepper } from "@/components/ui";
import type { PlannedMeal, Recipe } from "@/lib/types";
import { humanize } from "@/lib/utils";

export interface MealActionsSheetProps {
  open: boolean;
  onClose: () => void;
  meal: PlannedMeal | undefined;
  recipe: Recipe | undefined;
  onSwap: () => void;
  onServingsChange: (servings: number) => void;
  onToggleEatingOut: () => void;
  onRemove: () => void;
}

/** Kebab menu for a planned meal: swap, servings, eaten out, remove. */
export function MealActionsSheet({
  open,
  onClose,
  meal,
  recipe,
  onSwap,
  onServingsChange,
  onToggleEatingOut,
  onRemove,
}: MealActionsSheetProps) {
  const eatingOut = meal?.status === "eating_out";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={recipe?.name ?? "Meal options"}
      description={meal ? humanize(meal.mealType) : undefined}
    >
      {meal && (
        <div className="pb-2">
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
            <EmojiTile
              emoji={recipe?.emoji}
              imageUrl={recipe?.imageUrl}
              alt={recipe?.name ?? ""}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-text">
                {recipe?.name ?? "Recipe unavailable"}
              </p>
              <p className="text-xs text-text-2">
                {Math.round((recipe?.nutritionPerServing.kcal ?? 0) * meal.servings)} kcal
                total
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[14px] font-medium text-text">Servings</span>
            <Stepper
              label="Servings"
              value={meal.servings}
              onChange={onServingsChange}
              min={0.5}
              max={12}
              step={0.5}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="secondary"
              fullWidth
              leftIcon={<ArrowRightLeft size={16} />}
              onClick={onSwap}
            >
              Swap this meal
            </Button>
            <Button
              variant="secondary"
              fullWidth
              leftIcon={
                eatingOut ? <Undo2 size={16} /> : <UtensilsCrossed size={16} />
              }
              onClick={onToggleEatingOut}
            >
              {eatingOut ? "Undo eating out" : "Mark eaten out"}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              leftIcon={<Trash2 size={16} />}
              onClick={onRemove}
              className="text-red-600"
            >
              Remove from plan
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

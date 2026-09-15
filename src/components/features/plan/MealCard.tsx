"use client";

import { Check, EllipsisVertical, Lock, Unlock } from "lucide-react";
import Link from "next/link";
import { Card, Chip, EmojiTile, IconButton } from "@/components/ui";
import type { PlannedMeal, Recipe } from "@/lib/types";
import { cn, formatMinutes, humanize } from "@/lib/utils";

export interface MealCardProps {
  meal: PlannedMeal;
  recipe: Recipe | undefined;
  /** One-line planner reason ("Uses 2 items expiring soon · 20 min"). */
  reason?: string;
  onToggleLock: () => void;
  onOpenActions: () => void;
}

/** One planned meal on the weekly plan screen. */
export function MealCard({
  meal,
  recipe,
  reason,
  onToggleLock,
  onOpenActions,
}: MealCardProps) {
  const name = recipe?.name ?? "Recipe unavailable";
  const kcal = Math.round(recipe?.nutritionPerServing.kcal ?? 0);
  const minutes = (recipe?.prepTimeMin ?? 0) + (recipe?.cookTimeMin ?? 0);
  const skipped = meal.status === "skipped";

  return (
    <Card padding="sm" className="relative flex items-center gap-3">
      {recipe && (
        <Link
          href={`/recipes/${recipe.id}`}
          aria-label={`${humanize(meal.mealType)}: ${name}`}
          className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      )}

      <EmojiTile
        emoji={recipe?.emoji}
        imageUrl={recipe?.imageUrl}
        alt={name}
        size={64}
        tone={meal.mealType === "breakfast" ? "orange" : "green"}
      />

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium tracking-wide text-text-3 uppercase">
          {humanize(meal.mealType)}
        </p>
        <p
          className={cn(
            "truncate text-[16px] leading-tight font-bold text-text",
            skipped && "text-text-3 line-through",
          )}
        >
          {name}
        </p>
        <p className="mt-0.5 text-xs text-text-2">
          {kcal} kcal • {formatMinutes(minutes)}
          {meal.servings !== 1 && ` • ${meal.servings} servings`}
        </p>

        {reason && meal.status === "planned" && (
          <p className="mt-1 truncate text-[11px] text-text-3">{reason}</p>
        )}

        {(meal.status === "cooked" || meal.status === "eating_out") && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {meal.status === "cooked" && (
              <Chip tone="green" size="sm" icon={<Check size={11} strokeWidth={3} />}>
                Cooked
              </Chip>
            )}
            {meal.status === "eating_out" && (
              <Chip tone="neutral" size="sm">
                Eating out
              </Chip>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 flex shrink-0 flex-col items-center gap-0.5">
        <IconButton
          aria-label={meal.locked ? `Unlock ${name}` : `Lock ${name}`}
          aria-pressed={meal.locked}
          size={36}
          variant={meal.locked ? "soft" : "plain"}
          onClick={onToggleLock}
        >
          {meal.locked ? <Lock size={16} /> : <Unlock size={16} />}
        </IconButton>
        <IconButton
          aria-label={`More options for ${name}`}
          size={36}
          onClick={onOpenActions}
        >
          <EllipsisVertical size={18} />
        </IconButton>
      </div>
    </Card>
  );
}

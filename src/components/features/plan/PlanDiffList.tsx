"use client";

import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui";
import type { MealDiff } from "@/lib/engines/planner";
import type { Recipe } from "@/lib/types";
import { humanize, parseISODate } from "@/lib/utils";

export interface PlanDiffListProps {
  diffs: MealDiff[];
  recipeById: (id: string) => Recipe | undefined;
}

function statusPhrase(to: string): string {
  switch (to) {
    case "eating_out":
      return "marked eating out";
    case "skipped":
      return "skipped";
    case "cooked":
      return "marked cooked";
    default:
      return "back on the plan";
  }
}

function minutesOf(recipe: Recipe | undefined): string {
  if (!recipe) return "";
  return ` (${recipe.prepTimeMin + recipe.cookTimeMin} min)`;
}

/** "Dinner · Wed 27: Chicken Biryani → Veg Upma (15 min)". */
export function PlanDiffList({ diffs, recipeById }: PlanDiffListProps) {
  if (!diffs.length) {
    return (
      <Card tone="green" padding="md">
        <p className="text-[15px] font-semibold text-green-700">
          Nothing needs to change 👍
        </p>
        <p className="mt-0.5 text-xs text-text-2">
          Your week already fits this change.
        </p>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      {diffs.map((d, i) => {
        const from = d.fromRecipeId ? recipeById(d.fromRecipeId) : undefined;
        const to = d.toRecipeId ? recipeById(d.toRecipeId) : undefined;
        const when = `${humanize(d.mealType)} · ${format(parseISODate(d.date), "EEE d")}`;

        return (
          <div
            key={`${d.mealId}-${i}`}
            className={`px-3 py-3 ${i > 0 ? "border-t border-border" : ""}`}
          >
            <p className="text-[11px] font-medium tracking-wide text-text-3 uppercase">
              {when}
            </p>

            {d.fromRecipeId && d.toRecipeId && (
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[14px] text-text">
                <span className="text-text-2 line-through">
                  {from?.name ?? d.fromRecipeId}
                </span>
                <ArrowRight size={13} className="text-text-3" aria-hidden="true" />
                <span className="font-semibold">{to?.name ?? d.toRecipeId}</span>
                <span className="text-xs text-text-2">{minutesOf(to)}</span>
              </p>
            )}

            {d.fromRecipeId && !d.toRecipeId && (
              <p className="mt-0.5 text-[14px] text-text">
                <span className="font-semibold">{from?.name ?? d.fromRecipeId}</span>{" "}
                <span className="text-text-2">removed from the plan</span>
              </p>
            )}

            {!d.fromRecipeId && d.toRecipeId && (
              <p className="mt-0.5 text-[14px] text-text">
                <span className="text-text-2">added</span>{" "}
                <span className="font-semibold">{to?.name ?? d.toRecipeId}</span>
              </p>
            )}

            {d.fromServings !== undefined && d.toServings !== undefined && (
              <p className="mt-0.5 text-[13px] text-text-2">
                servings {d.fromServings} → {d.toServings}
              </p>
            )}

            {d.statusChange && (
              <p className="mt-0.5 text-[13px] text-text-2">
                {statusPhrase(d.statusChange.to)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

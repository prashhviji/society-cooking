"use client";

import { Flame, Recycle, Wallet } from "lucide-react";
import { useMemo } from "react";
import { Card, ProgressBar } from "@/components/ui";
import type { MealPlan, PantryItem, Recipe, UserProfile } from "@/lib/types";
import { daysUntil, formatINR } from "@/lib/utils";

/** Pantry stock counted as "expiring" for the coverage figure. */
const EXPIRY_WINDOW_DAYS = 4;

export interface WeekSummaryProps {
  plan: MealPlan;
  recipes: Recipe[];
  profile: UserProfile | null;
  pantry: PantryItem[];
}

export interface WeekTotals {
  kcalPerDay: number;
  targetKcal: number;
  cost: number;
  expiringCovered: number;
  expiringTotal: number;
  mealCount: number;
}

/** Planned kcal / cost / waste coverage for a whole week. */
export function weekTotals(
  plan: MealPlan,
  recipes: Recipe[],
  profile: UserProfile | null,
  pantry: PantryItem[],
): WeekTotals {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const counted = plan.meals.filter((m) => m.status !== "skipped");

  let kcal = 0;
  let cost = 0;
  for (const m of counted) {
    const r = byId.get(m.recipeId);
    if (!r) continue;
    kcal += (r.nutritionPerServing.kcal ?? 0) * m.servings;
    cost += (r.costPerServing ?? 0) * m.servings;
  }

  const expiring = pantry.filter(
    (p) => daysUntil(p.expiresAt) <= EXPIRY_WINDOW_DAYS,
  );
  const covered = new Set<string>();
  for (const p of expiring) {
    const used = counted.some((m) => {
      if (m.date > p.expiresAt) return false; // cooked after it goes off
      const r = byId.get(m.recipeId);
      return r?.ingredients.some((i) => i.ingredientId === p.ingredientId) ?? false;
    });
    if (used) covered.add(p.ingredientId);
  }

  return {
    kcalPerDay: Math.round(kcal / 7),
    targetKcal: profile?.dailyCalorieTarget ?? 0,
    cost: Math.round(cost),
    expiringCovered: covered.size,
    expiringTotal: new Set(expiring.map((p) => p.ingredientId)).size,
    mealCount: counted.length,
  };
}

/** Bottom-of-screen recap of the whole week. */
export function WeekSummary({ plan, recipes, profile, pantry }: WeekSummaryProps) {
  const totals = useMemo(
    () => weekTotals(plan, recipes, profile, pantry),
    [plan, recipes, profile, pantry],
  );

  const pct = totals.targetKcal
    ? Math.round((totals.kcalPerDay / totals.targetKcal) * 100)
    : 0;

  return (
    <Card padding="md">
      <p className="text-[15px] font-semibold text-text">This week</p>
      <p className="mt-0.5 text-xs text-text-2">
        {totals.mealCount} meal{totals.mealCount === 1 ? "" : "s"} planned
      </p>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center gap-2">
          <Flame size={14} className="text-orange-600" aria-hidden="true" />
          <span className="text-[13px] text-text-2">Average per day</span>
          <span className="ml-auto text-[13px] font-semibold text-text">
            {totals.kcalPerDay.toLocaleString("en-IN")}
            {totals.targetKcal ? ` / ${totals.targetKcal.toLocaleString("en-IN")}` : ""}{" "}
            kcal
          </span>
        </div>
        <ProgressBar
          value={pct}
          tone="auto"
          aria-label="Planned calories against your daily target"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="flex items-center gap-1.5 text-text-2">
            <Wallet size={13} aria-hidden="true" />
            <span className="text-[11px]">Food cost</span>
          </div>
          <p className="mt-1 text-[16px] font-bold text-text">
            {formatINR(totals.cost)}
          </p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="flex items-center gap-1.5 text-text-2">
            <Recycle size={13} aria-hidden="true" />
            <span className="text-[11px]">Expiring used</span>
          </div>
          <p className="mt-1 text-[16px] font-bold text-text">
            {totals.expiringCovered}
            <span className="text-[13px] font-medium text-text-2">
              {" "}
              / {totals.expiringTotal}
            </span>
          </p>
        </div>
      </div>
    </Card>
  );
}

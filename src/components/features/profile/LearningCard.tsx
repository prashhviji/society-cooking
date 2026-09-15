"use client";

import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Card, Chip, EmojiTile } from "@/components/ui";
import { usePreferenceStore, useRecipeStore } from "@/lib/data/stores";
import type { Recipe } from "@/lib/types";

const TOP_N = 3;

/**
 * "Your learning" — how much feedback the model has seen and the recipes it
 * currently scores highest.
 */
export function LearningCard() {
  const model = usePreferenceStore((s) => s.model);
  const recipes = useRecipeStore((s) => s.recipes);

  const top = useMemo(() => {
    const ranked: { recipe: Recipe; score: number }[] = [];
    const byScore = Object.entries(model.recipeScores).sort((a, b) => b[1] - a[1]);
    for (const [id, score] of byScore) {
      if (score <= 0 || ranked.length >= TOP_N) break;
      const recipe = recipes.find((r) => r.id === id);
      if (recipe) ranked.push({ recipe, score });
    }
    return ranked;
  }, [model.recipeScores, recipes]);

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-50 text-primary"
        >
          <Sparkles size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-text">Your learning</h2>
          <p className="mt-0.5 text-xs text-text-2">
            {model.feedbackCount === 0
              ? "No meals rated yet"
              : `${model.feedbackCount} meal${model.feedbackCount === 1 ? "" : "s"} rated so far`}
          </p>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-3 py-3 text-[13px] leading-relaxed text-text-2">
          Rate a meal after cooking and Cookwise starts tuning your plans to what
          you actually enjoy.
        </p>
      ) : (
        <ul className="space-y-1">
          {top.map(({ recipe, score }, index) => (
            <li key={recipe.id} className="flex items-center gap-3 py-1">
              <span className="w-4 shrink-0 text-center text-xs font-semibold text-text-3 tabular-nums">
                {index + 1}
              </span>
              <EmojiTile
                emoji={recipe.emoji}
                imageUrl={recipe.imageUrl}
                size={40}
                tone="green"
              />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-text">
                {recipe.name}
              </span>
              <Chip tone="green" size="sm">
                +{Math.round(score * 100)}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

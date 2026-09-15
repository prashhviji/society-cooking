"use client";

import { AppHeader } from "@/components/layout";
import { Chip, EmojiTile } from "@/components/ui";
import type { Recipe } from "@/lib/types";
import { FavouriteButton } from "./FavouriteButton";

/** "high_protein" -> "High Protein" (the mockup's chip casing). */
export function tagLabel(tag: string): string {
  return tag
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface RecipeHeroProps {
  recipe: Recipe;
}

/** 240 px hero with the overlaid back / favourite controls and the first tag. */
export function RecipeHero({ recipe }: RecipeHeroProps) {
  const tag = recipe.tags[0];

  return (
    <div className="relative h-60 w-full overflow-hidden">
      <EmojiTile
        emoji={recipe.emoji}
        imageUrl={recipe.imageUrl}
        alt={recipe.name}
        size="full"
        tone="orange"
        className="rounded-none"
        emojiClassName="text-[76px]"
      />

      <AppHeader
        transparent
        back
        right={<FavouriteButton recipeName={recipe.name} />}
      />

      {tag && (
        <div className="absolute bottom-9 left-4">
          <Chip tone="green">{tagLabel(tag)}</Chip>
        </div>
      )}
    </div>
  );
}

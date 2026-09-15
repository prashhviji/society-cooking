"use client";

import { Heart } from "lucide-react";
import { IconButton } from "@/components/ui";
import { useProfileStore } from "@/lib/data/stores";
import { cn } from "@/lib/utils";

export interface FavouriteButtonProps {
  /** Recipe name — stored verbatim in `profile.favoriteFoods`. */
  recipeName: string;
  className?: string;
}

function matches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Heart toggle over the recipe hero.
 *
 * Favourites are real data, not view state: the recipe name goes in and out of
 * `profile.favoriteFoods`, which the planner already scores against (taste
 * component, "+12 fuzzy favoriteFoods match").
 */
export function FavouriteButton({ recipeName, className }: FavouriteButtonProps) {
  const favourites = useProfileStore((s) => s.profile?.favoriteFoods);
  const isFavourite = (favourites ?? []).some((f) => matches(f, recipeName));

  const toggle = () => {
    const current = useProfileStore.getState().profile?.favoriteFoods ?? [];
    const next = current.some((f) => matches(f, recipeName))
      ? current.filter((f) => !matches(f, recipeName))
      : [...current, recipeName];
    useProfileStore.getState().setProfile({ favoriteFoods: next });
  };

  return (
    <IconButton
      aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
      aria-pressed={isFavourite}
      variant="white"
      onClick={toggle}
      className={className}
    >
      <Heart
        size={20}
        className={cn(isFavourite ? "fill-red-600 text-red-600" : "text-text-2")}
      />
    </IconButton>
  );
}

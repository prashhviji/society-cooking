"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Chip, Input, SearchInput, Slider } from "@/components/ui";
import { INGREDIENTS, ingredientById } from "@/lib/data/seed/ingredients";
import type { SpiceLevel } from "@/lib/types";
import { CUISINE_OPTIONS, spiceMeta } from "../options";
import {
  ChipToggleGroup,
  RemovableChip,
  StepSection,
  toggleValue,
  type StepProps,
} from "./common";

const MAX_SUGGESTIONS = 6;

/** Step 5 — cuisines, spice level, favourite foods and disliked ingredients. */
export function StepTaste({ draft, onChange }: StepProps) {
  const [favourite, setFavourite] = useState("");
  const [query, setQuery] = useState("");

  const favourites = draft.favoriteFoods ?? [];
  const disliked = useMemo(
    () => draft.dislikedIngredients ?? [],
    [draft.dislikedIngredients],
  );
  const spice = draft.spiceLevel ?? 2;
  const meta = spiceMeta(spice);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return INGREDIENTS.filter(
      (i) =>
        !disliked.includes(i.id) &&
        (i.name.toLowerCase().includes(q) ||
          i.aliases.some((a) => a.toLowerCase().includes(q))),
    ).slice(0, MAX_SUGGESTIONS);
  }, [query, disliked]);

  function addFavourite() {
    const value = favourite.trim();
    if (!value) return;
    const exists = favourites.some((f) => f.toLowerCase() === value.toLowerCase());
    if (!exists) onChange({ favoriteFoods: [...favourites, value] });
    setFavourite("");
  }

  return (
    <div className="space-y-6">
      <StepSection title="Cuisines you enjoy">
        <ChipToggleGroup
          label="Cuisines"
          options={CUISINE_OPTIONS}
          values={draft.cuisines ?? []}
          onToggle={(v) => onChange({ cuisines: toggleValue(draft.cuisines, v) })}
        />
      </StepSection>

      <StepSection title="Spice level">
        <Slider
          min={1}
          max={5}
          value={spice}
          onChange={(v) => onChange({ spiceLevel: v as SpiceLevel })}
          label="How hot do you like it?"
          valueLabel={
            <span>
              <span aria-hidden="true">{meta.emoji}</span> {meta.label}
            </span>
          }
          aria-label="Spice level"
          minLabel="No spice"
          maxLabel="Very hot"
        />
      </StepSection>

      <StepSection title="Favourite foods" hint="Dishes you'd happily eat every week.">
        <div className="flex items-end gap-2">
          <Input
            containerClassName="flex-1"
            label="Add a dish"
            placeholder="Dosa"
            value={favourite}
            onChange={(e) => setFavourite(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFavourite();
              }
            }}
          />
          <Button
            variant="soft"
            size="md"
            className="mb-0.5 shrink-0"
            onClick={addFavourite}
            disabled={!favourite.trim()}
            leftIcon={<Plus size={16} />}
          >
            Add
          </Button>
        </div>
        {favourites.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {favourites.map((f) => (
              <RemovableChip
                key={f}
                label={f}
                removeLabel={`Remove ${f} from favourite foods`}
                onRemove={() =>
                  onChange({ favoriteFoods: favourites.filter((x) => x !== f) })
                }
              />
            ))}
          </div>
        )}
      </StepSection>

      <StepSection
        title="Disliked ingredients"
        hint="Search our catalog — we'll keep these off your plan."
      >
        <SearchInput
          placeholder="Search ingredients…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
        />
        {query.trim() && (
          <div className="flex flex-wrap gap-2">
            {suggestions.length === 0 ? (
              <p className="text-xs text-text-3">No ingredient matches “{query.trim()}”.</p>
            ) : (
              suggestions.map((i) => (
                <Chip
                  key={i.id}
                  selected={false}
                  className="h-9 px-3.5 text-[13px]"
                  icon={<span className="text-[13px]">{i.emoji}</span>}
                  onClick={() => {
                    onChange({ dislikedIngredients: [...disliked, i.id] });
                    setQuery("");
                  }}
                >
                  {i.name}
                </Chip>
              ))
            )}
          </div>
        )}
        {disliked.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {disliked.map((id) => {
              const ing = ingredientById(id);
              const name = ing?.name ?? id;
              return (
                <RemovableChip
                  key={id}
                  label={ing ? `${ing.emoji} ${name}` : name}
                  removeLabel={`Remove ${name} from disliked ingredients`}
                  onRemove={() =>
                    onChange({ dislikedIngredients: disliked.filter((x) => x !== id) })
                  }
                />
              );
            })}
          </div>
        )}
      </StepSection>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { EmojiTile, ListRow, SearchInput } from "@/components/ui";
import type { Ingredient } from "@/lib/types";
import { humanize } from "@/lib/utils";
import { searchIngredients } from "./helpers";

export interface IngredientPickerProps {
  /** Currently chosen ingredient id, highlighted in the list. */
  value?: string;
  onSelect: (ingredient: Ingredient) => void;
  /** Rows rendered before the list scrolls. */
  limit?: number;
  label?: string;
  className?: string;
}

/** Searchable catalog list — shared by Manual, Scan fallback and Dock. */
export function IngredientPicker({
  value,
  onSelect,
  limit = 40,
  label = "Search ingredients",
  className,
}: IngredientPickerProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchIngredients(query, limit), [query, limit]);

  return (
    <div className={className}>
      <SearchInput
        value={query}
        placeholder="Search ingredients…"
        aria-label={label}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
      />
      {results.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-text-2">
          Nothing matches “{query}”.
        </p>
      ) : (
        <ul className="mt-1 max-h-[300px] overflow-y-auto overscroll-contain">
          {results.map((ingredient, index) => (
            <li key={ingredient.id}>
              <ListRow
                divider={index < results.length - 1}
                onClick={() => onSelect(ingredient)}
                aria-label={`Choose ${ingredient.name}`}
                className={
                  value === ingredient.id ? "bg-green-50" : undefined
                }
                leading={
                  <EmojiTile emoji={ingredient.emoji} size={40} tone="neutral" />
                }
                title={ingredient.name}
                subtitle={humanize(ingredient.category)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

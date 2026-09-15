"use client";

import { Input, SegmentedControl, Select } from "@/components/ui";
import { ingredientById } from "@/lib/data/seed/ingredients";
import type { Ingredient, StorageLocation, Unit } from "@/lib/types";
import { defaultExpiry, quantityFromGrams, STORAGE_OPTIONS, UNIT_OPTIONS } from "./helpers";

/** What every add-to-pantry tab edits before writing to the store. */
export interface Draft {
  ingredientId: string;
  quantity: number;
  unit: Unit;
  expiresAt: string;
  storage: StorageLocation;
}

/** Build a draft for an ingredient, optionally seeded with a gram estimate. */
export function draftFor(ingredient: Ingredient, grams?: number): Draft {
  const { quantity, unit } =
    grams && grams > 0
      ? quantityFromGrams(ingredient, grams)
      : { quantity: ingredient.defaultUnit === "pcs" ? 1 : 250, unit: ingredient.defaultUnit };
  return {
    ingredientId: ingredient.id,
    quantity,
    unit,
    expiresAt: defaultExpiry(ingredient.id),
    storage: ingredient.storage,
  };
}

export interface ItemFieldsProps {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  /** Show the storage segmented control (Manual tab). */
  showStorage?: boolean;
  className?: string;
}

/**
 * Quantity + unit + expiry (+ storage) fields shared by every add flow.
 *
 * NOTE: `PantryItem` in `src/lib/types.ts` has no storage column, so the
 * storage choice is captured for the user but not persisted. Add
 * `storage: StorageLocation` to `PantryItem` (plus the Supabase column) to keep it.
 */
export function ItemFields({
  draft,
  onChange,
  showStorage,
  className,
}: ItemFieldsProps) {
  const ingredient = ingredientById(draft.ingredientId);

  return (
    <div className={className}>
      <div className="flex gap-2">
        <Input
          label="Quantity"
          type="number"
          inputMode="decimal"
          min={0}
          step={draft.unit === "pcs" ? 1 : 10}
          value={String(draft.quantity)}
          containerClassName="flex-1"
          onChange={(e) => onChange({ quantity: Number(e.target.value) })}
        />
        <Select
          label="Unit"
          value={draft.unit}
          options={UNIT_OPTIONS}
          containerClassName="w-28 shrink-0"
          onChange={(e) => onChange({ unit: e.target.value as Unit })}
        />
      </div>

      <Input
        label="Expires on"
        type="date"
        value={draft.expiresAt}
        containerClassName="mt-3"
        hint={
          ingredient
            ? `Typical shelf life: ${ingredient.shelfLifeDays} days`
            : undefined
        }
        onChange={(e) => onChange({ expiresAt: e.target.value })}
      />

      {showStorage && (
        <div className="mt-3">
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Storage</p>
          <SegmentedControl<StorageLocation>
            label="Storage"
            size="sm"
            value={draft.storage}
            options={STORAGE_OPTIONS}
            onChange={(storage) => onChange({ storage })}
          />
        </div>
      )}
    </div>
  );
}

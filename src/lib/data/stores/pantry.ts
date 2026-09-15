"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ID, PantryItem } from "@/lib/types";
import { addDays, daysUntil, nowIso, toISODate, uid } from "@/lib/utils";
import { ingredientById } from "../seed/ingredients";
import { fromGrams, pantryItemGrams } from "../selectors";
import { persistConfig, trackHydration } from "../storage";
import { useProfileStore } from "./profile";

// Unit conversion lives in the (store-free) selectors module so that it can be
// used from pure code; re-exported here because that is where callers expect it.
export {
  DEFAULT_GRAMS_PER_PIECE,
  fromGrams,
  gramsPerPieceFor,
  pantryItemGrams,
  toGrams,
} from "../selectors";

export const PANTRY_STORE_KEY = "cookwise:pantry";

/** Used when an ingredient is missing from the catalog. */
export const DEFAULT_SHELF_LIFE_DAYS = 7;

const EPS = 1e-6;

function roundQty(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * `name`, `unit`, `expiresAt` and `source` default from the ingredient catalog,
 * so callers may pass just `{ ingredientId, quantity }`.
 */
export type PantryAddInput = Pick<PantryItem, "ingredientId" | "quantity"> &
  Partial<Pick<PantryItem, "id" | "name" | "unit" | "expiresAt" | "source">>;

export interface PantryState {
  items: PantryItem[];
  byId(id: ID): PantryItem | undefined;
  add(input: PantryAddInput): PantryItem;
  addMany(inputs: PantryAddInput[]): PantryItem[];
  update(id: ID, patch: Partial<PantryItem>): void;
  remove(id: ID): void;
  /** Deduct grams FIFO by earliest expiry (pcs rows converted via gramsPerPiece). */
  consume(ingredientId: ID, grams: number): void;
  /** Rows expiring within `withinDays` (includes already-expired), soonest first. */
  expiring(withinDays?: number): PantryItem[];
  totalGrams(ingredientId: ID): number;
  has(ingredientId: ID): boolean;
  reset(): void;
}

type PantryPersisted = { items: PantryItem[] };

function defaultExpiry(ingredientId: ID): string {
  const shelf = ingredientById(ingredientId)?.shelfLifeDays ?? DEFAULT_SHELF_LIFE_DAYS;
  return addDays(toISODate(), shelf);
}

function buildItem(input: PantryAddInput, userId: ID): PantryItem {
  const catalog = ingredientById(input.ingredientId);
  const ts = nowIso();
  return {
    id: input.id ?? uid(),
    userId,
    ingredientId: input.ingredientId,
    name: input.name ?? catalog?.name ?? input.ingredientId,
    quantity: input.quantity,
    unit: input.unit ?? catalog?.defaultUnit ?? "g",
    addedAt: ts,
    expiresAt: input.expiresAt ?? defaultExpiry(input.ingredientId),
    source: input.source ?? "manual",
    updatedAt: ts,
  };
}

export const usePantryStore = create<PantryState>()(
  persist<PantryState, [], [], PantryPersisted>(
    (set, get) => ({
      items: [],

      byId(id) {
        return get().items.find((i) => i.id === id);
      },

      add(input) {
        const item = buildItem(input, useProfileStore.getState().userId());
        set({ items: [...get().items, item] });
        return item;
      },

      addMany(inputs) {
        const userId = useProfileStore.getState().userId();
        const created = inputs.map((i) => buildItem(i, userId));
        if (created.length) set({ items: [...get().items, ...created] });
        return created;
      },

      update(id, patch) {
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, ...patch, id: i.id, updatedAt: nowIso() } : i,
          ),
        });
      },

      remove(id) {
        set({ items: get().items.filter((i) => i.id !== id) });
      },

      consume(ingredientId, grams) {
        if (!Number.isFinite(grams) || grams <= 0) return;
        const items = [...get().items];
        const rows = items
          .filter((i) => i.ingredientId === ingredientId)
          .sort(
            (a, b) =>
              a.expiresAt.localeCompare(b.expiresAt) ||
              a.addedAt.localeCompare(b.addedAt),
          );
        if (!rows.length) return;

        const ts = nowIso();
        const removed = new Set<ID>();
        let remaining = grams;

        for (const row of rows) {
          if (remaining <= EPS) break;
          const have = pantryItemGrams(row);
          if (have <= remaining + EPS) {
            remaining -= have;
            removed.add(row.id);
          } else {
            const leftGrams = have - remaining;
            remaining = 0;
            const idx = items.findIndex((i) => i.id === row.id);
            items[idx] = {
              ...row,
              quantity: roundQty(fromGrams(leftGrams, row.unit, ingredientId)),
              updatedAt: ts,
            };
          }
        }

        set({ items: items.filter((i) => !removed.has(i.id)) });
      },

      expiring(withinDays = 3) {
        return get()
          .items.filter((i) => daysUntil(i.expiresAt) <= withinDays)
          .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
      },

      totalGrams(ingredientId) {
        return get()
          .items.filter((i) => i.ingredientId === ingredientId)
          .reduce((sum, i) => sum + pantryItemGrams(i), 0);
      },

      has(ingredientId) {
        return get().items.some((i) => i.ingredientId === ingredientId);
      },

      reset() {
        set({ items: [] });
      },
    }),
    persistConfig<PantryState, PantryPersisted>(PANTRY_STORE_KEY, {
      partialize: (s) => ({ items: s.items }),
    }),
  ),
);

trackHydration(PANTRY_STORE_KEY, usePantryStore);

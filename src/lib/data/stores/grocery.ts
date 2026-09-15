"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildGroceryList } from "@/lib/engines/grocery";
import type { GroceryItem, GroceryList, ID, PantryItem } from "@/lib/types";
import { nowIso, uid } from "@/lib/utils";
import { INGREDIENTS } from "../seed/ingredients";
import { persistConfig, trackHydration } from "../storage";
import { usePantryStore } from "./pantry";
import { usePlanStore } from "./plan";
import { useProfileStore } from "./profile";
import { useRecipeStore } from "./recipes";

export const GROCERY_STORE_KEY = "cookwise:grocery";

export interface GroceryState {
  lists: GroceryList[];
  byId(id: ID): GroceryList | undefined;
  forPlan(planId: ID): GroceryList | undefined;
  /** Latest list, used by the grocery screen when no plan is selected. */
  latest(): GroceryList | undefined;
  /** Rebuilds the list for a plan, preserving purchase state per ingredient. */
  generateForPlan(planId: ID): GroceryList;
  togglePurchased(itemId: ID): void;
  setPurchased(itemId: ID, purchased: boolean): void;
  /** Moves purchased, not-yet-added items into the pantry. Returns what moved. */
  moveToPantry(listId: ID): PantryItem[];
  remove(listId: ID): void;
  reset(): void;
}

type GroceryPersisted = { lists: GroceryList[] };

/** Purchase state survives a regeneration so a half-shopped list is not lost. */
function carryOverFlags(
  items: GroceryItem[],
  previous: GroceryList | undefined,
  listId: ID,
): GroceryItem[] {
  const prev = new Map(
    (previous?.items ?? []).map((i) => [i.ingredientId, i] as const),
  );
  return items.map((i) => {
    const old = prev.get(i.ingredientId);
    return {
      ...i,
      id: i.id || uid(),
      listId,
      purchased: old?.purchased ?? i.purchased ?? false,
      addedToPantry: old?.addedToPantry ?? i.addedToPantry ?? false,
    };
  });
}

export const useGroceryStore = create<GroceryState>()(
  persist<GroceryState, [], [], GroceryPersisted>(
    (set, get) => ({
      lists: [],

      byId(id) {
        return get().lists.find((l) => l.id === id);
      },

      forPlan(planId) {
        return get().lists.find((l) => l.planId === planId);
      },

      latest() {
        return [...get().lists].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        )[0];
      },

      generateForPlan(planId) {
        const plan = usePlanStore.getState().planById(planId);
        const previous = get().lists.find((l) => l.planId === planId);
        const ts = nowIso();

        if (!plan) {
          const empty: GroceryList = previous ?? {
            id: uid(),
            userId: useProfileStore.getState().userId(),
            planId,
            items: [],
            createdAt: ts,
            updatedAt: ts,
          };
          if (!previous) set({ lists: [...get().lists, empty] });
          return empty;
        }

        const built = buildGroceryList(
          plan,
          useRecipeStore.getState().recipes,
          usePantryStore.getState().items,
          INGREDIENTS,
        );

        const id = previous?.id ?? built.id ?? uid();
        const list: GroceryList = {
          ...built,
          id,
          userId: useProfileStore.getState().userId(),
          planId,
          createdAt: previous?.createdAt ?? built.createdAt ?? ts,
          updatedAt: ts,
          items: carryOverFlags(built.items, previous, id),
        };

        set({ lists: [...get().lists.filter((l) => l.id !== id), list] });
        return list;
      },

      togglePurchased(itemId) {
        const current = get()
          .lists.flatMap((l) => l.items)
          .find((i) => i.id === itemId);
        get().setPurchased(itemId, !(current?.purchased ?? false));
      },

      setPurchased(itemId, purchased) {
        const ts = nowIso();
        set({
          lists: get().lists.map((l) =>
            l.items.some((i) => i.id === itemId)
              ? {
                  ...l,
                  updatedAt: ts,
                  items: l.items.map((i) =>
                    i.id === itemId ? { ...i, purchased } : i,
                  ),
                }
              : l,
          ),
        });
      },

      moveToPantry(listId) {
        const list = get().lists.find((l) => l.id === listId);
        if (!list) return [];
        const moving = list.items.filter((i) => i.purchased && !i.addedToPantry);
        if (!moving.length) return [];

        const added = usePantryStore.getState().addMany(
          moving.map((i) => ({
            ingredientId: i.ingredientId,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            source: "grocery" as const,
          })),
        );

        const movedIds = new Set(moving.map((i) => i.id));
        const ts = nowIso();
        set({
          lists: get().lists.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  updatedAt: ts,
                  items: l.items.map((i) =>
                    movedIds.has(i.id) ? { ...i, addedToPantry: true } : i,
                  ),
                }
              : l,
          ),
        });
        return added;
      },

      remove(listId) {
        set({ lists: get().lists.filter((l) => l.id !== listId) });
      },

      reset() {
        set({ lists: [] });
      },
    }),
    persistConfig<GroceryState, GroceryPersisted>(GROCERY_STORE_KEY, {
      partialize: (s) => ({ lists: s.lists }),
    }),
  ),
);

trackHydration(GROCERY_STORE_KEY, useGroceryStore);

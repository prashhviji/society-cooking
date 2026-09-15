"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyFeedback, emptyPreferenceModel } from "@/lib/engines/learning";
import type { ID, MealFeedback, PreferenceModel, Recipe } from "@/lib/types";
import { DEMO_USER_ID } from "../seed/demoUser";
import { persistConfig, trackHydration } from "../storage";

export const PREFERENCE_STORE_KEY = "cookwise:preferences";

export interface PreferenceState {
  model: PreferenceModel;
  apply(f: MealFeedback, recipe: Recipe): void;
  /** Re-key the model when a Supabase auth user signs in. */
  setUserId(id: ID): void;
  reset(): void;
}

type PreferencePersisted = { model: PreferenceModel };

export const usePreferenceStore = create<PreferenceState>()(
  persist<PreferenceState, [], [], PreferencePersisted>(
    (set, get) => ({
      model: emptyPreferenceModel(DEMO_USER_ID),

      apply(f, recipe) {
        set({ model: applyFeedback(get().model, f, recipe) });
      },

      setUserId(id) {
        const m = get().model;
        if (m.userId === id) return;
        set({ model: { ...m, userId: id } });
      },

      reset() {
        set({ model: emptyPreferenceModel(get().model.userId ?? DEMO_USER_ID) });
      },
    }),
    persistConfig<PreferenceState, PreferencePersisted>(PREFERENCE_STORE_KEY, {
      partialize: (s) => ({ model: s.model }),
    }),
  ),
);

trackHydration(PREFERENCE_STORE_KEY, usePreferenceStore);

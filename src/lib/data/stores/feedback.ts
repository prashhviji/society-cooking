"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ID, MealFeedback } from "@/lib/types";
import { nowIso, uid } from "@/lib/utils";
import { persistConfig, trackHydration } from "../storage";
import { usePreferenceStore } from "./preference";
import { useProfileStore } from "./profile";
import { useRecipeStore } from "./recipes";

export const FEEDBACK_STORE_KEY = "cookwise:feedback";

export type FeedbackInput = Omit<
  MealFeedback,
  "id" | "userId" | "createdAt"
>;

export interface FeedbackState {
  feedback: MealFeedback[];
  /** Stores the feedback and folds it into the preference model. */
  add(f: FeedbackInput): MealFeedback;
  forRecipe(recipeId: ID): MealFeedback[];
  forSession(sessionId: ID): MealFeedback | undefined;
  reset(): void;
}

type FeedbackPersisted = { feedback: MealFeedback[] };

export const useFeedbackStore = create<FeedbackState>()(
  persist<FeedbackState, [], [], FeedbackPersisted>(
    (set, get) => ({
      feedback: [],

      add(input) {
        const entry: MealFeedback = {
          ...input,
          id: uid(),
          userId: useProfileStore.getState().userId(),
          createdAt: nowIso(),
        };
        set({ feedback: [...get().feedback, entry] });

        const recipe = useRecipeStore.getState().byId(entry.recipeId);
        if (recipe) {
          try {
            usePreferenceStore.getState().apply(entry, recipe);
          } catch (err) {
            console.warn("[cookwise/feedback] preference update failed", err);
          }
        }
        return entry;
      },

      forRecipe(recipeId) {
        return get().feedback.filter((f) => f.recipeId === recipeId);
      },

      forSession(sessionId) {
        return get().feedback.find((f) => f.sessionId === sessionId);
      },

      reset() {
        set({ feedback: [] });
      },
    }),
    persistConfig<FeedbackState, FeedbackPersisted>(FEEDBACK_STORE_KEY, {
      partialize: (s) => ({ feedback: s.feedback }),
    }),
  ),
);

trackHydration(FEEDBACK_STORE_KEY, useFeedbackStore);

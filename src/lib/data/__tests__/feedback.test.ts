import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MealFeedback, PreferenceModel, Recipe } from "@/lib/types";

/** Deterministic learning engine: the store's job is wiring, not the maths. */
vi.mock("../../engines/learning", () => ({
  emptyPreferenceModel: (userId: string): PreferenceModel => ({
    userId,
    recipeScores: {},
    ingredientAffinity: {},
    cuisineAffinity: {},
    tagAffinity: {},
    spiceAdjust: 0,
    portionAdjust: 1,
    feedbackCount: 0,
    updatedAt: "2026-09-01T00:00:00.000Z",
  }),
  applyFeedback: (
    model: PreferenceModel,
    feedback: MealFeedback,
    recipe: Recipe,
  ): PreferenceModel => ({
    ...model,
    recipeScores: {
      ...model.recipeScores,
      [recipe.id]: (feedback.rating - 3) / 2,
    },
    cuisineAffinity: {
      ...model.cuisineAffinity,
      [recipe.cuisine]: (model.cuisineAffinity[recipe.cuisine] ?? 0) + 0.3,
    },
    feedbackCount: model.feedbackCount + 1,
    updatedAt: "2026-09-15T00:00:00.000Z",
  }),
  recommend: (recipes: Recipe[], _m: PreferenceModel, _p: unknown, n = 5) =>
    recipes.slice(0, n),
}));

const { useFeedbackStore } = await import("../stores/feedback");
const { usePreferenceStore } = await import("../stores/preference");
const { useRecipeStore } = await import("../stores/recipes");
const { waitForStoresHydrated } = await import("../storage");
const { makeRecipe } = await import("./fixtures");

const RECIPE = makeRecipe({ id: "ragi-dosa", cuisine: "south_indian" });

beforeAll(async () => {
  await waitForStoresHydrated();
});

beforeEach(() => {
  useFeedbackStore.setState({ feedback: [] });
  usePreferenceStore.getState().reset();
  useRecipeStore.setState({ recipes: [RECIPE] });
});

describe("useFeedbackStore.add", () => {
  it("stores the feedback with generated id/userId/createdAt", () => {
    const entry = useFeedbackStore.getState().add({
      recipeId: RECIPE.id,
      rating: 5,
      taste: 5,
      spice: "just_right",
      texture: "perfect",
      quantity: "just_right",
    });

    expect(entry.id).toBeTruthy();
    expect(entry.userId).toBeTruthy();
    expect(entry.createdAt).toBeTruthy();
    expect(useFeedbackStore.getState().feedback).toHaveLength(1);
    expect(useFeedbackStore.getState().forRecipe(RECIPE.id)).toHaveLength(1);
  });

  it("folds the feedback into the preference model", () => {
    expect(usePreferenceStore.getState().model.feedbackCount).toBe(0);

    useFeedbackStore.getState().add({
      recipeId: RECIPE.id,
      rating: 5,
      taste: 4,
      spice: "too_hot",
      texture: "perfect",
      quantity: "too_little",
    });

    const model = usePreferenceStore.getState().model;
    expect(model.feedbackCount).toBe(1);
    expect(model.recipeScores[RECIPE.id]).toBe(1);
    expect(model.cuisineAffinity.south_indian).toBeCloseTo(0.3);
  });

  it("still records feedback for a recipe missing from the catalog", () => {
    const entry = useFeedbackStore.getState().add({
      recipeId: "unknown-recipe",
      rating: 2,
      taste: 2,
      spice: "just_right",
      texture: "too_soft",
      quantity: "too_much",
    });
    expect(entry.recipeId).toBe("unknown-recipe");
    expect(usePreferenceStore.getState().model.feedbackCount).toBe(0);
  });
});

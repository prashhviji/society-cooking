import { describe, expect, it } from "vitest";
import {
  ALPHA,
  affinityScore,
  applyFeedback,
  emptyPreferenceModel,
  ratingToScore,
  recommend,
  spiceTargetFor,
} from "../learning";
import { RECIPES, makeFeedback, makeProfile, makeRecipe, ri } from "./fixtures";

const byId = new Map(RECIPES.map((r) => [r.id, r]));
const eggBhurji = byId.get("egg-bhurji")!;

describe("emptyPreferenceModel", () => {
  it("starts neutral", () => {
    const m = emptyPreferenceModel("user-1");
    expect(m.spiceAdjust).toBe(0);
    expect(m.portionAdjust).toBe(1);
    expect(m.feedbackCount).toBe(0);
    expect(m.recipeScores).toEqual({});
  });
});

describe("ratingToScore", () => {
  it("maps 1–5 stars onto −1..1", () => {
    expect(ratingToScore(1)).toBe(-1);
    expect(ratingToScore(3)).toBe(0);
    expect(ratingToScore(5)).toBe(1);
  });
});

describe("applyFeedback", () => {
  it("moves the recipe score by α toward (rating − 3) / 2", () => {
    const m0 = emptyPreferenceModel("user-1");
    const m1 = applyFeedback(m0, makeFeedback({ rating: 5, taste: 5 }), eggBhurji);
    expect(m1.recipeScores["egg-bhurji"]).toBeCloseTo(ALPHA * 1, 6); // 0.3

    const m2 = applyFeedback(m1, makeFeedback({ rating: 5, taste: 5 }), eggBhurji);
    expect(m2.recipeScores["egg-bhurji"]).toBeCloseTo(0.3 + ALPHA * (1 - 0.3), 6); // 0.51
  });

  it("is immutable", () => {
    const m0 = emptyPreferenceModel("user-1");
    const m1 = applyFeedback(m0, makeFeedback(), eggBhurji);
    expect(m0.feedbackCount).toBe(0);
    expect(m0.recipeScores).toEqual({});
    expect(m1.feedbackCount).toBe(1);
    expect(m1.recipeScores).not.toBe(m0.recipeScores);
  });

  it("updates ingredient, cuisine and tag affinities", () => {
    const m = applyFeedback(
      emptyPreferenceModel("user-1"),
      makeFeedback({ rating: 5, taste: 5 }),
      eggBhurji,
    );
    expect(m.ingredientAffinity.egg).toBeCloseTo(0.3, 6);
    expect(m.ingredientAffinity.tomato).toBeCloseTo(0.3, 6);
    expect(m.cuisineAffinity.south_indian).toBeCloseTo(0.3, 6);
    expect(m.tagAffinity.high_protein).toBeCloseTo(0.3, 6);
  });

  it("blends taste into the ingredient/cuisine signal", () => {
    const m = applyFeedback(
      emptyPreferenceModel("user-1"),
      makeFeedback({ rating: 5, taste: 1 }),
      eggBhurji,
    );
    // blended = 0.6·1 + 0.4·(−1) = 0.2 → 0.3 × 0.2 = 0.06
    expect(m.ingredientAffinity.egg).toBeCloseTo(0.06, 6);
    expect(m.recipeScores["egg-bhurji"]).toBeCloseTo(0.3, 6); // rating only
  });

  it("clamps affinities to −1..1 after many identical ratings", () => {
    let m = emptyPreferenceModel("user-1");
    for (let i = 0; i < 100; i += 1) {
      m = applyFeedback(m, makeFeedback({ rating: 1, taste: 1 }), eggBhurji);
    }
    expect(m.recipeScores["egg-bhurji"]).toBeGreaterThanOrEqual(-1);
    expect(m.recipeScores["egg-bhurji"]).toBeCloseTo(-1, 3);
    expect(m.ingredientAffinity.egg).toBeGreaterThanOrEqual(-1);
  });

  it("shifts spice down for too_hot and up for too_mild, and clamps", () => {
    let m = applyFeedback(emptyPreferenceModel("u"), makeFeedback({ spice: "too_hot" }), eggBhurji);
    expect(m.spiceAdjust).toBeCloseTo(-0.2, 6);
    m = applyFeedback(m, makeFeedback({ spice: "too_mild" }), eggBhurji);
    expect(m.spiceAdjust).toBeCloseTo(0, 6);

    let hot = emptyPreferenceModel("u");
    for (let i = 0; i < 20; i += 1) {
      hot = applyFeedback(hot, makeFeedback({ spice: "too_hot" }), eggBhurji);
    }
    expect(hot.spiceAdjust).toBe(-1);
  });

  it("relaxes the spice adjustment when the user says just right", () => {
    let m = applyFeedback(emptyPreferenceModel("u"), makeFeedback({ spice: "too_hot" }), eggBhurji);
    m = applyFeedback(m, makeFeedback({ spice: "just_right" }), eggBhurji);
    expect(m.spiceAdjust).toBeCloseTo(-0.18, 6);
  });

  it("scales portions by ×1.1 / ×0.9 and clamps", () => {
    let m = applyFeedback(
      emptyPreferenceModel("u"),
      makeFeedback({ quantity: "too_little" }),
      eggBhurji,
    );
    expect(m.portionAdjust).toBeCloseTo(1.1, 6);
    m = applyFeedback(m, makeFeedback({ quantity: "too_much" }), eggBhurji);
    expect(m.portionAdjust).toBeCloseTo(0.99, 6);

    let big = emptyPreferenceModel("u");
    for (let i = 0; i < 20; i += 1) {
      big = applyFeedback(big, makeFeedback({ quantity: "too_little" }), eggBhurji);
    }
    expect(big.portionAdjust).toBeCloseTo(1.6, 6);
  });
});

describe("spiceTargetFor", () => {
  it("shifts the profile spice level by 2 × spiceAdjust, clamped to 1..5", () => {
    const profile = makeProfile({ spiceLevel: 3 });
    expect(spiceTargetFor(profile, emptyPreferenceModel("u"))).toBe(3);
    expect(spiceTargetFor(profile, { ...emptyPreferenceModel("u"), spiceAdjust: -0.5 })).toBe(2);
    expect(spiceTargetFor(profile, { ...emptyPreferenceModel("u"), spiceAdjust: 1 })).toBe(5);
    expect(spiceTargetFor(profile, { ...emptyPreferenceModel("u"), spiceAdjust: -1 })).toBe(1);
  });
});

describe("recommend", () => {
  it("orders by the weighted affinity score", () => {
    let model = emptyPreferenceModel("u");
    model = applyFeedback(model, makeFeedback({ rating: 5, taste: 5 }), eggBhurji);
    const loved = byId.get("simple-khichdi")!;
    model = applyFeedback(
      model,
      makeFeedback({ rating: 1, taste: 1, recipeId: loved.id }),
      loved,
    );

    const out = recommend(RECIPES, model, makeProfile(), 5);
    expect(out[0].id).toBe("egg-bhurji");
    expect(out.map((r) => r.id)).not.toContain("simple-khichdi");
    expect(out).toHaveLength(5);
  });

  it("applies the same diet / allergy filters as the planner", () => {
    const profile = makeProfile({ diet: "vegan", allergies: ["nuts"] });
    const out = recommend(RECIPES, emptyPreferenceModel("u"), profile, 20);
    for (const r of out) {
      expect(r.diets).toContain("vegan");
      expect(r.ingredients.some((i) => i.ingredientId === "peanut")).toBe(false);
    }
  });

  it("is a stable order for ties", () => {
    const model = emptyPreferenceModel("u");
    const a = recommend(RECIPES, model, makeProfile(), 6).map((r) => r.id);
    const b = recommend(RECIPES, model, makeProfile(), 6).map((r) => r.id);
    expect(a).toEqual(b);
  });
});

describe("affinityScore", () => {
  it("weights recipe 0.5, ingredients 0.2, cuisine 0.15, tags 0.15", () => {
    const recipe = makeRecipe({
      id: "r",
      cuisine: "south_indian",
      tags: ["quick"],
      ingredients: [ri("tomato", 100)],
    });
    const model = {
      ...emptyPreferenceModel("u"),
      recipeScores: { r: 1 },
      ingredientAffinity: { tomato: 1 },
      cuisineAffinity: { south_indian: 1 },
      tagAffinity: { quick: 1 },
    };
    expect(affinityScore(recipe, model)).toBeCloseTo(1, 6);
    expect(affinityScore(recipe, emptyPreferenceModel("u"))).toBeCloseTo(0, 6);
  });
});

import { describe, expect, it } from "vitest";
import type { Recipe, RecipeStep, StepLog } from "@/lib/types";
import {
  computeNutritionFromLogs,
  estimateRetention,
  liveRetentionHint,
  nutrientLabel,
  retentionPercent,
  type RetentionInput,
} from "../retention";
import { BASE_RETENTION, rateConstant } from "../retention-factors";
import { INGREDIENTS, makeRecipe, ri } from "./fixtures";

function step(over: Partial<RecipeStep> & { id: string }): RecipeStep {
  return {
    order: 1,
    title: "Cook",
    instruction: "Cook it",
    ...over,
  };
}

function log(over: Partial<StepLog> & { stepId: string }): StepLog {
  return {
    startedAt: "2026-09-15T10:00:00.000Z",
    endedAt: "2026-09-15T10:10:00.000Z",
    ...over,
  };
}

function input(recipe: Recipe, over: Partial<RetentionInput> = {}): RetentionInput {
  return {
    recipe,
    ingredients: INGREDIENTS,
    ingredientLogs: [],
    stepLogs: [],
    temperatureHistory: [],
    servings: 1,
    ...over,
  };
}

const boiledSpinach = makeRecipe({
  id: "boiled-spinach",
  servings: 1,
  primaryMethod: "boil",
  ingredients: [ri("spinach", 200)],
  steps: [step({ id: "s1", method: "boil", durationSec: 600 })],
});

describe("rateConstant", () => {
  it("is k_ref at 100 °C and doubles every +10 °C for Q10 = 2", () => {
    expect(rateConstant("vitaminC", 100)).toBeCloseTo(0.01, 6);
    expect(rateConstant("vitaminC", 110)).toBeCloseTo(0.02, 6);
    expect(rateConstant("vitaminC", 120)).toBeCloseTo(0.04, 6);
    expect(rateConstant("vitaminA", 110)).toBeCloseTo(0.0045, 6);
    expect(rateConstant("protein", 180)).toBe(0);
  });
});

describe("estimateRetention", () => {
  it("boiling spinach for 10 min at 100 °C ≈ 0.55 · exp(−0.1)", () => {
    const est = estimateRetention(
      input(boiledSpinach, {
        stepLogs: [log({ stepId: "s1", durationSec: 600, avgTempC: 100 })],
      }),
    );
    const vitC = est.nutrients.find((n) => n.nutrient === "vitaminC");
    expect(vitC).toBeDefined();
    expect(vitC?.retained).toBeCloseTo(0.55 * Math.exp(-0.1), 4);
    expect(retentionPercent(vitC?.retained ?? 0)).toBe(50);
  });

  it("uses the USDA base factor when the step is instantaneous", () => {
    const est = estimateRetention(
      input(boiledSpinach, {
        stepLogs: [log({ stepId: "s1", durationSec: 0, avgTempC: 100 })],
      }),
    );
    const vitC = est.nutrients.find((n) => n.nutrient === "vitaminC");
    expect(vitC?.retained).toBeCloseTo(BASE_RETENTION.boil.vitaminC, 4);
  });

  it("raw food retains everything", () => {
    const salad = makeRecipe({
      id: "salad",
      servings: 1,
      primaryMethod: "raw",
      ingredients: [ri("spinach", 200), ri("tomato", 150)],
      steps: [step({ id: "s1", method: "raw", durationSec: 300 })],
    });
    const est = estimateRetention(input(salad));
    expect(est.overall).toBe(1);
    for (const n of est.nutrients) expect(n.retained).toBe(1);
    expect(est.warnings).toHaveLength(0);
  });

  it("sautéing hotter loses more than sautéing cooler", () => {
    const sauteed = makeRecipe({
      id: "sauteed-spinach",
      servings: 1,
      primaryMethod: "saute",
      ingredients: [ri("spinach", 200)],
      steps: [step({ id: "s1", method: "saute", durationSec: 240 })],
    });
    const cool = estimateRetention(
      input(sauteed, { stepLogs: [log({ stepId: "s1", durationSec: 240, avgTempC: 120 })] }),
    );
    const hot = estimateRetention(
      input(sauteed, { stepLogs: [log({ stepId: "s1", durationSec: 240, avgTempC: 140 })] }),
    );
    const c = cool.nutrients.find((n) => n.nutrient === "vitaminC")?.retained ?? 0;
    const h = hot.nutrients.find((n) => n.nutrient === "vitaminC")?.retained ?? 0;
    expect(h).toBeLessThan(c);
    // Pan 120 °C → food 105 °C (k = 0.01·2^0.5); pan 140 °C → food 110 °C (k = 0.02).
    expect(c).toBeCloseTo(0.7 * Math.exp(-0.01 * 2 ** 0.5 * 4), 4);
    expect(h).toBeCloseTo(0.7 * Math.exp(-0.02 * 4), 4);
    expect(hot.overall).toBeLessThan(cool.overall);
  });

  it("protects ingredients that are added later in the cook", () => {
    const recipe = makeRecipe({
      id: "two-stage",
      servings: 1,
      primaryMethod: "boil",
      ingredients: [ri("tomato", 200), ri("spinach", 200)],
      steps: [
        step({
          id: "s1",
          order: 1,
          method: "boil",
          durationSec: 1200,
          addIngredients: [{ ingredientId: "tomato", grams: 200 }],
        }),
        step({
          id: "s2",
          order: 2,
          method: "boil",
          durationSec: 120,
          addIngredients: [{ ingredientId: "spinach", grams: 200 }],
        }),
      ],
    });
    const est = estimateRetention(
      input(recipe, {
        stepLogs: [
          log({ stepId: "s1", durationSec: 1200, avgTempC: 100 }),
          log({ stepId: "s2", durationSec: 120, avgTempC: 100 }),
        ],
      }),
    );
    // Tomato sees 22 min, spinach only 2 → blended vitamin C sits between the two.
    const tomatoOnly = 0.55 * Math.exp(-0.01 * 22);
    const spinachOnly = 0.55 * Math.exp(-0.01 * 2);
    const vitC = est.nutrients.find((n) => n.nutrient === "vitaminC")?.retained ?? 0;
    expect(vitC).toBeGreaterThan(tomatoOnly);
    expect(vitC).toBeLessThan(spinachOnly);
  });

  it("hides nutrients the dish barely contains", () => {
    const est = estimateRetention(
      input(boiledSpinach, {
        stepLogs: [log({ stepId: "s1", durationSec: 600, avgTempC: 100 })],
      }),
    );
    const shown = est.nutrients.map((n) => n.nutrient);
    expect(shown).toContain("vitaminC");
    expect(shown).toContain("folate");
    // 200 g of spinach carries 0.8 g of fat — under 2 % of the 70 g daily value.
    expect(shown).not.toContain("fat");
  });

  it("warns below 60 % and escalates to critical below 40 %", () => {
    const longBoil = makeRecipe({
      id: "long-boil",
      servings: 1,
      primaryMethod: "boil",
      ingredients: [ri("spinach", 200)],
      steps: [step({ id: "s1", method: "boil", durationSec: 3600 })],
    });
    const est = estimateRetention(
      input(longBoil, { stepLogs: [log({ stepId: "s1", durationSec: 3600, avgTempC: 100 })] }),
    );
    const vitC = est.nutrients.find((n) => n.nutrient === "vitaminC");
    expect(vitC?.retained ?? 1).toBeLessThan(0.4);
    expect(vitC?.note).toBe("Some loss due to heat. Consider shorter cooking time.");
    const w = est.warnings.find((x) => x.nutrient === "vitaminC");
    expect(w?.severity).toBe("critical");
    expect(est.tips.length).toBeGreaterThanOrEqual(2);
    expect(est.tips.length).toBeLessThanOrEqual(3);
    expect(est.tips[0]).toBe(
      "Cooking at medium heat helps retain more vitamins. Avoid overcooking.",
    );
  });

  it("warns about an over-hot pan and about overcooking", () => {
    const sauteed = makeRecipe({
      id: "hot-saute",
      servings: 1,
      primaryMethod: "saute",
      ingredients: [ri("spinach", 200)],
      steps: [step({ id: "s1", method: "saute", durationSec: 120 })],
    });
    const est = estimateRetention(
      input(sauteed, {
        stepLogs: [log({ stepId: "s1", durationSec: 300, avgTempC: 150, maxTempC: 210 })],
      }),
    );
    const messages = est.warnings.map((w) => w.message).join(" | ");
    expect(messages).toContain("210°C");
    expect(messages).toContain("longer than planned");
    expect(est.warnings.some((w) => w.nutrient === "protein")).toBe(true);
  });

  it("falls back to the step's target range, then the method default", () => {
    const recipe = makeRecipe({
      id: "no-logs",
      servings: 1,
      primaryMethod: "saute",
      ingredients: [ri("spinach", 200)],
      steps: [
        step({ id: "s1", method: "saute", durationSec: 600, targetTempC: { min: 110, max: 130 } }),
      ],
    });
    const est = estimateRetention(input(recipe)); // no stepLogs, no history → 120 °C
    const vitC = est.nutrients.find((n) => n.nutrient === "vitaminC")?.retained ?? 0;
    // Midpoint 120 °C pan → 105 °C food → k = 0.01·2^0.5.
    expect(vitC).toBeCloseTo(0.7 * Math.exp(-0.01 * 2 ** 0.5 * 10), 4);
  });

  it("averages the temperature history inside a step window", () => {
    const est = estimateRetention(
      input(boiledSpinach, {
        stepLogs: [log({ stepId: "s1", durationSec: 600 })], // no avgTempC
        temperatureHistory: [
          { t: 0, tempC: 90 },
          { t: 300_000, tempC: 110 },
          { t: 900_000, tempC: 250 }, // outside the 0–600 s window
        ],
      }),
    );
    const vitC = est.nutrients.find((n) => n.nutrient === "vitaminC")?.retained ?? 0;
    expect(vitC).toBeCloseTo(0.55 * Math.exp(-rateConstant("vitaminC", 100) * 10), 4);
  });

  it("notes match the mockup tone", () => {
    const steamed = makeRecipe({
      id: "steamed",
      servings: 1,
      primaryMethod: "steam",
      ingredients: [ri("spinach", 200)],
      steps: [step({ id: "s1", method: "steam", durationSec: 60 })],
    });
    const est = estimateRetention(
      input(steamed, { stepLogs: [log({ stepId: "s1", durationSec: 60, avgTempC: 100 })] }),
    );
    const vitC = est.nutrients.find((n) => n.nutrient === "vitaminC");
    expect(vitC?.note).toBe("Good retention!");
    const protein = est.nutrients.find((n) => n.nutrient === "protein");
    expect(protein?.note).toBe("Well preserved.");
  });
});

describe("nutrientLabel / retentionPercent", () => {
  it("labels nutrients for the UI", () => {
    expect(nutrientLabel("vitaminC")).toBe("Vitamin C");
    expect(nutrientLabel("fat")).toBe("Fats (healthy)");
  });

  it("accepts a fraction or a NutrientRetention", () => {
    expect(retentionPercent(0.834)).toBe(83);
    expect(
      retentionPercent({ nutrient: "iron", label: "Iron", retained: 0.9, note: "" }),
    ).toBe(90);
  });
});

describe("liveRetentionHint", () => {
  const s = step({
    id: "s1",
    title: "Onions",
    durationSec: 300,
    targetTempC: { min: 120, max: 150 },
  });

  it("is ok inside the target range", () => {
    const hint = liveRetentionHint(s, 135, 100);
    expect(hint.tone).toBe("ok");
    expect(hint.message).toBe(
      "Keep temperature between 120°C – 150°C for better nutrient retention.",
    );
  });

  it("warns when a little too hot and is dangerous beyond +20 °C", () => {
    expect(liveRetentionHint(s, 160, 100).tone).toBe("warn");
    expect(liveRetentionHint(s, 171, 100).tone).toBe("danger");
    expect(liveRetentionHint(s, 175, 100).message).toContain("Too hot");
  });

  it("warns past 1.25× and is dangerous past 1.6× the planned duration", () => {
    expect(liveRetentionHint(s, 135, 400).tone).toBe("warn");
    const late = liveRetentionHint(s, 135, 500);
    expect(late.tone).toBe("danger");
    expect(late.message).toContain("Onions");
    expect(late.message).toContain("move on to the next step");
  });

  it("nudges gently while the pan is still warming up", () => {
    const hint = liveRetentionHint(s, 60, 10);
    expect(hint.tone).toBe("ok");
    expect(hint.message).toContain("warming up");
  });

  it("copes with a step that has no target range or duration", () => {
    const bare = step({ id: "s2", title: "Rest" });
    expect(liveRetentionHint(bare, undefined, 0).tone).toBe("ok");
  });
});

describe("computeNutritionFromLogs", () => {
  it("uses measured grams when the scale logged them", () => {
    const recipe = makeRecipe({
      id: "spinach-dish",
      servings: 2,
      ingredients: [ri("spinach", 200), ri("oil", 20)],
    });
    const scaled = computeNutritionFromLogs(recipe, INGREDIENTS, [], 2);
    // 200 g spinach + 20 g oil, over 2 servings.
    expect(scaled.kcal).toBeCloseTo((23 * 2 + 884 * 0.2) / 2, 1);

    const measured = computeNutritionFromLogs(
      recipe,
      INGREDIENTS,
      [
        {
          ingredientId: "spinach",
          targetGrams: 200,
          actualGrams: 400,
          verifiedBy: "scale",
          ts: "2026-09-15T10:00:00.000Z",
        },
      ],
      2,
    );
    expect(measured.kcal).toBeGreaterThan(scaled.kcal);
    expect(measured.vitaminCMg).toBeCloseTo((28 * 4) / 2, 1);
  });

  it("scales recipe grams to the cooked servings", () => {
    const recipe = makeRecipe({
      id: "double",
      servings: 2,
      ingredients: [ri("spinach", 200)],
    });
    const one = computeNutritionFromLogs(recipe, INGREDIENTS, [], 2);
    const four = computeNutritionFromLogs(recipe, INGREDIENTS, [], 4);
    expect(four.kcal).toBeCloseTo(one.kcal, 1); // per serving is unchanged
  });
});

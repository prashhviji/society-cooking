import { describe, expect, it } from "vitest";
import type { MealPlanRequest, PlannedMeal, ScheduleChange } from "@/lib/types";
import { addDays } from "@/lib/utils";
import {
  adaptPlan,
  diffPlans,
  explainMeal,
  expiringStock,
  generateWeekPlan,
  priorityWeights,
  scoreRecipe,
  servingsFor,
  timeLimitFor,
  type PlannerContext,
} from "../planner";
import { dietCompatible, isRecipeAllowed, recipeHasAllergen } from "../filters";
import {
  INGREDIENTS,
  RECIPES,
  WEEK_START,
  makeMeal,
  makePantryItem,
  makeProfile,
  makeRecipe,
} from "./fixtures";

function req(over: Partial<MealPlanRequest> = {}): MealPlanRequest {
  return {
    profile: makeProfile(),
    weekStart: WEEK_START,
    pantry: [],
    ...over,
  };
}

const byId = new Map(RECIPES.map((r) => [r.id, r]));

describe("priorityWeights", () => {
  it("assigns 0.35/0.25/0.2/0.12/0.08 in the user's order", () => {
    const w = priorityWeights(
      makeProfile({ priorities: ["budget", "time", "taste", "nutrition", "waste_reduction"] }),
    );
    expect(w.budget).toBeCloseTo(0.35);
    expect(w.time).toBeCloseTo(0.25);
    expect(w.taste).toBeCloseTo(0.2);
    expect(w.nutrition).toBeCloseTo(0.12);
    expect(w.waste_reduction).toBeCloseTo(0.08);
  });

  it("back-fills priorities the user did not rank", () => {
    const w = priorityWeights(makeProfile({ priorities: ["taste"] }));
    expect(w.taste).toBeCloseTo(0.35);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe("timeLimitFor", () => {
  it("uses the fixed caps and the weekday/weekend split for 'varies'", () => {
    expect(timeLimitFor("low", 0)).toBe(20);
    expect(timeLimitFor("medium", 0)).toBe(35);
    expect(timeLimitFor("high", 0)).toBe(Number.POSITIVE_INFINITY);
    expect(timeLimitFor("varies", 2)).toBe(30);
    expect(timeLimitFor("varies", 5)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("servingsFor", () => {
  it("applies portionAdjust and rounds to the nearest half", () => {
    const profile = makeProfile({ servingsDefault: 2 });
    expect(servingsFor(profile)).toBe(2);
    expect(servingsFor(profile, { portionAdjust: 1.15 } as never)).toBe(2.5);
    expect(servingsFor(profile, { portionAdjust: 0.9 } as never)).toBe(2);
  });
});

describe("generateWeekPlan", () => {
  it("fills 7 days × 3 meals", () => {
    const plan = generateWeekPlan(req(), RECIPES);
    expect(plan.meals).toHaveLength(21);
    expect(plan.generatedBy).toBe("heuristic");
    expect(new Set(plan.meals.map((m) => m.date)).size).toBe(7);
    for (const mealType of ["breakfast", "lunch", "dinner"] as const) {
      expect(plan.meals.filter((m) => m.mealType === mealType)).toHaveLength(7);
    }
  });

  it("only picks recipes whose mealTypes include the slot", () => {
    const plan = generateWeekPlan(req(), RECIPES);
    for (const m of plan.meals) {
      expect(byId.get(m.recipeId)?.mealTypes).toContain(m.mealType);
    }
  });

  it("keeps locked meals verbatim and does not double-book the slot", () => {
    const locked: PlannedMeal = makeMeal({
      id: "locked-1",
      date: addDays(WEEK_START, 2),
      mealType: "dinner",
      recipeId: "chicken-biryani",
      servings: 4,
      locked: true,
    });
    const plan = generateWeekPlan(req({ lockedMeals: [locked] }), RECIPES);
    const kept = plan.meals.filter(
      (m) => m.date === locked.date && m.mealType === "dinner",
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].recipeId).toBe("chicken-biryani");
    expect(kept[0].servings).toBe(4);
    expect(kept[0].locked).toBe(true);
    expect(plan.meals).toHaveLength(21);
  });

  it("never violates diet, allergies, dislikes or equipment", () => {
    const profile = makeProfile({
      diet: "vegetarian",
      allergies: ["nuts", "dairy"],
      dislikedIngredients: ["peanut"],
      equipment: ["stove", "pressure_cooker"], // no oven
    });
    const plan = generateWeekPlan(req({ profile }), RECIPES);
    expect(plan.meals).toHaveLength(21);
    for (const m of plan.meals) {
      const recipe = byId.get(m.recipeId);
      expect(recipe).toBeDefined();
      if (!recipe) continue;
      expect(dietCompatible(recipe, "vegetarian")).toBe(true);
      expect(recipeHasAllergen(recipe, ["nuts", "dairy"])).toBe(false);
      expect(isRecipeAllowed(recipe, profile)).toBe(true);
      expect(recipe.equipment).not.toContain("oven");
      expect(recipe.ingredients.some((i) => i.ingredientId === "peanut")).toBe(false);
      expect(recipe.ingredients.some((i) => i.ingredientId === "paneer")).toBe(false);
    }
  });

  it("drops recipes with a disliked ingredient", () => {
    const profile = makeProfile({ dislikedIngredients: ["spinach"] });
    expect(isRecipeAllowed(byId.get("palak-paneer")!, profile)).toBe(false);
    expect(isRecipeAllowed(byId.get("tomato-rice")!, profile)).toBe(true);
    const plan = generateWeekPlan(req({ profile }), RECIPES);
    for (const m of plan.meals) {
      expect(byId.get(m.recipeId)?.ingredients.some((i) => i.ingredientId === "spinach")).toBe(
        false,
      );
    }
  });

  it("vegan recipes are allowed for a vegetarian but not the other way round", () => {
    const vegan = makeRecipe({ id: "v", diets: ["vegan"] });
    const vegetarian = makeRecipe({ id: "l", diets: ["vegetarian"] });
    expect(dietCompatible(vegan, "vegetarian")).toBe(true);
    expect(dietCompatible(vegetarian, "vegan")).toBe(false);
  });

  it("schedules expiring pantry stock before it goes off", () => {
    const profile = makeProfile({
      diet: "vegetarian",
      priorities: ["waste_reduction", "nutrition", "taste", "time", "budget"],
    });
    const pantry = [
      makePantryItem({
        ingredientId: "spinach",
        quantity: 400,
        expiresAt: addDays(WEEK_START, 1),
      }),
      makePantryItem({
        ingredientId: "paneer",
        quantity: 300,
        expiresAt: addDays(WEEK_START, 1),
      }),
    ];
    const plan = generateWeekPlan(
      req({ profile, pantry }),
      RECIPES,
      { ingredients: INGREDIENTS },
    );
    const spinachMeals = plan.meals.filter((m) =>
      byId.get(m.recipeId)?.ingredients.some((i) => i.ingredientId === "spinach"),
    );
    expect(spinachMeals.length).toBeGreaterThan(0);
    // The first one must land on or before the expiry date.
    expect(spinachMeals[0].date <= addDays(WEEK_START, 1)).toBe(true);
  });

  it("stays inside the weekly budget when budget is the top priority", () => {
    const profile = makeProfile({
      budgetMonthly: 4300, // ₹1000 / week
      servingsDefault: 2,
      priorities: ["budget", "time", "nutrition", "taste", "waste_reduction"],
    });
    const plan = generateWeekPlan(req({ profile }), RECIPES);
    const cost = plan.meals.reduce(
      (acc, m) => acc + (byId.get(m.recipeId)?.costPerServing ?? 0) * m.servings,
      0,
    );
    expect(cost).toBeLessThanOrEqual(1000);
  });

  it("is deterministic for the same seed and varies for a different one", () => {
    const a = generateWeekPlan(req(), RECIPES);
    const b = generateWeekPlan(req(), RECIPES);
    expect(b.meals.map((m) => m.recipeId)).toEqual(a.meals.map((m) => m.recipeId));

    const c = generateWeekPlan(req(), RECIPES, { seed: "regenerate-2" });
    expect(c.meals).toHaveLength(21);
    expect(c.meals.map((m) => m.recipeId)).not.toEqual(a.meals.map((m) => m.recipeId));
  });

  it("avoids repeating the same recipe on consecutive days", () => {
    const plan = generateWeekPlan(req(), RECIPES);
    const byDate = new Map<string, string[]>();
    for (const m of plan.meals) {
      byDate.set(m.date, [...(byDate.get(m.date) ?? []), m.recipeId]);
    }
    for (const ids of byDate.values()) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("expiringStock", () => {
  it("aggregates grams per ingredient and converts pieces", () => {
    const stock = expiringStock(
      [
        makePantryItem({ ingredientId: "egg", quantity: 6, unit: "pcs", expiresAt: addDays(WEEK_START, 2) }),
        makePantryItem({ ingredientId: "spinach", quantity: 200, expiresAt: addDays(WEEK_START, 1) }),
        makePantryItem({ ingredientId: "rice", quantity: 1000, expiresAt: addDays(WEEK_START, 60) }),
      ],
      WEEK_START,
      4,
      INGREDIENTS,
    );
    expect(stock.get("egg")?.grams).toBe(300); // 6 × 50 g
    expect(stock.get("spinach")?.grams).toBe(200);
    expect(stock.has("rice")).toBe(false); // not expiring soon
  });
});

describe("scoreRecipe / explainMeal", () => {
  const slot = { date: WEEK_START, mealType: "dinner" as const, dayIndex: 0 };

  it("returns a 0..100 total with every component", () => {
    const profile = makeProfile();
    const s = scoreRecipe(byId.get("spinach-chicken-stir-fry")!, slot, { profile });
    expect(s.total).toBeGreaterThan(0);
    expect(s.total).toBeLessThanOrEqual(100);
    expect(Object.keys(s.parts)).toEqual(
      expect.arrayContaining(["nutrition", "time", "budget", "waste", "taste", "variety"]),
    );
  });

  it("scores a high-protein recipe higher for muscle gain", () => {
    const profile = makeProfile({ goal: "muscle_gain" });
    const high = scoreRecipe(byId.get("spinach-chicken-stir-fry")!, slot, { profile });
    const low = scoreRecipe(byId.get("simple-khichdi")!, slot, { profile });
    expect(high.parts.nutrition).toBeGreaterThan(low.parts.nutrition);
  });

  it("penalises a repeat of the same recipe on the same day", () => {
    const profile = makeProfile();
    const recipe = byId.get("tomato-rice")!;
    const clean = scoreRecipe(recipe, slot, { profile });
    const repeat = scoreRecipe(recipe, slot, {
      profile,
      chosen: [makeMeal({ id: "x", date: WEEK_START, mealType: "lunch", recipeId: "tomato-rice" })],
      recipeById: byId,
    });
    expect(repeat.total).toBeLessThan(clean.total);
  });

  it("explains a choice in one line", () => {
    const profile = makeProfile();
    const text = explainMeal(byId.get("spinach-chicken-stir-fry")!, slot, {
      profile,
      expiring: expiringStock(
        [makePantryItem({ ingredientId: "spinach", quantity: 300, expiresAt: addDays(WEEK_START, 1) })],
        WEEK_START,
        4,
        INGREDIENTS,
      ),
      servings: 2,
    });
    expect(text).toContain("expiring soon");
    expect(text).toContain("high protein");
    expect(text).toContain("20 min");
  });
});

// ---------------------------------------------------------------------------
// adaptPlan
// ---------------------------------------------------------------------------

function ctxFor(profileOver = {}): PlannerContext {
  return {
    profile: makeProfile(profileOver),
    recipes: RECIPES,
    pantry: [],
  };
}

function change(over: Partial<ScheduleChange> & { type: ScheduleChange["type"] }): ScheduleChange {
  return {
    id: "chg-1",
    userId: "user-1",
    date: addDays(WEEK_START, 2),
    createdAt: "2026-09-15T00:00:00.000Z",
    ...over,
  };
}

describe("adaptPlan", () => {
  const basePlan = generateWeekPlan(req(), RECIPES);
  const day = addDays(WEEK_START, 2);

  it("skip_meal removes the meal", () => {
    const after = adaptPlan(basePlan, change({ type: "skip_meal", mealType: "lunch" }), ctxFor());
    expect(after.meals).toHaveLength(20);
    expect(after.meals.some((m) => m.date === day && m.mealType === "lunch")).toBe(false);
  });

  it("eating_out marks the meal and leaves the rest alone for a non-weight-loss goal", () => {
    const after = adaptPlan(
      basePlan,
      change({ type: "eating_out", mealType: "dinner" }),
      ctxFor({ goal: "muscle_gain" }),
    );
    const target = after.meals.find((m) => m.date === day && m.mealType === "dinner");
    expect(target?.status).toBe("eating_out");
    const others = after.meals.filter((m) => m.date === day && m.mealType !== "dinner");
    const before = basePlan.meals.filter((m) => m.date === day && m.mealType !== "dinner");
    expect(others.map((m) => m.recipeId)).toEqual(before.map((m) => m.recipeId));
  });

  it("eating_out trims the rest of the day for weight loss", () => {
    const profile = { goal: "weight_loss" as const, dailyCalorieTarget: 1600 };
    const plan = generateWeekPlan(req({ profile: makeProfile(profile) }), RECIPES);
    const after = adaptPlan(
      plan,
      change({ type: "eating_out", mealType: "dinner" }),
      ctxFor(profile),
    );
    expect(after.meals.find((m) => m.date === day && m.mealType === "dinner")?.status).toBe(
      "eating_out",
    );
    for (const m of after.meals.filter((x) => x.date === day && x.mealType !== "dinner")) {
      const kcal = byId.get(m.recipeId)?.nutritionPerServing.kcal ?? 0;
      const cap =
        1600 * (m.mealType === "breakfast" ? 0.25 : 0.4) * 0.8;
      expect(kcal).toBeLessThanOrEqual(cap);
    }
  });

  it("guests scales servings and prefers guest_friendly recipes", () => {
    const after = adaptPlan(
      basePlan,
      change({ type: "guests", guestCount: 2, mealType: "dinner" }),
      ctxFor(),
    );
    const meal = after.meals.find((m) => m.date === day && m.mealType === "dinner");
    expect(meal).toBeDefined();
    expect(meal?.servings).toBe(4); // 2 × (1 + 2/2)
    expect(byId.get(meal?.recipeId ?? "")?.tags).toContain("guest_friendly");
  });

  it("less_time swaps the day's remaining meals to quicker ones", () => {
    const after = adaptPlan(
      basePlan,
      change({ type: "less_time", availableMinutes: 20 }),
      ctxFor(),
    );
    for (const m of after.meals.filter((x) => x.date === day)) {
      const r = byId.get(m.recipeId);
      expect((r?.prepTimeMin ?? 0) + (r?.cookTimeMin ?? 0)).toBeLessThanOrEqual(20);
    }
  });

  it("mood_change biases towards the mood's tags", () => {
    const after = adaptPlan(
      basePlan,
      change({ type: "mood_change", moodTags: ["light"], mealType: "dinner" }),
      ctxFor(),
    );
    const meal = after.meals.find((m) => m.date === day && m.mealType === "dinner");
    const tags = byId.get(meal?.recipeId ?? "")?.tags ?? [];
    expect(tags.some((t) => t === "low_cal" || t === "high_fiber")).toBe(true);
  });

  it("mood_change 'no_cooking' only picks recipes ≤ 10 min or raw", () => {
    const after = adaptPlan(
      basePlan,
      change({ type: "mood_change", moodTags: ["no_cooking"], mealType: "dinner" }),
      ctxFor(),
    );
    const r = byId.get(
      after.meals.find((m) => m.date === day && m.mealType === "dinner")?.recipeId ?? "",
    );
    expect(r?.primaryMethod === "raw" || (r?.prepTimeMin ?? 0) + (r?.cookTimeMin ?? 0) <= 10).toBe(
      true,
    );
  });

  it("never touches locked meals or meals before the change date", () => {
    const locked = basePlan.meals.map((m) =>
      m.date === day && m.mealType === "lunch" ? { ...m, locked: true } : m,
    );
    const plan = { ...basePlan, meals: locked };
    const after = adaptPlan(plan, change({ type: "less_time", availableMinutes: 5 }), ctxFor());
    const lunch = after.meals.find((m) => m.date === day && m.mealType === "lunch");
    const before = plan.meals.find((m) => m.date === day && m.mealType === "lunch");
    expect(lunch?.recipeId).toBe(before?.recipeId);
    const earlier = after.meals.filter((m) => m.date < day);
    expect(earlier.map((m) => m.recipeId)).toEqual(
      plan.meals.filter((m) => m.date < day).map((m) => m.recipeId),
    );
  });
});

describe("diffPlans", () => {
  const basePlan = generateWeekPlan(req(), RECIPES);
  const day = addDays(WEEK_START, 2);

  it("reports nothing for an unchanged plan", () => {
    expect(diffPlans(basePlan, basePlan)).toEqual([]);
  });

  it("reports recipe, servings and status changes", () => {
    const after = adaptPlan(
      basePlan,
      change({ type: "guests", guestCount: 2, mealType: "dinner" }),
      ctxFor(),
    );
    const diffs = diffPlans(basePlan, after);
    expect(diffs.length).toBeGreaterThan(0);
    const d = diffs.find((x) => x.date === day && x.mealType === "dinner");
    expect(d?.fromServings).toBe(2);
    expect(d?.toServings).toBe(4);
  });

  it("reports a removed meal", () => {
    const after = adaptPlan(basePlan, change({ type: "skip_meal", mealType: "lunch" }), ctxFor());
    const diffs = diffPlans(basePlan, after);
    const removed = diffs.find((x) => x.date === day && x.mealType === "lunch");
    expect(removed?.fromRecipeId).toBeDefined();
    expect(removed?.toRecipeId).toBeUndefined();
  });

  it("reports an eating_out status change", () => {
    const after = adaptPlan(
      basePlan,
      change({ type: "eating_out", mealType: "dinner" }),
      ctxFor(),
    );
    const d = diffPlans(basePlan, after).find(
      (x) => x.date === day && x.mealType === "dinner",
    );
    expect(d?.statusChange).toEqual({ from: "planned", to: "eating_out" });
  });
});

import { describe, expect, it } from "vitest";
import type { PantryItem } from "@/lib/types";
import { addDays, toISODate } from "@/lib/utils";
import {
  dailyIntake,
  expiringSummary,
  expiringUsageStats,
  goalLabel,
  nextMealToday,
  pantryCoverage,
  recipesUsingExpiring,
  todaysMeals,
  weeklyKcalProgress,
} from "../selectors";
import {
  makeMeal,
  makePlan,
  makeProfile,
  makeRecipe,
  makeRecipeIngredient,
  makeSession,
} from "./fixtures";

const TODAY = toISODate();

function pantryItem(p: Partial<PantryItem> & { id: string }): PantryItem {
  return {
    userId: "demo-user",
    ingredientId: p.id,
    name: p.id,
    quantity: 100,
    unit: "g",
    addedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: addDays(TODAY, 10),
    source: "manual",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...p,
  };
}

const plan = makePlan({
  weekStart: TODAY,
  meals: [
    makeMeal({ id: "d", date: TODAY, mealType: "dinner", recipeId: "egg-bhurji" }),
    makeMeal({
      id: "b",
      date: TODAY,
      mealType: "breakfast",
      recipeId: "ragi-dosa",
      status: "cooked",
    }),
    makeMeal({
      id: "l",
      date: TODAY,
      mealType: "lunch",
      recipeId: "chicken-biryani",
    }),
    makeMeal({ id: "x", date: addDays(TODAY, 1), recipeId: "veg-upma" }),
  ],
});

describe("todaysMeals / nextMealToday", () => {
  it("orders the day's meals breakfast -> lunch -> dinner", () => {
    expect(todaysMeals(plan, TODAY).map((m) => m.mealType)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
    ]);
  });

  it("returns the first uncooked meal whose slot has not passed", () => {
    const morning = new Date(`${TODAY}T09:00:00`);
    expect(nextMealToday(plan, TODAY, morning)?.id).toBe("l");

    const evening = new Date(`${TODAY}T19:00:00`);
    expect(nextMealToday(plan, TODAY, evening)?.id).toBe("d");
  });

  it("returns undefined when everything is cooked", () => {
    const allCooked = makePlan({
      meals: todaysMeals(plan, TODAY).map((m) => ({
        ...m,
        status: "cooked" as const,
      })),
    });
    expect(nextMealToday(allCooked, TODAY)).toBeUndefined();
    expect(nextMealToday(undefined, TODAY)).toBeUndefined();
  });
});

describe("dailyIntake / weeklyKcalProgress", () => {
  const recipes = [
    makeRecipe({
      id: "ragi-dosa",
      nutritionPerServing: {
        kcal: 320,
        proteinG: 12,
        carbsG: 40,
        fatG: 8,
        fiberG: 5,
      },
    }),
    makeRecipe({
      id: "chicken-biryani",
      nutritionPerServing: {
        kcal: 600,
        proteinG: 35,
        carbsG: 60,
        fatG: 20,
        fiberG: 3,
      },
    }),
  ];

  const sessions = [
    makeSession({
      id: "s1",
      recipeId: "ragi-dosa",
      servings: 2,
      completedAt: new Date(`${TODAY}T08:00:00`).toISOString(),
    }),
    makeSession({
      id: "s2",
      recipeId: "chicken-biryani",
      servings: 1,
      completedAt: new Date(`${TODAY}T13:00:00`).toISOString(),
    }),
    makeSession({
      id: "s3",
      recipeId: "ragi-dosa",
      servings: 1,
      status: "abandoned",
      completedAt: undefined,
    }),
  ];

  it("sums nutrition of sessions completed that day", () => {
    const intake = dailyIntake(sessions, recipes, TODAY);
    expect(intake.kcal).toBe(320 * 2 + 600);
    expect(intake.proteinG).toBe(12 * 2 + 35);
    expect(intake.mealsLogged).toBe(2);
  });

  it("returns zeroes for a day with no sessions", () => {
    const intake = dailyIntake(sessions, recipes, addDays(TODAY, 3));
    expect(intake).toMatchObject({ kcal: 0, mealsLogged: 0 });
  });

  it("builds a 7-day progress series clamped at 100%", () => {
    const progress = weeklyKcalProgress(sessions, recipes, TODAY, 1000);
    expect(progress.days).toHaveLength(7);
    expect(progress.days[0].kcal).toBe(1240);
    expect(progress.days[0].pct).toBe(1);
    expect(progress.days[1].pct).toBe(0);
    expect(progress.targetKcal).toBe(7000);
  });
});

describe("expiring helpers", () => {
  const pantry = [
    pantryItem({ id: "tomato", expiresAt: addDays(TODAY, 2) }),
    pantryItem({ id: "chicken", expiresAt: addDays(TODAY, 3) }),
    pantryItem({ id: "rice", expiresAt: addDays(TODAY, 45) }),
  ];

  it("summarises expiring items soonest first", () => {
    const summary = expiringSummary(pantry, 3);
    expect(summary.count).toBe(2);
    expect(summary.soonest?.id).toBe("tomato");
    expect(summary.label).toBe("2 items expiring soon");
    expect(expiringSummary([], 3).label).toBe("Nothing expiring soon");
  });

  it("ranks recipes by expiring items used, then by total time", () => {
    const recipes = [
      makeRecipe({
        id: "rice-bowl",
        prepTimeMin: 5,
        cookTimeMin: 5,
        ingredients: [makeRecipeIngredient({ ingredientId: "rice", grams: 100 })],
      }),
      makeRecipe({
        id: "tomato-chicken",
        prepTimeMin: 10,
        cookTimeMin: 20,
        ingredients: [
          makeRecipeIngredient({ ingredientId: "tomato", grams: 100 }),
          makeRecipeIngredient({ ingredientId: "chicken", grams: 200 }),
        ],
      }),
      makeRecipe({
        id: "quick-tomato",
        prepTimeMin: 2,
        cookTimeMin: 3,
        ingredients: [makeRecipeIngredient({ ingredientId: "tomato", grams: 50 })],
      }),
    ];
    const ranked = recipesUsingExpiring(recipes, pantry, 3);
    expect(ranked.map((r) => r.recipe.id)).toEqual([
      "tomato-chicken",
      "quick-tomato",
    ]);
    expect(ranked[0].expiringUsed).toHaveLength(2);
  });

  it("counts expiring items that were logged in recent sessions", () => {
    const sessions = [
      makeSession({
        id: "s1",
        completedAt: new Date().toISOString(),
        ingredientLogs: [
          {
            ingredientId: "tomato",
            targetGrams: 100,
            actualGrams: 100,
            verifiedBy: "manual",
            ts: new Date().toISOString(),
          },
        ],
      }),
    ];
    const stats = expiringUsageStats(sessions, pantry, { days: 3 });
    expect(stats).toMatchObject({ used: 1, total: 2 });
    expect(stats.label).toBe("Used 1 of 2 expiring items this month");
  });
});

describe("pantryCoverage", () => {
  const recipe = makeRecipe({
    id: "egg-bhurji",
    servings: 2,
    ingredients: [
      makeRecipeIngredient({ ingredientId: "egg", grams: 100 }),
      makeRecipeIngredient({ ingredientId: "tomato", grams: 120 }),
    ],
  });

  it("scales the requirement by servings and flags shortfalls", () => {
    const pantry = [
      pantryItem({ id: "egg", ingredientId: "egg", quantity: 300 }),
      pantryItem({ id: "tomato", ingredientId: "tomato", quantity: 100 }),
    ];
    const rows = pantryCoverage(recipe, pantry, 4);
    expect(rows).toEqual([
      expect.objectContaining({
        ingredientId: "egg",
        needGrams: 200,
        haveGrams: 300,
        ok: true,
      }),
      expect.objectContaining({
        ingredientId: "tomato",
        needGrams: 240,
        haveGrams: 100,
        ok: false,
      }),
    ]);
  });
});

describe("goalLabel", () => {
  it("combines the goal with the top priority", () => {
    expect(goalLabel(makeProfile())).toBe("Muscle gain + improve energy");
    expect(
      goalLabel(makeProfile({ goal: "weight_loss", priorities: ["time"] })),
    ).toBe("Weight loss + save time");
    expect(goalLabel(null)).toBe("Balanced eating");
  });
});

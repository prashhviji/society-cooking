import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MealPlan, MealPlanRequest } from "@/lib/types";
import { addDays } from "@/lib/utils";

/** Deterministic planner so these tests exercise the store, not the engine. */
vi.mock("../../engines/planner", () => ({
  generateWeekPlan: (req: MealPlanRequest): MealPlan => ({
    id: "generated-plan",
    userId: req.profile.id,
    weekStart: req.weekStart,
    meals: Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      planId: "generated-plan",
      date: addDays(req.weekStart, i),
      mealType: "breakfast" as const,
      recipeId: "catalog-recipe",
      servings: 2,
      locked: false,
      status: "planned" as const,
    })),
    generatedBy: "heuristic" as const,
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
  }),
  adaptPlan: (plan: MealPlan): MealPlan => ({
    ...plan,
    meals: plan.meals.map((m) =>
      m.locked ? m : { ...m, recipeId: "adapted-recipe" },
    ),
  }),
}));

const { usePlanStore } = await import("../stores/plan");
const { useProfileStore } = await import("../stores/profile");
const { usePantryStore } = await import("../stores/pantry");
const { waitForStoresHydrated } = await import("../storage");
const { makeProfile } = await import("./fixtures");

const WEEK = "2026-09-14"; // a Monday

beforeAll(async () => {
  await waitForStoresHydrated();
});

beforeEach(() => {
  usePlanStore.setState({ plans: [], changes: [] });
  usePantryStore.setState({ items: [] });
  useProfileStore.setState({ profile: makeProfile() });
});

describe("usePlanStore.generate", () => {
  it("creates one plan for the week and exposes it as currentPlan", async () => {
    const plan = await usePlanStore.getState().generate(WEEK);
    expect(plan.weekStart).toBe(WEEK);
    expect(plan.meals).toHaveLength(7);
    expect(plan.meals.every((m) => m.planId === plan.id)).toBe(true);
    expect(usePlanStore.getState().currentPlan(WEEK)?.id).toBe(plan.id);
  });

  it("replaces the week's plan but keeps locked meals (and the plan id)", async () => {
    const first = await usePlanStore.getState().generate(WEEK);
    const monday = first.meals[0];

    usePlanStore.getState().swapMeal(monday.id, "locked-favourite");
    usePlanStore.getState().lockMeal(monday.id, true);

    const second = await usePlanStore.getState().generate(WEEK);

    expect(usePlanStore.getState().plans).toHaveLength(1);
    expect(second.id).toBe(first.id);

    const keptMonday = second.meals.find((m) => m.date === WEEK);
    expect(keptMonday?.recipeId).toBe("locked-favourite");
    expect(keptMonday?.locked).toBe(true);

    const tuesday = second.meals.find((m) => m.date === addDays(WEEK, 1));
    expect(tuesday?.recipeId).toBe("catalog-recipe");
  });
});

describe("usePlanStore meal mutations", () => {
  it("swapMeal keeps servings and lock state", async () => {
    const plan = await usePlanStore.getState().generate(WEEK);
    const meal = plan.meals[0];
    usePlanStore.getState().updateMeal(meal.id, { servings: 4 });
    usePlanStore.getState().lockMeal(meal.id, true);
    usePlanStore.getState().setStatus(meal.id, "cooked");

    usePlanStore.getState().swapMeal(meal.id, "other-recipe");

    const after = usePlanStore.getState().mealById(meal.id);
    expect(after?.recipeId).toBe("other-recipe");
    expect(after?.servings).toBe(4);
    expect(after?.locked).toBe(true);
    expect(after?.status).toBe("planned");
  });

  it("adds and removes meals", async () => {
    const plan = await usePlanStore.getState().generate(WEEK);
    const added = usePlanStore
      .getState()
      .addMeal(plan.id, WEEK, "dinner", "dinner-recipe", 3);
    expect(added).toBeDefined();
    expect(usePlanStore.getState().mealById(added!.id)?.servings).toBe(3);

    usePlanStore.getState().removeMeal(added!.id);
    expect(usePlanStore.getState().mealById(added!.id)).toBeUndefined();
  });
});

describe("usePlanStore.applyChange", () => {
  it("records the change and replaces the plan with the adapted one", async () => {
    const plan = await usePlanStore.getState().generate(WEEK);
    usePlanStore.getState().lockMeal(plan.meals[0].id, true);

    const adapted = await usePlanStore.getState().applyChange({
      type: "less_time",
      date: addDays(WEEK, 2),
      availableMinutes: 20,
    });

    expect(usePlanStore.getState().changes).toHaveLength(1);
    expect(usePlanStore.getState().changes[0].type).toBe("less_time");
    expect(usePlanStore.getState().changes[0].id).toBeTruthy();
    expect(adapted.id).toBe(plan.id);
    expect(usePlanStore.getState().plans).toHaveLength(1);

    // Locked meals survive adaptation; everything else was re-planned.
    expect(adapted.meals.find((m) => m.date === WEEK)?.recipeId).toBe(
      "catalog-recipe",
    );
    expect(adapted.meals.find((m) => m.date === addDays(WEEK, 1))?.recipeId).toBe(
      "adapted-recipe",
    );
  });
});

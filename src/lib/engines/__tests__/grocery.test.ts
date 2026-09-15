import { describe, expect, it } from "vitest";
import type { MealPlan } from "@/lib/types";
import { addDays } from "@/lib/utils";
import { buildGroceryList, groceryTotals, packSizeFor, shortfall } from "../grocery";
import { INGREDIENTS, RECIPES, WEEK_START, makeMeal, makePantryItem } from "./fixtures";

const ingredientById = new Map(INGREDIENTS.map((i) => [i.id, i]));

function planWith(meals: MealPlan["meals"]): MealPlan {
  return {
    id: "plan-1",
    userId: "user-1",
    weekStart: WEEK_START,
    meals,
    generatedBy: "heuristic",
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
  };
}

describe("packSizeFor", () => {
  it("uses the category pack size and the per-id overrides", () => {
    expect(packSizeFor(ingredientById.get("salt"))).toBe(50); // spices
    expect(packSizeFor(ingredientById.get("oil"))).toBe(200); // oils
    expect(packSizeFor(ingredientById.get("rice"))).toBe(500); // grains
    expect(packSizeFor(ingredientById.get("tomato"))).toBe(100); // vegetables
    expect(packSizeFor(ingredientById.get("chicken"))).toBe(250); // proteins
    expect(packSizeFor(ingredientById.get("milk"))).toBe(500); // dairy
    expect(packSizeFor(undefined)).toBe(100);
  });
});

describe("shortfall (FIFO with expiry)", () => {
  it("covers a need from stock that is still good", () => {
    expect(
      shortfall(
        [{ date: "2026-09-16", grams: 200 }],
        [{ grams: 500, expiresAt: "2026-09-20" }],
      ),
    ).toBe(0);
  });

  it("ignores stock that expires before the meal", () => {
    expect(
      shortfall(
        [{ date: "2026-09-18", grams: 200 }],
        [{ grams: 500, expiresAt: "2026-09-16" }],
      ),
    ).toBe(200);
  });

  it("spends the earliest-expiring lot first", () => {
    // 100 g expires on the 15th, 100 g on the 25th.
    // The 15th's meal should eat the short-dated lot, leaving the later meal covered.
    expect(
      shortfall(
        [
          { date: "2026-09-15", grams: 100 },
          { date: "2026-09-20", grams: 100 },
        ],
        [
          { grams: 100, expiresAt: "2026-09-25" },
          { grams: 100, expiresAt: "2026-09-15" },
        ],
      ),
    ).toBe(0);
  });

  it("returns only the uncovered remainder", () => {
    expect(
      shortfall(
        [{ date: "2026-09-16", grams: 500 }],
        [{ grams: 120, expiresAt: "2026-09-20" }],
      ),
    ).toBe(380);
  });
});

describe("buildGroceryList", () => {
  it("scales recipe grams by servings and rounds up to pack sizes", () => {
    // Tomato Rice: rice 180 g, tomato 150 g, onion 60 g, oil 15 ml for 2 servings.
    const plan = planWith([
      makeMeal({ id: "m1", date: WEEK_START, mealType: "lunch", recipeId: "tomato-rice", servings: 4 }),
    ]);
    const list = buildGroceryList(plan, RECIPES, [], INGREDIENTS);
    const item = (id: string) => list.items.find((i) => i.ingredientId === id);

    expect(item("rice")?.grams).toBe(500); // 360 g needed → 1 × 500 g pack
    expect(item("tomato")?.grams).toBe(300); // 300 g needed exactly
    expect(item("onion")?.grams).toBe(200); // 120 g → 2 × 100 g
    expect(item("oil")?.grams).toBe(200); // 30 ml → 1 × 200 ml
  });

  it("subtracts pantry stock that is still good on the day", () => {
    const plan = planWith([
      makeMeal({ id: "m1", date: addDays(WEEK_START, 1), mealType: "lunch", recipeId: "tomato-rice", servings: 2 }),
    ]);
    const pantry = [
      makePantryItem({ ingredientId: "rice", quantity: 1000, expiresAt: addDays(WEEK_START, 200) }),
      makePantryItem({ ingredientId: "tomato", quantity: 100, expiresAt: addDays(WEEK_START, 3) }),
    ];
    const list = buildGroceryList(plan, RECIPES, pantry, INGREDIENTS);
    // Rice fully covered → not on the list at all.
    expect(list.items.some((i) => i.ingredientId === "rice")).toBe(false);
    // Tomato: need 150 g, have 100 g → 50 g short → rounds to 100 g.
    expect(list.items.find((i) => i.ingredientId === "tomato")?.grams).toBe(100);
  });

  it("does not credit pantry stock that expires before the meal", () => {
    const plan = planWith([
      makeMeal({ id: "m1", date: addDays(WEEK_START, 5), mealType: "lunch", recipeId: "tomato-rice", servings: 2 }),
    ]);
    const pantry = [
      makePantryItem({ ingredientId: "tomato", quantity: 500, expiresAt: addDays(WEEK_START, 1) }),
    ];
    const list = buildGroceryList(plan, RECIPES, pantry, INGREDIENTS);
    expect(list.items.find((i) => i.ingredientId === "tomato")?.grams).toBe(200); // 150 g → 2 × 100
  });

  it("buys whole pieces for pcs items and converts pantry pieces to grams", () => {
    // Egg Bhurji needs 100 g of egg for 2 servings; eggs are 50 g each.
    const plan = planWith([
      makeMeal({ id: "m1", date: WEEK_START, mealType: "breakfast", recipeId: "egg-bhurji", servings: 4 }),
    ]);
    const pantry = [
      makePantryItem({
        ingredientId: "egg",
        quantity: 2,
        unit: "pcs",
        expiresAt: addDays(WEEK_START, 6),
      }),
    ];
    const list = buildGroceryList(plan, RECIPES, pantry, INGREDIENTS);
    const egg = list.items.find((i) => i.ingredientId === "egg");
    expect(egg?.unit).toBe("pcs");
    expect(egg?.quantity).toBe(2); // need 200 g, have 100 g → 100 g → 2 pcs
    expect(egg?.grams).toBe(100);
  });

  it("prices each line from costPerKg and totals the list", () => {
    const plan = planWith([
      makeMeal({ id: "m1", date: WEEK_START, mealType: "lunch", recipeId: "tomato-rice", servings: 2 }),
    ]);
    const list = buildGroceryList(plan, RECIPES, [], INGREDIENTS);
    const rice = list.items.find((i) => i.ingredientId === "rice");
    expect(rice?.grams).toBe(500);
    expect(rice?.estimatedCost).toBeCloseTo(35, 2); // 0.5 kg × ₹70

    const totals = groceryTotals(list);
    expect(totals.itemCount).toBe(list.items.length);
    expect(totals.estimatedCost).toBeCloseTo(
      list.items.reduce((a, i) => a + i.estimatedCost, 0),
      2,
    );
    expect(totals.purchasedCount).toBe(0);
    expect(totals.remainingCost).toBeCloseTo(totals.estimatedCost, 2);
  });

  it("ignores meals that are not 'planned'", () => {
    const plan = planWith([
      makeMeal({ id: "m1", date: WEEK_START, mealType: "lunch", recipeId: "tomato-rice", status: "cooked" }),
      makeMeal({ id: "m2", date: WEEK_START, mealType: "dinner", recipeId: "tomato-rice", status: "eating_out" }),
    ]);
    expect(buildGroceryList(plan, RECIPES, [], INGREDIENTS).items).toHaveLength(0);
  });

  it("tracks purchased lines in the totals", () => {
    const plan = planWith([
      makeMeal({ id: "m1", date: WEEK_START, mealType: "lunch", recipeId: "tomato-rice", servings: 2 }),
    ]);
    const list = buildGroceryList(plan, RECIPES, [], INGREDIENTS);
    list.items[0].purchased = true;
    const totals = groceryTotals(list);
    expect(totals.purchasedCount).toBe(1);
    expect(totals.purchasedCost).toBeCloseTo(list.items[0].estimatedCost, 2);
  });
});

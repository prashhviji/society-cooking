import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GroceryList, MealPlan } from "@/lib/types";
import { addDays, toISODate } from "@/lib/utils";

vi.mock("../seed/ingredients", () => {
  const INGREDIENTS = [
    {
      id: "tomato",
      name: "Tomato",
      category: "vegetables",
      emoji: "🍅",
      defaultUnit: "g",
      shelfLifeDays: 5,
      storage: "fridge",
      costPerKg: 40,
      nutrition: { kcal: 18, proteinG: 1, carbsG: 4, fatG: 0, fiberG: 1 },
      aliases: [],
    },
    {
      id: "onion",
      name: "Onion",
      category: "vegetables",
      emoji: "🧅",
      defaultUnit: "g",
      shelfLifeDays: 20,
      storage: "pantry",
      costPerKg: 30,
      nutrition: { kcal: 40, proteinG: 1, carbsG: 9, fatG: 0, fiberG: 2 },
      aliases: [],
    },
  ];
  const byId = new Map(INGREDIENTS.map((i) => [i.id, i]));
  return { INGREDIENTS, ingredientById: (id: string) => byId.get(id) };
});

/** Deterministic grocery engine: two rows, always the same ingredients. */
vi.mock("../../engines/grocery", () => ({
  buildGroceryList: (plan: MealPlan): GroceryList => ({
    id: "built-list",
    userId: plan.userId,
    planId: plan.id,
    items: [
      {
        id: "gi-tomato",
        listId: "built-list",
        ingredientId: "tomato",
        name: "Tomato",
        quantity: 500,
        unit: "g" as const,
        grams: 500,
        estimatedCost: 20,
        purchased: false,
        addedToPantry: false,
      },
      {
        id: "gi-onion",
        listId: "built-list",
        ingredientId: "onion",
        name: "Onion",
        quantity: 1000,
        unit: "g" as const,
        grams: 1000,
        estimatedCost: 30,
        purchased: false,
        addedToPantry: false,
      },
    ],
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
  }),
}));

const { useGroceryStore } = await import("../stores/grocery");
const { usePantryStore } = await import("../stores/pantry");
const { usePlanStore } = await import("../stores/plan");
const { waitForStoresHydrated } = await import("../storage");
const { makePlan } = await import("./fixtures");

const plan = makePlan({ id: "plan-g", weekStart: "2026-09-14" });

beforeAll(async () => {
  await waitForStoresHydrated();
});

beforeEach(() => {
  useGroceryStore.setState({ lists: [] });
  usePantryStore.setState({ items: [] });
  usePlanStore.setState({ plans: [plan], changes: [] });
});

describe("useGroceryStore.generateForPlan", () => {
  it("builds one list per plan", () => {
    const list = useGroceryStore.getState().generateForPlan(plan.id);
    expect(list.planId).toBe(plan.id);
    expect(list.items).toHaveLength(2);
    expect(useGroceryStore.getState().forPlan(plan.id)?.id).toBe(list.id);
  });

  it("preserves purchase state for the same ingredient when regenerating", () => {
    const first = useGroceryStore.getState().generateForPlan(plan.id);
    const tomato = first.items.find((i) => i.ingredientId === "tomato")!;
    useGroceryStore.getState().togglePurchased(tomato.id);
    expect(
      useGroceryStore.getState().forPlan(plan.id)?.items.find((i) => i.id === tomato.id)
        ?.purchased,
    ).toBe(true);

    const second = useGroceryStore.getState().generateForPlan(plan.id);
    expect(useGroceryStore.getState().lists).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second.items.find((i) => i.ingredientId === "tomato")?.purchased).toBe(
      true,
    );
    expect(second.items.find((i) => i.ingredientId === "onion")?.purchased).toBe(
      false,
    );
  });
});

describe("useGroceryStore.moveToPantry", () => {
  it("adds purchased items to the pantry once, with source 'grocery'", () => {
    const list = useGroceryStore.getState().generateForPlan(plan.id);
    const tomato = list.items.find((i) => i.ingredientId === "tomato")!;
    useGroceryStore.getState().setPurchased(tomato.id, true);

    const moved = useGroceryStore.getState().moveToPantry(list.id);
    expect(moved).toHaveLength(1);
    expect(moved[0].ingredientId).toBe("tomato");
    expect(moved[0].source).toBe("grocery");
    expect(moved[0].expiresAt).toBe(addDays(toISODate(), 5));
    expect(usePantryStore.getState().totalGrams("tomato")).toBe(500);

    // Second call is a no-op: the item is flagged addedToPantry.
    expect(useGroceryStore.getState().moveToPantry(list.id)).toHaveLength(0);
    expect(usePantryStore.getState().items).toHaveLength(1);
    expect(
      useGroceryStore
        .getState()
        .forPlan(plan.id)
        ?.items.find((i) => i.id === tomato.id)?.addedToPantry,
    ).toBe(true);
  });

  it("ignores unpurchased items", () => {
    const list = useGroceryStore.getState().generateForPlan(plan.id);
    expect(useGroceryStore.getState().moveToPantry(list.id)).toHaveLength(0);
    expect(usePantryStore.getState().items).toHaveLength(0);
  });
});

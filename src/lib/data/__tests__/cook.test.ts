import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RetentionEstimate, TempSample } from "@/lib/types";

vi.mock("../seed/ingredients", () => {
  const INGREDIENTS = [
    {
      id: "egg",
      name: "Eggs",
      category: "proteins",
      emoji: "🥚",
      defaultUnit: "pcs",
      gramsPerPiece: 50,
      shelfLifeDays: 14,
      storage: "fridge",
      costPerKg: 300,
      nutrition: { kcal: 143, proteinG: 13, carbsG: 1, fatG: 10, fiberG: 0 },
      aliases: [],
    },
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
  ];
  const byId = new Map(INGREDIENTS.map((i) => [i.id, i]));
  return { INGREDIENTS, ingredientById: (id: string) => byId.get(id) };
});

vi.mock("../../engines/retention", () => ({
  estimateRetention: (): RetentionEstimate => ({
    overall: 0.82,
    nutrients: [],
    warnings: [],
    tips: [],
    computedAt: "2026-09-15T00:00:00.000Z",
  }),
  liveRetentionHint: () => ({ tone: "ok" as const, message: "" }),
}));

const { useCookStore, capTemperatureHistory, MAX_TEMP_SAMPLES } = await import(
  "../stores/cook"
);
const { usePantryStore } = await import("../stores/pantry");
const { usePlanStore } = await import("../stores/plan");
const { useRecipeStore } = await import("../stores/recipes");
const { waitForStoresHydrated } = await import("../storage");
const { makeMeal, makePlan, makeRecipe, makeRecipeIngredient } = await import(
  "./fixtures"
);

const RECIPE = makeRecipe({
  id: "egg-bhurji",
  servings: 2,
  ingredients: [
    makeRecipeIngredient({ ingredientId: "egg", grams: 100, unit: "pcs", quantity: 2 }),
    makeRecipeIngredient({ ingredientId: "tomato", grams: 120 }),
  ],
  steps: [
    { id: "s1", order: 1, title: "Heat", instruction: "Heat the pan" },
    { id: "s2", order: 2, title: "Cook", instruction: "Cook the eggs" },
  ],
});

beforeAll(async () => {
  await waitForStoresHydrated();
});

beforeEach(() => {
  useCookStore.setState({ sessions: [], activeId: null });
  useRecipeStore.setState({ recipes: [RECIPE] });
  usePantryStore.setState({ items: [] });
  usePlanStore.setState({ plans: [], changes: [] });
  usePantryStore.getState().add({ ingredientId: "egg", quantity: 6 });
  usePantryStore.getState().add({ ingredientId: "tomato", quantity: 500 });
});

describe("useCookStore session lifecycle", () => {
  it("starts in 'verifying' and becomes the active session", () => {
    const s = useCookStore.getState().start(RECIPE.id, 2);
    expect(s.status).toBe("verifying");
    expect(s.pantryDeducted).toBe(false);
    expect(useCookStore.getState().activeId).toBe(s.id);
    expect(useCookStore.getState().active()?.id).toBe(s.id);
  });

  it("upserts ingredient logs by ingredientId", () => {
    useCookStore.getState().start(RECIPE.id, 2);
    const log = {
      ingredientId: "egg",
      targetGrams: 100,
      actualGrams: 95,
      verifiedBy: "scale" as const,
      ts: "2026-09-15T06:00:00.000Z",
    };
    useCookStore.getState().logIngredient(log);
    useCookStore.getState().logIngredient({ ...log, actualGrams: 105 });
    const logs = useCookStore.getState().active()!.ingredientLogs;
    expect(logs).toHaveLength(1);
    expect(logs[0].actualGrams).toBe(105);
  });

  it("summarises step temperature from samples inside the step window", () => {
    const session = useCookStore.getState().start(RECIPE.id, 2);
    const start = Date.parse(session.startedAt);
    useCookStore.getState().startStep("s1");

    const stepStart = Date.parse(
      useCookStore.getState().active()!.stepLogs[0].startedAt,
    );
    const offset = stepStart - start;
    const samples: TempSample[] = [
      { t: offset + 100, tempC: 100 },
      { t: offset + 200, tempC: 200 },
      { t: offset + 10_000_000, tempC: 999 }, // far outside the window
    ];
    for (const s of samples) useCookStore.getState().addTemp(s);

    useCookStore
      .getState()
      .endStep("s1", { endedAt: new Date(stepStart + 1000).toISOString() });

    const log = useCookStore.getState().active()!.stepLogs[0];
    expect(log.endedAt).toBeTruthy();
    expect(log.durationSec).toBe(1);
    expect(log.avgTempC).toBe(150);
    expect(log.maxTempC).toBe(200);
  });

  it("caps the temperature history by thinning older samples", () => {
    const history: TempSample[] = Array.from(
      { length: MAX_TEMP_SAMPLES + 501 },
      (_, i) => ({ t: i, tempC: i }),
    );
    const capped = capTemperatureHistory(history);
    expect(capped.length).toBeLessThanOrEqual(MAX_TEMP_SAMPLES);
    // Most recent sample is always kept.
    expect(capped[capped.length - 1]).toEqual(history[history.length - 1]);
  });
});

describe("useCookStore.complete", () => {
  it("deducts the pantry exactly once and marks the planned meal cooked", () => {
    const meal = makeMeal({ id: "meal-1", recipeId: RECIPE.id, servings: 2 });
    usePlanStore.setState({
      plans: [makePlan({ meals: [meal] })],
      changes: [],
    });

    useCookStore.getState().start(RECIPE.id, 2, meal.id);
    useCookStore.getState().logIngredient({
      ingredientId: "egg",
      targetGrams: 100,
      actualGrams: 150, // logged value wins over the recipe amount
      verifiedBy: "scale",
      ts: "2026-09-15T06:00:00.000Z",
    });

    const done = useCookStore.getState().complete();

    expect(done?.status).toBe("completed");
    expect(done?.completedAt).toBeTruthy();
    expect(done?.pantryDeducted).toBe(true);
    expect(done?.retention?.overall).toBe(0.82);
    expect(useCookStore.getState().activeId).toBeNull();

    // 300 g of eggs - 150 g logged = 150 g = 3 pcs; 500 g - 120 g tomato = 380 g
    expect(usePantryStore.getState().totalGrams("egg")).toBe(150);
    expect(usePantryStore.getState().totalGrams("tomato")).toBe(380);
    expect(usePlanStore.getState().mealById(meal.id)?.status).toBe("cooked");

    // Completing again must not deduct a second time.
    useCookStore.setState({ activeId: done!.id });
    useCookStore.getState().complete();
    expect(usePantryStore.getState().totalGrams("egg")).toBe(150);
    expect(usePantryStore.getState().totalGrams("tomato")).toBe(380);
  });

  it("scales unlogged ingredients by servings", () => {
    useCookStore.getState().start(RECIPE.id, 4); // recipe serves 2
    useCookStore.getState().complete();
    // tomato: 120 g x (4/2) = 240 g
    expect(usePantryStore.getState().totalGrams("tomato")).toBe(260);
    // egg: 100 g x 2 = 200 g -> 300 - 200 = 100 g
    expect(usePantryStore.getState().totalGrams("egg")).toBe(100);
  });

  it("abandon clears the active session without deducting", () => {
    const s = useCookStore.getState().start(RECIPE.id, 2);
    useCookStore.getState().abandon();
    expect(useCookStore.getState().activeId).toBeNull();
    expect(useCookStore.getState().byId(s.id)?.status).toBe("abandoned");
    expect(usePantryStore.getState().totalGrams("tomato")).toBe(500);
  });
});

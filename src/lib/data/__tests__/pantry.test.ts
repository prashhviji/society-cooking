import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, toISODate } from "@/lib/utils";

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
    // No catalog entry for "mystery" on purpose.
  ];
  const byId = new Map(INGREDIENTS.map((i) => [i.id, i]));
  return {
    INGREDIENTS,
    ingredientById: (id: string) => byId.get(id),
  };
});

const { usePantryStore, DEFAULT_GRAMS_PER_PIECE } = await import(
  "../stores/pantry"
);
const { waitForStoresHydrated } = await import("../storage");

const today = toISODate();

beforeAll(async () => {
  await waitForStoresHydrated();
});

beforeEach(() => {
  usePantryStore.setState({ items: [] });
});

describe("usePantryStore.add", () => {
  it("defaults name, unit and expiry from the ingredient catalog", () => {
    const item = usePantryStore.getState().add({
      ingredientId: "tomato",
      quantity: 500,
    });
    expect(item.name).toBe("Tomato");
    expect(item.unit).toBe("g");
    expect(item.expiresAt).toBe(addDays(today, 5));
    expect(item.source).toBe("manual");
    expect(item.userId).toBeTruthy();
  });

  it("keeps explicit overrides", () => {
    const item = usePantryStore.getState().add({
      ingredientId: "tomato",
      quantity: 2,
      unit: "pcs",
      name: "Cherry tomato",
      expiresAt: addDays(today, 1),
      source: "grocery",
    });
    expect(item.unit).toBe("pcs");
    expect(item.name).toBe("Cherry tomato");
    expect(item.expiresAt).toBe(addDays(today, 1));
    expect(item.source).toBe("grocery");
  });
});

describe("usePantryStore.consume", () => {
  it("deducts FIFO by earliest expiry and removes emptied rows", () => {
    const store = usePantryStore.getState();
    const soon = store.add({
      ingredientId: "tomato",
      quantity: 200,
      expiresAt: addDays(today, 1),
    });
    const later = store.add({
      ingredientId: "tomato",
      quantity: 500,
      expiresAt: addDays(today, 6),
    });

    usePantryStore.getState().consume("tomato", 300);

    const items = usePantryStore.getState().items;
    expect(items.find((i) => i.id === soon.id)).toBeUndefined();
    expect(items.find((i) => i.id === later.id)?.quantity).toBe(400);
    expect(usePantryStore.getState().totalGrams("tomato")).toBe(400);
  });

  it("converts pcs rows via the catalog gramsPerPiece", () => {
    usePantryStore.getState().add({ ingredientId: "egg", quantity: 6 });
    expect(usePantryStore.getState().totalGrams("egg")).toBe(300);

    // 2 eggs = 100 g at 50 g/piece
    usePantryStore.getState().consume("egg", 100);
    expect(usePantryStore.getState().items[0].quantity).toBe(4);
    expect(usePantryStore.getState().items[0].unit).toBe("pcs");
  });

  it("falls back to 100 g per piece when the ingredient is not in the catalog", () => {
    usePantryStore
      .getState()
      .add({ ingredientId: "mystery", quantity: 3, unit: "pcs" });
    expect(usePantryStore.getState().totalGrams("mystery")).toBe(
      3 * DEFAULT_GRAMS_PER_PIECE,
    );
    usePantryStore.getState().consume("mystery", DEFAULT_GRAMS_PER_PIECE);
    expect(usePantryStore.getState().items[0].quantity).toBe(2);
  });

  it("drains every row when more is consumed than is in stock", () => {
    usePantryStore.getState().add({ ingredientId: "tomato", quantity: 100 });
    usePantryStore.getState().add({ ingredientId: "tomato", quantity: 50 });
    usePantryStore.getState().consume("tomato", 999);
    expect(usePantryStore.getState().items).toHaveLength(0);
  });

  it("ignores non-positive and unknown-ingredient consumption", () => {
    usePantryStore.getState().add({ ingredientId: "tomato", quantity: 100 });
    usePantryStore.getState().consume("tomato", 0);
    usePantryStore.getState().consume("tomato", -5);
    usePantryStore.getState().consume("onion", 100);
    expect(usePantryStore.getState().totalGrams("tomato")).toBe(100);
  });
});

describe("usePantryStore.expiring", () => {
  it("returns items expiring within the window, soonest first", () => {
    const store = usePantryStore.getState();
    store.add({
      ingredientId: "tomato",
      quantity: 100,
      expiresAt: addDays(today, 5),
    });
    store.add({
      ingredientId: "tomato",
      quantity: 100,
      expiresAt: addDays(today, 2),
    });
    store.add({
      ingredientId: "tomato",
      quantity: 100,
      expiresAt: addDays(today, -1),
    });

    const expiring = usePantryStore.getState().expiring(3);
    expect(expiring.map((i) => i.expiresAt)).toEqual([
      addDays(today, -1),
      addDays(today, 2),
    ]);
  });
});

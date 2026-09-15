/** Shared fixtures for the data-layer tests (not a test file itself). */

import type {
  CookSession,
  Ingredient,
  MealPlan,
  PlannedMeal,
  Recipe,
  RecipeIngredient,
  UserProfile,
} from "@/lib/types";

export function makeIngredient(
  p: Partial<Ingredient> & { id: string },
): Ingredient {
  return {
    name: p.id,
    category: "other",
    emoji: "🥄",
    defaultUnit: "g",
    shelfLifeDays: 7,
    storage: "pantry",
    costPerKg: 100,
    nutrition: { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, fiberG: 1 },
    aliases: [],
    ...p,
  };
}

export function makeRecipeIngredient(
  p: Partial<RecipeIngredient> & { ingredientId: string; grams: number },
): RecipeIngredient {
  return {
    name: p.ingredientId,
    quantity: p.grams,
    unit: "g",
    ...p,
  };
}

export function makeRecipe(p: Partial<Recipe> & { id: string }): Recipe {
  return {
    name: p.id,
    description: "",
    cuisine: "south_indian",
    mealTypes: ["dinner"],
    tags: [],
    emoji: "🍲",
    servings: 2,
    prepTimeMin: 10,
    cookTimeMin: 10,
    difficulty: "easy",
    spiceLevel: 2,
    diets: ["non_vegetarian", "vegetarian"],
    equipment: ["stove"],
    primaryMethod: "saute",
    ingredients: [],
    steps: [],
    nutritionPerServing: {
      kcal: 300,
      proteinG: 20,
      carbsG: 25,
      fatG: 10,
      fiberG: 4,
    },
    costPerServing: 40,
    isPublic: true,
    ...p,
  };
}

export function makeProfile(p: Partial<UserProfile> = {}): UserProfile {
  const ts = "2026-09-01T00:00:00.000Z";
  return {
    id: "demo-user",
    name: "Tester",
    diet: "non_vegetarian",
    allergies: [],
    restrictions: [],
    goal: "muscle_gain",
    dailyCalorieTarget: 2500,
    proteinTargetG: 130,
    equipment: ["stove"],
    favoriteFoods: [],
    dislikedIngredients: [],
    cuisines: [],
    spiceLevel: 2,
    budgetMonthly: 5000,
    currency: "INR",
    skill: "beginner",
    timeAvailability: "varies",
    priorities: ["nutrition", "budget", "time", "taste", "waste_reduction"],
    servingsDefault: 2,
    onboardingComplete: true,
    createdAt: ts,
    updatedAt: ts,
    ...p,
  };
}

export function makeMeal(p: Partial<PlannedMeal> & { id: string }): PlannedMeal {
  return {
    planId: "plan-1",
    date: "2026-09-14",
    mealType: "dinner",
    recipeId: "r1",
    servings: 2,
    locked: false,
    status: "planned",
    ...p,
  };
}

export function makePlan(p: Partial<MealPlan> = {}): MealPlan {
  const ts = "2026-09-14T00:00:00.000Z";
  return {
    id: "plan-1",
    userId: "demo-user",
    weekStart: "2026-09-14",
    meals: [],
    generatedBy: "heuristic",
    createdAt: ts,
    updatedAt: ts,
    ...p,
  };
}

export function makeSession(
  p: Partial<CookSession> & { id: string },
): CookSession {
  return {
    userId: "demo-user",
    recipeId: "r1",
    servings: 2,
    status: "completed",
    startedAt: "2026-09-15T06:00:00.000Z",
    completedAt: "2026-09-15T07:00:00.000Z",
    ingredientLogs: [],
    stepLogs: [],
    temperatureHistory: [],
    pantryDeducted: true,
    ...p,
  };
}

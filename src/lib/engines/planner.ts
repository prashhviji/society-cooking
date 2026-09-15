/**
 * Heuristic weekly meal planner.
 *
 * `generateWeekPlan` fills 7 days × (breakfast, lunch, dinner) greedily:
 * hard filters remove impossible recipes, a weighted 0–100 soft score ranks the
 * rest, and a seeded PRNG breaks ties so the same input always yields the same
 * plan (while "Regenerate" with a new `seed` yields a different one).
 *
 * `adaptPlan` re-optimises the remaining meals after a `ScheduleChange`.
 */

import type {
  ID,
  Ingredient,
  ISODate,
  MealPlan,
  MealPlanRequest,
  MealType,
  PantryItem,
  PlannedMeal,
  PlannedMealStatus,
  PreferenceModel,
  Priority,
  Recipe,
  RecipeTag,
  ScheduleChange,
  TimeAvailability,
  UserProfile,
} from "@/lib/types";
import { addDays, clamp, humanize, nowIso, uid } from "@/lib/utils";
import {
  DAYS_PER_WEEK,
  DEFAULT_PRIORITY_ORDER,
  EATING_OUT_KCAL_FACTOR,
  ENERGY_INGREDIENT_HINTS,
  LAST_WEEKDAY_INDEX,
  MEAL_KCAL_SPLIT,
  MOOD_SPECS,
  PLAN_MEAL_TYPES,
  PRIORITY_WEIGHTS,
  SCORE_JITTER,
  TAG_PHRASES,
  TIME_LIMIT_MIN,
  VARIETY_SAME_CUISINE_PENALTY,
  VARIETY_SAME_METHOD_PENALTY,
  VARIETY_SAME_RECIPE_PENALTY,
  VARIETY_WINDOW_DAYS,
  WASTE_SATURATION_G,
  WASTE_WINDOW_DAYS,
  WEEKS_PER_MONTH,
  type MoodSpec,
} from "./constants";
import { isRecipeAllowed } from "./filters";
import {
  daysBetween,
  hashSeed,
  matchesToken,
  mean,
  mulberry32,
  normalizeText,
  roundToHalf,
} from "./helpers";
import { gramsOf, indexIngredients } from "./nutrition";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlannerContext {
  profile: UserProfile;
  recipes: Recipe[];
  pantry: PantryItem[];
  preferences?: PreferenceModel;
}

/** One (day, mealType) cell of the week grid. */
export interface MealSlot {
  date: ISODate;
  mealType: MealType;
  /** 0 = Monday … 6 = Sunday. */
  dayIndex: number;
}

/** Aggregated pantry stock that is about to go off. */
export interface ExpiringStock {
  ingredientId: ID;
  grams: number;
  /** Earliest expiry among the lots counted here. */
  expiresAt: ISODate;
}

/** Everything `scoreRecipe` needs. Every field but `profile` is optional. */
export interface ScoreContext {
  profile: UserProfile;
  preferences?: PreferenceModel;
  /** Soon-to-expire pantry grams keyed by ingredient id. */
  expiring?: Map<ID, ExpiringStock>;
  /** Meals already committed, for the variety penalty. */
  chosen?: PlannedMeal[];
  recipeById?: Map<ID, Recipe>;
  /** `budgetMonthly / 4.3`. */
  weeklyBudget?: number;
  spentSoFar?: number;
  /** Slots still to fill, including this one. */
  remainingMeals?: number;
  servings?: number;
  /** Extra per-tag bias in −1..1; used by `adaptPlan` for mood changes. */
  tagBias?: Partial<Record<RecipeTag, number>>;
  /** Seeded PRNG. When absent, scoring is fully deterministic (no jitter). */
  rng?: () => number;
}

export interface RecipeScore {
  /** 0..100. */
  total: number;
  parts: Record<string, number>;
}

export interface GenerateOptions {
  /** Change this to get a different (still deterministic) plan. */
  seed?: number | string;
  /** Catalog, used to convert `pcs` pantry quantities to grams. */
  ingredients?: Ingredient[];
  /** Reference date for "expiring soon"; defaults to `req.weekStart`. */
  today?: ISODate;
}

export interface MealDiff {
  mealId: ID;
  date: ISODate;
  mealType: MealType;
  fromRecipeId?: ID;
  toRecipeId?: ID;
  fromServings?: number;
  toServings?: number;
  statusChange?: { from: PlannedMealStatus; to: PlannedMealStatus };
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

const MEAL_ORDER: Record<MealType, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

function slotKey(date: ISODate, mealType: MealType): string {
  return `${date}|${mealType}`;
}

function compareMeals(a: PlannedMeal, b: PlannedMeal): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType];
}

/** Servings for every generated meal, honouring the learned portion adjust. */
export function servingsFor(
  profile: UserProfile,
  preferences?: PreferenceModel,
): number {
  const raw = (profile.servingsDefault || 2) * (preferences?.portionAdjust ?? 1);
  return Math.max(1, roundToHalf(raw));
}

/** `profile.priorities` order → a weight per priority (unranked ones back-filled). */
export function priorityWeights(profile: UserProfile): Record<Priority, number> {
  const order: Priority[] = [];
  for (const p of profile.priorities ?? []) if (!order.includes(p)) order.push(p);
  for (const p of DEFAULT_PRIORITY_ORDER) if (!order.includes(p)) order.push(p);
  const out = {} as Record<Priority, number>;
  order.forEach((p, i) => {
    out[p] = PRIORITY_WEIGHTS[i] ?? 0.05;
  });
  return out;
}

/** Minutes of prep+cook tolerated for a slot. */
export function timeLimitFor(ta: TimeAvailability, dayIndex: number): number {
  if (ta === "varies") {
    return dayIndex <= LAST_WEEKDAY_INDEX
      ? TIME_LIMIT_MIN.varies
      : Number.POSITIVE_INFINITY;
  }
  return TIME_LIMIT_MIN[ta] ?? TIME_LIMIT_MIN.medium;
}

/**
 * Aggregate pantry stock that expires within `withinDays` of `from`.
 * Grams are summed per ingredient; `expiresAt` is the earliest lot.
 */
export function expiringStock(
  pantry: readonly PantryItem[],
  from: ISODate,
  withinDays: number = WASTE_WINDOW_DAYS,
  ingredients?: readonly Ingredient[],
): Map<ID, ExpiringStock> {
  const catalog = indexIngredients(ingredients);
  const out = new Map<ID, ExpiringStock>();
  for (const item of pantry ?? []) {
    const left = daysBetween(from, item.expiresAt);
    if (left > withinDays) continue;
    const grams = gramsOf(item.quantity, item.unit, catalog.get(item.ingredientId));
    if (grams <= 0) continue;
    const prev = out.get(item.ingredientId);
    if (prev) {
      prev.grams += grams;
      if (item.expiresAt < prev.expiresAt) prev.expiresAt = item.expiresAt;
    } else {
      out.set(item.ingredientId, {
        ingredientId: item.ingredientId,
        grams,
        expiresAt: item.expiresAt,
      });
    }
  }
  return out;
}

function recipeHasEnergyIngredient(recipe: Recipe): boolean {
  for (const ri of recipe.ingredients ?? []) {
    const hay = `${ri.ingredientId} ${ri.name}`;
    if (ENERGY_INGREDIENT_HINTS.some((t) => matchesToken(hay, t))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Soft-score components (each 0..100)
// ---------------------------------------------------------------------------

/** Target kcal for one serving in a slot. */
export function kcalTargetFor(profile: UserProfile, mealType: MealType): number {
  const split = MEAL_KCAL_SPLIT[mealType] ?? 1 / 3;
  return Math.max(1, (profile.dailyCalorieTarget || 2000) * split);
}

function nutritionFit(recipe: Recipe, slot: MealSlot, profile: UserProfile): number {
  const kcalTarget = kcalTargetFor(profile, slot.mealType);
  const proteinTarget = Math.max(
    1,
    (profile.proteinTargetG || 60) * (MEAL_KCAL_SPLIT[slot.mealType] ?? 1 / 3),
  );
  const kcal = recipe.nutritionPerServing?.kcal ?? 0;
  const protein = recipe.nutritionPerServing?.proteinG ?? 0;

  // Gaussian around the target: ±35 % is still a decent fit.
  const kcalScore =
    100 * Math.exp(-0.5 * ((kcal - kcalTarget) / (0.35 * kcalTarget)) ** 2);
  const proteinScore = 100 * clamp(protein / proteinTarget, 0, 1);

  const tags = new Set(recipe.tags ?? []);
  let bonus = 0;
  switch (profile.goal) {
    case "muscle_gain":
      if (tags.has("high_protein")) bonus += 15;
      break;
    case "weight_loss":
      if (tags.has("low_cal")) bonus += 10;
      if (tags.has("high_fiber")) bonus += 5;
      break;
    case "improve_energy":
      if (recipeHasEnergyIngredient(recipe)) bonus += 10;
      if (tags.has("high_fiber")) bonus += 4;
      break;
    default:
      if (tags.has("high_fiber")) bonus += 5;
      if (tags.has("high_protein")) bonus += 5;
      break;
  }
  return clamp(0.55 * kcalScore + 0.45 * proteinScore + bonus, 0, 100);
}

function timeFit(recipe: Recipe, slot: MealSlot, profile: UserProfile): number {
  const total = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);
  const limit = timeLimitFor(profile.timeAvailability, slot.dayIndex);
  if (!Number.isFinite(limit)) return clamp(100 - total * 0.4, 40, 100);
  if (total <= limit) return clamp(100 - 40 * (total / limit), 60, 100);
  return clamp(60 - (total - limit) * 2.5, 0, 60);
}

function budgetFit(recipe: Recipe, ctx: ScoreContext, servings: number): number {
  const weekly = ctx.weeklyBudget ?? 0;
  if (!weekly || !Number.isFinite(weekly)) return 70;
  const spent = ctx.spentSoFar ?? 0;
  const remaining = Math.max(1, ctx.remainingMeals ?? 1);
  const allowance = Math.max(1, (weekly - spent) / remaining);
  const cost = (recipe.costPerServing ?? 0) * servings;
  if (spent + cost > weekly) return 0;
  if (cost <= allowance) return clamp(100 - 25 * (cost / allowance), 75, 100);
  return clamp(75 - 75 * ((cost - allowance) / allowance), 0, 75);
}

interface WasteFit {
  score: number;
  items: number;
  grams: number;
}

function wasteFit(
  recipe: Recipe,
  slot: MealSlot,
  ctx: ScoreContext,
  servings: number,
): WasteFit {
  const expiring = ctx.expiring;
  if (!expiring || expiring.size === 0) return { score: 0, items: 0, grams: 0 };
  const scale = servings / Math.max(1, recipe.servings || 1);
  let covered = 0;
  let items = 0;
  let urgency = 0;
  for (const ri of recipe.ingredients ?? []) {
    const stock = expiring.get(ri.ingredientId);
    if (!stock || stock.grams <= 0) continue;
    // Only a bonus when the meal is cooked on or before the expiry date.
    if (slot.date > stock.expiresAt) continue;
    const g = Math.min(ri.grams * scale, stock.grams);
    if (g <= 0) continue;
    covered += g;
    items += 1;
    const daysLeft = Math.max(0, daysBetween(slot.date, stock.expiresAt));
    urgency = Math.max(urgency, 1 / (1 + daysLeft));
  }
  if (covered <= 0) return { score: 0, items: 0, grams: 0 };
  const base = 100 * clamp(covered / WASTE_SATURATION_G, 0, 1);
  return {
    score: clamp(base * (0.75 + 0.35 * urgency), 0, 100),
    items,
    grams: covered,
  };
}

/** Spice level the plan should aim for, given the learned adjustment. */
export function spiceTarget(profile: UserProfile, preferences?: PreferenceModel): number {
  return clamp((profile.spiceLevel || 3) + 2 * (preferences?.spiceAdjust ?? 0), 1, 5);
}

function favouriteMatch(recipe: Recipe, favourites: readonly string[] | undefined): boolean {
  const name = normalizeText(recipe.name);
  for (const fav of favourites ?? []) {
    const f = normalizeText(fav);
    if (!f) continue;
    if (name.includes(f) || f.includes(name)) return true;
  }
  return false;
}

function tasteFit(recipe: Recipe, ctx: ScoreContext): number {
  const { profile, preferences } = ctx;
  let t = 40;

  if ((profile.cuisines ?? []).includes(recipe.cuisine)) t += 18;

  const diff = Math.abs((recipe.spiceLevel ?? 3) - spiceTarget(profile, preferences));
  t += 18 * Math.max(0, 1 - diff / 2.5);

  if (favouriteMatch(recipe, profile.favoriteFoods)) t += 12;

  if (preferences) {
    t += 20 * clamp(preferences.recipeScores?.[recipe.id] ?? 0, -1, 1);
    t += 8 * clamp(preferences.cuisineAffinity?.[recipe.cuisine] ?? 0, -1, 1);
    const tagAff = mean(
      (recipe.tags ?? []).map((tag) => clamp(preferences.tagAffinity?.[tag] ?? 0, -1, 1)),
    );
    t += 8 * tagAff;
    const ingAff = mean(
      (recipe.ingredients ?? []).map((ri) =>
        clamp(preferences.ingredientAffinity?.[ri.ingredientId] ?? 0, -1, 1),
      ),
    );
    t += 8 * ingAff;
  }

  if (ctx.tagBias) {
    let bias = 0;
    for (const tag of recipe.tags ?? []) bias += ctx.tagBias[tag] ?? 0;
    t += 25 * clamp(bias, -1, 1);
  }

  return clamp(t, 0, 100);
}

function varietyPenalty(recipe: Recipe, slot: MealSlot, ctx: ScoreContext): number {
  const chosen = ctx.chosen ?? [];
  const byId = ctx.recipeById;
  let penalty = 0;
  let sameMethodToday = 0;
  let sameCuisineToday = 0;

  for (const m of chosen) {
    if (m.recipeId === recipe.id) {
      const gap = Math.abs(daysBetween(m.date, slot.date));
      if (gap <= VARIETY_WINDOW_DAYS) {
        penalty += Math.max(
          0,
          VARIETY_SAME_RECIPE_PENALTY - 10 * gap,
        );
      }
    }
    if (m.date === slot.date && byId) {
      const other = byId.get(m.recipeId);
      if (!other) continue;
      if (other.primaryMethod === recipe.primaryMethod) sameMethodToday += 1;
      if (other.cuisine === recipe.cuisine) sameCuisineToday += 1;
    }
  }
  penalty += VARIETY_SAME_METHOD_PENALTY * sameMethodToday;
  penalty += VARIETY_SAME_CUISINE_PENALTY * sameCuisineToday;
  return penalty;
}

// ---------------------------------------------------------------------------
// Scoring & explanation
// ---------------------------------------------------------------------------

/**
 * Weighted 0–100 fit of `recipe` for `slot`.
 * `parts` carries every component so the UI can explain a choice.
 */
export function scoreRecipe(
  recipe: Recipe,
  slot: MealSlot,
  ctx: ScoreContext,
): RecipeScore {
  const servings = ctx.servings ?? ctx.profile.servingsDefault ?? 2;
  const w = priorityWeights(ctx.profile);

  const nutrition = nutritionFit(recipe, slot, ctx.profile);
  const time = timeFit(recipe, slot, ctx.profile);
  const budget = budgetFit(recipe, ctx, servings);
  const waste = wasteFit(recipe, slot, ctx, servings);
  const taste = tasteFit(recipe, ctx);
  const variety = varietyPenalty(recipe, slot, ctx);
  const jitter = ctx.rng ? ctx.rng() * SCORE_JITTER : 0;

  const weighted =
    w.nutrition * nutrition +
    w.time * time +
    w.budget * budget +
    w.waste_reduction * waste.score +
    w.taste * taste;

  return {
    total: clamp(weighted - variety + jitter, 0, 100),
    parts: {
      nutrition,
      time,
      budget,
      waste: waste.score,
      taste,
      variety: -variety,
      expiringItems: waste.items,
      expiringGrams: Math.round(waste.grams),
    },
  };
}

/** One-line reason, e.g. "Uses 2 items expiring soon · high protein · 20 min". */
export function explainMeal(
  recipe: Recipe,
  slot: MealSlot,
  ctx: ScoreContext,
): string {
  const servings = ctx.servings ?? ctx.profile.servingsDefault ?? 2;
  const parts: string[] = [];

  const waste = wasteFit(recipe, slot, ctx, servings);
  if (waste.items > 0) {
    parts.push(
      `Uses ${waste.items} item${waste.items === 1 ? "" : "s"} expiring soon`,
    );
  }

  for (const tag of recipe.tags ?? []) {
    const phrase = TAG_PHRASES[tag];
    if (phrase) {
      parts.push(phrase);
      break;
    }
  }

  if (parts.length < 2 && (ctx.profile.cuisines ?? []).includes(recipe.cuisine)) {
    parts.push(`${humanize(recipe.cuisine)} favourite`);
  }

  parts.push(`${(recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0)} min`);
  return parts.slice(0, 3).join(" · ");
}

// ---------------------------------------------------------------------------
// Week generation
// ---------------------------------------------------------------------------

function weekSlots(weekStart: ISODate): MealSlot[] {
  const slots: MealSlot[] = [];
  for (let d = 0; d < DAYS_PER_WEEK; d += 1) {
    const date = addDays(weekStart, d);
    for (const mealType of PLAN_MEAL_TYPES) {
      slots.push({ date, mealType, dayIndex: d });
    }
  }
  return slots;
}

function candidatesFor(allowed: readonly Recipe[], mealType: MealType): Recipe[] {
  const matching = allowed.filter((r) => (r.mealTypes ?? []).includes(mealType));
  // Relax the slot requirement rather than leaving a hole in the week.
  return matching.length > 0 ? matching : [...allowed];
}

function bestOf(
  candidates: readonly Recipe[],
  slot: MealSlot,
  ctx: ScoreContext,
): Recipe | undefined {
  let best: Recipe | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const r of candidates) {
    const s = scoreRecipe(r, slot, ctx).total;
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

/** Deduct the grams a chosen recipe will use so later days do not re-claim them. */
function consumeExpiring(
  expiring: Map<ID, ExpiringStock>,
  recipe: Recipe,
  servings: number,
): void {
  const scale = servings / Math.max(1, recipe.servings || 1);
  for (const ri of recipe.ingredients ?? []) {
    const stock = expiring.get(ri.ingredientId);
    if (!stock) continue;
    stock.grams = Math.max(0, stock.grams - ri.grams * scale);
    if (stock.grams <= 0) expiring.delete(ri.ingredientId);
  }
}

export function generateWeekPlan(
  req: MealPlanRequest,
  recipes: Recipe[],
  opts: GenerateOptions = {},
): MealPlan {
  const ts = nowIso();
  const planId = uid();
  const { profile, weekStart } = req;

  const recipeById = new Map<ID, Recipe>(recipes.map((r) => [r.id, r]));
  const allowed = recipes.filter((r) => isRecipeAllowed(r, profile));
  const rng = mulberry32(hashSeed(weekStart, profile.id, opts.seed ?? ""));
  const servings = servingsFor(profile, req.preferences);
  const weeklyBudget = (profile.budgetMonthly || 0) / WEEKS_PER_MONTH;
  const expiring = expiringStock(
    req.pantry ?? [],
    opts.today ?? weekStart,
    WASTE_WINDOW_DAYS,
    opts.ingredients,
  );

  const weekEnd = addDays(weekStart, DAYS_PER_WEEK - 1);
  const locked: PlannedMeal[] = (req.lockedMeals ?? [])
    .filter((m) => m.date >= weekStart && m.date <= weekEnd)
    .map((m) => ({ ...m, planId, locked: true }));
  const lockedKeys = new Set(locked.map((m) => slotKey(m.date, m.mealType)));

  const chosen: PlannedMeal[] = [...locked];
  let spent = 0;
  for (const m of locked) {
    const r = recipeById.get(m.recipeId);
    if (r) spent += (r.costPerServing ?? 0) * m.servings;
  }

  const open = weekSlots(weekStart).filter(
    (s) => !lockedKeys.has(slotKey(s.date, s.mealType)),
  );
  let remaining = open.length;

  for (const slot of open) {
    const ctx: ScoreContext = {
      profile,
      preferences: req.preferences,
      expiring,
      chosen,
      recipeById,
      weeklyBudget,
      spentSoFar: spent,
      remainingMeals: remaining,
      servings,
      rng,
    };
    const best = bestOf(candidatesFor(allowed, slot.mealType), slot, ctx);
    remaining -= 1;
    if (!best) continue;

    chosen.push({
      id: uid(),
      planId,
      date: slot.date,
      mealType: slot.mealType,
      recipeId: best.id,
      servings,
      locked: false,
      status: "planned",
    });
    spent += (best.costPerServing ?? 0) * servings;
    consumeExpiring(expiring, best, servings);
  }

  return {
    id: planId,
    userId: profile.id,
    weekStart,
    meals: chosen.sort(compareMeals),
    generatedBy: "heuristic",
    createdAt: ts,
    updatedAt: ts,
  };
}

// ---------------------------------------------------------------------------
// Adaptation
// ---------------------------------------------------------------------------

function moodSpecFor(moodTags: readonly string[] | undefined): {
  match: (r: Recipe) => boolean;
  bias: Partial<Record<RecipeTag, number>>;
} {
  const bias: Partial<Record<RecipeTag, number>> = {};
  const matchers: NonNullable<MoodSpec["match"]>[] = [];
  for (const raw of moodTags ?? []) {
    const key = normalizeText(raw).replace(/ /g, "_");
    const spec = MOOD_SPECS[key];
    if (!spec) continue;
    for (const t of spec.tags) bias[t] = clamp((bias[t] ?? 0) + 0.5, -1, 1);
    if (spec.match) matchers.push(spec.match);
  }
  return {
    match: (r) => matchers.every((fn) => fn(r)),
    bias,
  };
}

export function adaptPlan(
  plan: MealPlan,
  change: ScheduleChange,
  ctx: PlannerContext,
): MealPlan {
  const { profile } = ctx;
  const meals: PlannedMeal[] = plan.meals.map((m) => ({ ...m }));
  const recipeById = new Map<ID, Recipe>(ctx.recipes.map((r) => [r.id, r]));
  const allowed = ctx.recipes.filter((r) => isRecipeAllowed(r, profile));
  const weeklyBudget = (profile.budgetMonthly || 0) / WEEKS_PER_MONTH;
  const expiring = expiringStock(ctx.pantry ?? [], change.date, WASTE_WINDOW_DAYS);
  const rng = mulberry32(hashSeed(plan.id, change.id, change.type, change.date));

  const editable = (m: PlannedMeal): boolean =>
    !m.locked && m.status === "planned" && m.date >= change.date;

  const spentElsewhere = (exclude: PlannedMeal): number => {
    let total = 0;
    for (const m of meals) {
      if (m === exclude || m.status === "skipped") continue;
      const r = recipeById.get(m.recipeId);
      if (r) total += (r.costPerServing ?? 0) * m.servings;
    }
    return total;
  };

  const editableCount = meals.filter(editable).length;

  /** Re-pick a recipe for `meal`, preferring candidates that pass `prefer`. */
  const repick = (
    meal: PlannedMeal,
    prefer: (r: Recipe) => boolean,
    bias?: Partial<Record<RecipeTag, number>>,
  ): Recipe | undefined => {
    const slot: MealSlot = {
      date: meal.date,
      mealType: meal.mealType,
      dayIndex: clamp(daysBetween(plan.weekStart, meal.date), 0, DAYS_PER_WEEK - 1),
    };
    const pool = candidatesFor(allowed, meal.mealType);
    const preferred = pool.filter(prefer);
    const finalPool = preferred.length > 0 ? preferred : pool;
    if (finalPool.length === 0) return undefined;
    const sctx: ScoreContext = {
      profile,
      preferences: ctx.preferences,
      expiring,
      chosen: meals.filter((m) => m.id !== meal.id),
      recipeById,
      weeklyBudget,
      spentSoFar: spentElsewhere(meal),
      remainingMeals: Math.max(1, editableCount),
      servings: meal.servings,
      tagBias: bias,
      rng,
    };
    return bestOf(finalPool, slot, sctx);
  };

  /** Meals the change applies to. */
  const targets = (fallback?: MealType): PlannedMeal[] => {
    const mealType = change.mealType ?? fallback;
    return meals.filter(
      (m) => m.date === change.date && editable(m) && (!mealType || m.mealType === mealType),
    );
  };

  switch (change.type) {
    case "skip_meal": {
      for (const m of targets("dinner")) {
        const idx = meals.indexOf(m);
        if (idx >= 0) meals.splice(idx, 1);
      }
      break;
    }

    case "eating_out": {
      const out = targets("dinner");
      for (const m of out) m.status = "eating_out";
      if (profile.goal === "weight_loss") {
        const outIds = new Set(out.map((m) => m.id));
        for (const m of meals) {
          if (m.date !== change.date || outIds.has(m.id) || !editable(m)) continue;
          const cap = kcalTargetFor(profile, m.mealType) * EATING_OUT_KCAL_FACTOR;
          const r = repick(
            m,
            (rr) => (rr.nutritionPerServing?.kcal ?? 0) <= cap,
            { low_cal: 0.5, high_fiber: 0.2 },
          );
          if (r) m.recipeId = r.id;
        }
      }
      break;
    }

    case "guests": {
      const guests = Math.max(0, change.guestCount ?? 0);
      const factor = 1 + guests / Math.max(1, profile.servingsDefault || 1);
      for (const m of targets()) {
        m.servings = Math.max(1, roundToHalf(m.servings * factor));
        const r = repick(m, (rr) => (rr.tags ?? []).includes("guest_friendly"), {
          guest_friendly: 0.6,
        });
        if (r && (r.tags ?? []).includes("guest_friendly")) m.recipeId = r.id;
      }
      break;
    }

    case "less_time": {
      const limit = change.availableMinutes ?? TIME_LIMIT_MIN.medium;
      const fits = (r: Recipe) => (r.prepTimeMin ?? 0) + (r.cookTimeMin ?? 0) <= limit;
      for (const m of targets()) {
        const current = recipeById.get(m.recipeId);
        if (current && fits(current)) continue;
        const r = repick(m, fits, { quick: 0.5 });
        if (r && fits(r)) m.recipeId = r.id;
      }
      break;
    }

    case "mood_change": {
      const spec = moodSpecFor(change.moodTags);
      for (const m of targets()) {
        const r = repick(m, spec.match, spec.bias);
        if (r) m.recipeId = r.id;
      }
      break;
    }
  }

  return {
    ...plan,
    meals: meals.sort(compareMeals),
    updatedAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Diffing (the "Re-optimise" review screen)
// ---------------------------------------------------------------------------

export function diffPlans(before: MealPlan, after: MealPlan): MealDiff[] {
  const out: MealDiff[] = [];
  const afterById = new Map(after.meals.map((m) => [m.id, m]));
  const afterByKey = new Map(
    after.meals.map((m) => [slotKey(m.date, m.mealType), m]),
  );
  const beforeIds = new Set(before.meals.map((m) => m.id));
  const matched = new Set<ID>();

  for (const b of before.meals) {
    const a = afterById.get(b.id) ?? afterByKey.get(slotKey(b.date, b.mealType));
    if (!a) {
      out.push({
        mealId: b.id,
        date: b.date,
        mealType: b.mealType,
        fromRecipeId: b.recipeId,
        fromServings: b.servings,
      });
      continue;
    }
    matched.add(a.id);
    const diff: MealDiff = { mealId: a.id, date: a.date, mealType: a.mealType };
    let changed = false;
    if (a.recipeId !== b.recipeId) {
      diff.fromRecipeId = b.recipeId;
      diff.toRecipeId = a.recipeId;
      changed = true;
    }
    if (a.servings !== b.servings) {
      diff.fromServings = b.servings;
      diff.toServings = a.servings;
      changed = true;
    }
    if (a.status !== b.status) {
      diff.statusChange = { from: b.status, to: a.status };
      changed = true;
    }
    if (changed) out.push(diff);
  }

  for (const a of after.meals) {
    if (matched.has(a.id) || beforeIds.has(a.id)) continue;
    out.push({
      mealId: a.id,
      date: a.date,
      mealType: a.mealType,
      toRecipeId: a.recipeId,
      toServings: a.servings,
    });
  }

  return out.sort((x, y) =>
    x.date === y.date
      ? MEAL_ORDER[x.mealType] - MEAL_ORDER[y.mealType]
      : x.date < y.date
        ? -1
        : 1,
  );
}

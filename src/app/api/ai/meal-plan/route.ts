/**
 * POST /api/ai/meal-plan
 *
 * Body    MealPlanRequest + { recipes: RecipeSummary[], planId? }
 * 200     { meals: PlannedMeal[], generatedBy: "gemini", dropped, rationale? }
 * 400     { error, details? }
 * 502/503 { fallback: true, reason }   — caller falls back to the heuristic planner
 *
 * Gemini only returns `{ date, mealType, recipeId, servings }`. This route
 * hydrates them into PlannedMeal, then post-validates: unknown recipe ids and
 * out-of-week dates are dropped (reported in `dropped`) and duplicated
 * date+mealType slots collapse to the first hit. Locked meals are re-applied
 * verbatim so the model can never overwrite them. The client fills any gaps.
 */

import { generateJson, getGemini } from "@/lib/ai/gemini";
import { badRequest, notConfigured, readBody, upstreamFailed } from "@/lib/ai/http";
import { mealPlanPrompt, weekDates } from "@/lib/ai/prompts";
import {
  mealDraftListSchema,
  mealPlanGeminiSchema,
  mealPlanRequestSchema,
} from "@/lib/ai/schemas";
import type { PlannedMeal } from "@/lib/types";
import { uid } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readBody(req, mealPlanRequestSchema);
  if (!body.ok) return body.response;

  if (!getGemini()) return notConfigured();

  const request = body.data;
  const planId = request.planId ?? uid();

  try {
    const draft = await generateJson(mealDraftListSchema, {
      prompt: mealPlanPrompt(request),
      responseSchema: mealPlanGeminiSchema,
      temperature: 0.6,
    });

    const validRecipeIds = new Set(request.recipes.map((r) => r.id));
    const validDates = new Set(weekDates(request.weekStart));
    const maxServings = Math.max(1, request.profile.servingsDefault * 6);

    const slots = new Map<string, PlannedMeal>();
    let dropped = 0;

    // Locked meals win: seed them first so the model cannot displace them.
    for (const m of request.lockedMeals) {
      if (!m.locked) continue;
      if (!validDates.has(m.date)) continue;
      slots.set(`${m.date}|${m.mealType}`, { ...m, planId });
    }

    for (const d of draft.meals) {
      if (!validDates.has(d.date) || !validRecipeIds.has(d.recipeId)) {
        dropped++;
        continue;
      }
      const key = `${d.date}|${d.mealType}`;
      if (slots.has(key)) {
        dropped++; // locked meal or duplicate slot
        continue;
      }
      slots.set(key, {
        id: uid(),
        planId,
        date: d.date,
        mealType: d.mealType,
        recipeId: d.recipeId,
        servings: Math.min(Math.max(1, Math.round(d.servings)), maxServings),
        locked: false,
        status: "planned",
      });
    }

    const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 } as const;
    const meals = [...slots.values()].sort(
      (a, b) =>
        a.date.localeCompare(b.date) || order[a.mealType] - order[b.mealType],
    );

    return Response.json({
      meals,
      generatedBy: "gemini" as const,
      dropped,
      rationale: draft.rationale,
    });
  } catch (e) {
    return upstreamFailed(e);
  }
}

export function GET() {
  return badRequest("Use POST");
}

/**
 * POST /api/ai/adapt
 *
 * Body    { plan, change, profile, pantry, recipes, preferences? }
 * 200     { meals: PlannedMeal[], generatedBy: "gemini", dropped, rationale? }
 * 400     { error, details? }
 * 502/503 { fallback: true, reason }   — caller falls back to `adaptPlan`
 *
 * Gemini returns only the meals it changed. This route re-checks each one
 * against the existing plan: unknown meal ids, unknown recipe ids, locked
 * meals and meals before the change date are dropped. The response contains
 * only the changed meals, ready for `usePlanStore.updateMeal`.
 */

import { generateJson, getGemini } from "@/lib/ai/gemini";
import { badRequest, notConfigured, readBody, upstreamFailed } from "@/lib/ai/http";
import { adaptPrompt } from "@/lib/ai/prompts";
import {
  adaptDraftListSchema,
  adaptGeminiSchema,
  adaptRequestSchema,
} from "@/lib/ai/schemas";
import type { PlannedMeal } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readBody(req, adaptRequestSchema);
  if (!body.ok) return body.response;

  if (!getGemini()) return notConfigured();

  const request = body.data;

  try {
    const draft = await generateJson(adaptDraftListSchema, {
      prompt: adaptPrompt(request),
      responseSchema: adaptGeminiSchema,
      temperature: 0.5,
    });

    const byId = new Map(request.plan.meals.map((m) => [m.id, m]));
    const validRecipeIds = new Set(request.recipes.map((r) => r.id));
    const changeDate = request.change.date;
    const maxServings = Math.max(
      1,
      request.profile.servingsDefault * 6 + (request.change.guestCount ?? 0),
    );

    const meals: PlannedMeal[] = [];
    const seen = new Set<string>();
    let dropped = 0;

    for (const d of draft.meals) {
      const existing = byId.get(d.id);
      if (
        !existing ||
        existing.locked ||
        existing.date < changeDate ||
        !validRecipeIds.has(d.recipeId) ||
        seen.has(d.id)
      ) {
        dropped++;
        continue;
      }
      seen.add(d.id);
      meals.push({
        ...existing,
        recipeId: d.recipeId,
        servings: Math.min(Math.max(1, Math.round(d.servings)), maxServings),
        status: d.status,
        note: d.note?.trim() || undefined,
      });
    }

    meals.sort((a, b) => a.date.localeCompare(b.date));

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

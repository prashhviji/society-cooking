/**
 * POST /api/admin/seed
 *
 * Header  x-admin-token: $ADMIN_SEED_TOKEN
 * 200     { ok: true, ingredients: n, recipes: n }
 * 401     { error }   — bad or missing token
 * 503     { error }   — Supabase / service role not configured
 *
 * Upserts the shared catalog (`src/lib/data/seed/*`) into the `ingredients`
 * and `recipes` tables with the service-role client, in chunks of 100.
 * Both tables are public-read / service-role-write, so this is the only way
 * to populate them. Safe to re-run: `onConflict: "id"`.
 */

import { INGREDIENTS } from "@/lib/data/seed/ingredients";
import { RECIPES } from "@/lib/data/seed/recipes";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CHUNK = 100;

function chunks<T>(rows: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export async function POST(req: Request) {
  const expected = (process.env.ADMIN_SEED_TOKEN ?? "").trim();
  const provided = (req.headers.get("x-admin-token") ?? "").trim();

  if (!expected) {
    return Response.json(
      { error: "ADMIN_SEED_TOKEN is not configured on the server." },
      { status: 503 },
    );
  }
  if (provided !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return Response.json(
      {
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  const supabase = getServiceSupabase();

  const ingredientRows: TablesInsert<"ingredients">[] = INGREDIENTS.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    emoji: i.emoji,
    image_url: i.imageUrl ?? null,
    default_unit: i.defaultUnit,
    grams_per_piece: i.gramsPerPiece ?? null,
    shelf_life_days: i.shelfLifeDays,
    storage: i.storage,
    cost_per_kg: i.costPerKg,
    nutrition: i.nutrition,
    aliases: i.aliases,
  }));

  const recipeRows: TablesInsert<"recipes">[] = RECIPES.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    cuisine: r.cuisine,
    meal_types: r.mealTypes,
    tags: r.tags,
    emoji: r.emoji,
    image_url: r.imageUrl ?? null,
    servings: r.servings,
    prep_time_min: r.prepTimeMin,
    cook_time_min: r.cookTimeMin,
    difficulty: r.difficulty,
    spice_level: r.spiceLevel,
    diets: r.diets,
    equipment: r.equipment,
    primary_method: r.primaryMethod,
    ingredients: r.ingredients,
    steps: r.steps,
    nutrition_per_serving: r.nutritionPerServing,
    cost_per_serving: r.costPerServing,
    is_public: r.isPublic,
    created_by: r.createdBy ?? null,
  }));

  try {
    for (const batch of chunks(ingredientRows)) {
      const { error } = await supabase
        .from("ingredients")
        .upsert(batch, { onConflict: "id" });
      if (error) throw new Error(`ingredients: ${error.message}`);
    }

    for (const batch of chunks(recipeRows)) {
      const { error } = await supabase
        .from("recipes")
        .upsert(batch, { onConflict: "id" });
      if (error) throw new Error(`recipes: ${error.message}`);
    }
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Seeding failed" },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    ingredients: ingredientRows.length,
    recipes: recipeRows.length,
  });
}

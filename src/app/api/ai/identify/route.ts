/**
 * POST /api/ai/identify
 *
 * Body    { imageBase64, mimeType, catalog: {id,name}[] }
 * 200     IdentifyIngredientResult
 * 400     { error, details? }
 * 502/503 { fallback: true, reason }   — caller falls back to the manual picker
 */

import { generateJson, getGemini } from "@/lib/ai/gemini";
import { badRequest, notConfigured, readBody, prepareImage, upstreamFailed } from "@/lib/ai/http";
import { identifyPrompt } from "@/lib/ai/prompts";
import {
  identifyGeminiSchema,
  identifyRequestSchema,
  identifyResultSchema,
} from "@/lib/ai/schemas";
import type { IdentifyIngredientResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readBody(req, identifyRequestSchema);
  if (!body.ok) return body.response;

  if (!getGemini()) return notConfigured();

  const img = prepareImage(body.data.imageBase64, body.data.mimeType);
  if (!img.ok) return img.response;

  try {
    const result = await generateJson(identifyResultSchema, {
      prompt: identifyPrompt(body.data.catalog),
      images: [img.image],
      responseSchema: identifyGeminiSchema,
      temperature: 0.2,
    });

    // The model is told to return "" when nothing matches; drop ids that are
    // not actually in the catalog so the client never gets a phantom id.
    const known = new Set(body.data.catalog.map((c) => c.id));
    const keep = (id?: string) => (id && known.has(id) ? id : undefined);

    const payload: IdentifyIngredientResult = {
      ingredientId: keep(result.ingredientId),
      name: result.name,
      confidence: result.confidence,
      estimatedGrams:
        result.estimatedGrams && result.estimatedGrams > 0
          ? result.estimatedGrams
          : undefined,
      alternatives: result.alternatives.map((a) => ({
        ingredientId: keep(a.ingredientId),
        name: a.name,
        confidence: a.confidence,
      })),
    };

    return Response.json(payload);
  } catch (e) {
    return upstreamFailed(e);
  }
}

export function GET() {
  return badRequest("Use POST");
}

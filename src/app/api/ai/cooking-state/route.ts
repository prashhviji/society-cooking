/**
 * POST /api/ai/cooking-state
 *
 * Body    { imageBase64, mimeType, stateCue, stepTitle?, recipeName? }
 * 200     { matches: boolean, confidence: number, advice: string }
 * 400     { error, details? }
 * 502/503 { fallback: true, reason }   — caller asks the user to confirm manually
 */

import { generateJson, getGemini } from "@/lib/ai/gemini";
import { badRequest, notConfigured, prepareImage, readBody, upstreamFailed } from "@/lib/ai/http";
import { cookingStatePrompt } from "@/lib/ai/prompts";
import {
  cookingStateGeminiSchema,
  cookingStateRequestSchema,
  cookingStateResultSchema,
} from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readBody(req, cookingStateRequestSchema);
  if (!body.ok) return body.response;

  if (!getGemini()) return notConfigured();

  const img = prepareImage(body.data.imageBase64, body.data.mimeType);
  if (!img.ok) return img.response;

  try {
    const result = await generateJson(cookingStateResultSchema, {
      prompt: cookingStatePrompt(body.data),
      images: [img.image],
      responseSchema: cookingStateGeminiSchema,
      temperature: 0.2,
    });

    return Response.json({
      matches: result.matches,
      confidence: result.confidence,
      advice: result.advice.trim(),
    });
  } catch (e) {
    return upstreamFailed(e);
  }
}

export function GET() {
  return badRequest("Use POST");
}

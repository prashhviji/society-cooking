/**
 * POST /api/ai/receipt
 *
 * Body    { imageBase64, mimeType, catalog: {id,name}[] }
 * 200     ReceiptScanResult
 * 400     { error, details? }
 * 502/503 { fallback: true, reason }   — caller falls back to manual entry
 */

import { generateJson, getGemini } from "@/lib/ai/gemini";
import { badRequest, notConfigured, prepareImage, readBody, upstreamFailed } from "@/lib/ai/http";
import { receiptPrompt } from "@/lib/ai/prompts";
import {
  receiptGeminiSchema,
  receiptRequestSchema,
  receiptResultSchema,
} from "@/lib/ai/schemas";
import type { ReceiptScanResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readBody(req, receiptRequestSchema);
  if (!body.ok) return body.response;

  if (!getGemini()) return notConfigured();

  const img = prepareImage(body.data.imageBase64, body.data.mimeType);
  if (!img.ok) return img.response;

  try {
    const result = await generateJson(receiptResultSchema, {
      prompt: receiptPrompt(body.data.catalog),
      images: [img.image],
      responseSchema: receiptGeminiSchema,
      temperature: 0.1,
    });

    const known = new Set(body.data.catalog.map((c) => c.id));

    const payload: ReceiptScanResult = {
      items: result.items
        .filter((i) => i.name.trim().length > 0)
        .map((i) => ({
          ingredientId:
            i.ingredientId && known.has(i.ingredientId) ? i.ingredientId : undefined,
          name: i.name.trim(),
          quantity: i.quantity > 0 ? i.quantity : 1,
          unit: i.unit,
          price: i.price && i.price > 0 ? i.price : undefined,
        })),
      store: result.store?.trim() || undefined,
      total: result.total && result.total > 0 ? result.total : undefined,
    };

    return Response.json(payload);
  } catch (e) {
    return upstreamFailed(e);
  }
}

export function GET() {
  return badRequest("Use POST");
}

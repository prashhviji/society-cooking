/**
 * GET /api/ai/status → { gemini: boolean, ml: boolean }
 *
 * Lets the browser decide whether to offer AI entry points at all, without
 * leaking any key material. `ml` only reports that ML_SERVICE_URL is set —
 * the /api/ml/retention proxy still degrades gracefully if it is unreachable.
 */

import { isGeminiConfigured } from "@/lib/ai/gemini";
import type { AiStatus } from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const payload: AiStatus = {
    gemini: isGeminiConfigured(),
    ml: (process.env.ML_SERVICE_URL ?? "").trim().length > 0,
  };
  return Response.json(payload, {
    headers: { "cache-control": "no-store" },
  });
}

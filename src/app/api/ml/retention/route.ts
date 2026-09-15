/**
 * POST /api/ml/retention
 *
 * Thin proxy to the optional Python service (`ml/`, FastAPI).
 *
 * Body    { steps: [{ method, avg_temp_c, minutes, max_temp_c }], nutrients? }
 * 200     { nutrients: {...}, overall: number, source: "ml" }
 * 503     { fallback: true, reason } — ML_SERVICE_URL unset or unreachable;
 *                                      the caller uses src/lib/engines/retention.ts
 *
 * The TypeScript engine is the primary, always-available implementation; this
 * route only exists so a trained gradient-boosting model can improve on it
 * when the service happens to be running.
 */

import { z } from "zod";
import { badRequest, readBody } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const METHODS = [
  "raw",
  "boil",
  "steam",
  "saute",
  "stir_fry",
  "shallow_fry",
  "deep_fry",
  "bake",
  "roast",
  "grill",
  "pressure_cook",
  "simmer",
  "microwave",
] as const;

const retentionRequestSchema = z.object({
  steps: z
    .array(
      z.object({
        method: z.enum(METHODS),
        avg_temp_c: z.number().min(-20).max(500),
        minutes: z.number().min(0).max(600),
        max_temp_c: z.number().min(-20).max(600).optional(),
      }),
    )
    .min(1)
    .max(40),
  nutrients: z.array(z.string()).max(20).optional(),
});

const TIMEOUT_MS = 8_000;

export async function POST(req: Request) {
  const body = await readBody(req, retentionRequestSchema);
  if (!body.ok) return body.response;

  const base = (process.env.ML_SERVICE_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    return Response.json(
      { fallback: true, reason: "ML_SERVICE_URL not configured" },
      { status: 503 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(`${base}/retention/estimate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body.data),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!upstream.ok) {
      return Response.json(
        {
          fallback: true,
          reason: `ML service responded ${upstream.status}`,
        },
        { status: 503 },
      );
    }

    const data = (await upstream.json()) as Record<string, unknown>;
    return Response.json({ ...data, source: "ml" });
  } catch (e) {
    const reason = controller.signal.aborted
      ? `ML service timed out after ${TIMEOUT_MS} ms`
      : e instanceof Error
        ? e.message
        : "ML service unreachable";
    return Response.json({ fallback: true, reason }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}

export function GET() {
  return badRequest("Use POST");
}

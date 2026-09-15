/**
 * Shared plumbing for the `/api/ai/*` route handlers: one JSON body reader,
 * one error shape, one image guard.
 *
 * Error contract (consumed by `src/lib/ai/client.ts`):
 *   400 { error }                        — bad request body
 *   502 { fallback: true, reason }       — Gemini failed
 *   503 { fallback: true, reason }       — Gemini not configured
 */

import type { z } from "zod";
import { GeminiError } from "./gemini";
import { MAX_IMAGE_BYTES, base64Bytes, stripDataUri } from "./schemas";

export interface FallbackBody {
  fallback: true;
  reason: string;
}

export function badRequest(message: string, details?: unknown): Response {
  return Response.json({ error: message, details }, { status: 400 });
}

export function notConfigured(
  reason = "GEMINI_API_KEY not configured",
): Response {
  return Response.json({ fallback: true, reason } satisfies FallbackBody, {
    status: 503,
  });
}

export function upstreamFailed(e: unknown): Response {
  const reason =
    e instanceof GeminiError
      ? e.message
      : e instanceof Error
        ? e.message
        : "Gemini request failed";
  return Response.json({ fallback: true, reason } satisfies FallbackBody, {
    status: 502,
  });
}

/** Parses and validates the JSON body, or returns a 400 Response. */
export async function readBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, response: badRequest("Body must be valid JSON") };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      response: badRequest(
        "Invalid request body",
        parsed.error.issues.map((i) => ({
          path: i.path.join(".") || "root",
          message: i.message,
        })),
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Normalises an inline image: accepts a `data:` URI or bare base64, enforces
 * the 4 MB cap and returns the payload Gemini expects.
 */
export function prepareImage(
  imageBase64: string,
  declaredMime: string,
): { ok: true; image: { mimeType: string; base64: string } } | { ok: false; response: Response } {
  const { base64, mimeType } = stripDataUri(imageBase64);
  const bytes = base64Bytes(base64);

  if (bytes === 0) {
    return { ok: false, response: badRequest("imageBase64 is empty") };
  }
  if (bytes > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      response: badRequest(
        `Image is ${(bytes / 1_048_576).toFixed(1)} MB; the limit is ${
          MAX_IMAGE_BYTES / 1_048_576
        } MB. Resize it before uploading.`,
      ),
    };
  }

  return { ok: true, image: { mimeType: mimeType ?? declaredMime, base64 } };
}

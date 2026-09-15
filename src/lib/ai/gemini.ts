/**
 * Server-only Gemini client and JSON helper.
 *
 * Every AI feature in Cookwise is optional: when `GEMINI_API_KEY` is unset
 * `getGemini()` returns null and the route replies 503 `{ fallback: true }` so
 * the browser helper can run the deterministic local engine instead.
 */

import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { Part } from "@google/genai";
import type { z } from "zod";
import type { GeminiSchema } from "./schemas";

export const DEFAULT_MODEL = "gemini-2.5-flash";
/** Hard ceiling for a single generateContent call. */
export const GENERATE_TIMEOUT_MS = 20_000;

let cached: GoogleGenAI | null = null;

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** True when a Gemini key is present. Cheap enough to call per request. */
export function isGeminiConfigured(): boolean {
  return (process.env.GEMINI_API_KEY ?? "").trim().length > 0;
}

/** The shared client, or `null` when no API key is configured. */
export function getGemini(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) return null;
  if (!cached) cached = new GoogleGenAI({ apiKey });
  return cached;
}

export interface InlineImage {
  mimeType: string;
  /** Bare base64, no `data:` prefix. */
  base64: string;
}

export interface GenerateJsonOptions {
  prompt: string;
  images?: InlineImage[];
  /** OpenAPI-subset schema handed to Gemini for structured output. */
  responseSchema: GeminiSchema;
  /** Optional system instruction; defaults to a terse JSON-only directive. */
  system?: string;
  temperature?: number;
  timeoutMs?: number;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

const DEFAULT_SYSTEM =
  "You are the planning and vision engine inside Cookwise, an Indian home-cooking app. " +
  "Answer with JSON only, matching the provided schema exactly. " +
  "Never invent identifiers that were not given to you. " +
  "When unsure, lower the confidence rather than guessing a specific value.";

/**
 * Calls Gemini and parses the reply with `schema`.
 *
 * Retries **once** when the reply is not valid JSON (or does not satisfy the
 * zod schema), asking the model to return only JSON. Anything else — network
 * errors, timeouts, a missing key — throws `GeminiError` so the route can map
 * it to 502 `{ fallback: true }`.
 */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  options: GenerateJsonOptions,
): Promise<T> {
  const ai = getGemini();
  if (!ai) throw new GeminiError("GEMINI_API_KEY not configured");

  const {
    prompt,
    images = [],
    responseSchema,
    system = DEFAULT_SYSTEM,
    temperature = 0.4,
    timeoutMs = GENERATE_TIMEOUT_MS,
  } = options;

  let lastIssue = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const text =
      attempt === 0
        ? prompt
        : `${prompt}\n\nYour previous reply could not be parsed (${lastIssue}). ` +
          "Reply again with valid JSON only — no markdown fences, no commentary.";

    const raw = await callModel(ai, {
      text,
      images,
      responseSchema,
      system,
      temperature,
      timeoutMs,
    });

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripFences(raw));
    } catch {
      lastIssue = "the reply was not valid JSON";
      continue;
    }

    const result = schema.safeParse(parsedJson);
    if (result.success) return result.data;

    lastIssue = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
  }

  throw new GeminiError(`Gemini returned an unusable response (${lastIssue})`);
}

async function callModel(
  ai: GoogleGenAI,
  args: {
    text: string;
    images: InlineImage[];
    responseSchema: GeminiSchema;
    system: string;
    temperature: number;
    timeoutMs: number;
  },
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const parts: Part[] = [{ text: args.text }];
    for (const img of args.images) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }

    const response = await ai.models.generateContent({
      model: geminiModel(),
      contents: [{ role: "user", parts }],
      config: {
        abortSignal: controller.signal,
        systemInstruction: args.system,
        temperature: args.temperature,
        responseMimeType: "application/json",
        responseSchema: args.responseSchema,
      },
    });

    const text = response.text;
    if (!text) throw new GeminiError("Gemini returned an empty response");
    return text;
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    if (controller.signal.aborted) {
      throw new GeminiError(`Gemini timed out after ${args.timeoutMs} ms`, e);
    }
    throw new GeminiError(
      e instanceof Error ? e.message : "Gemini request failed",
      e,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Some models still wrap JSON in ```json fences despite responseMimeType. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

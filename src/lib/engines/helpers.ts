/**
 * Small numeric / text / date helpers shared by the Cookwise engines.
 *
 * Kept separate from `src/lib/utils.ts` (owned by the shell) so the engines
 * stay dependency-free and unit-testable.
 */

import type { ISODate } from "@/lib/types";
import { parseISODate } from "@/lib/utils";

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round(
    (parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000,
  );
}

/**
 * mulberry32 — a tiny, fast, well-distributed 32-bit PRNG.
 * Deterministic for a given seed, which makes plan generation reproducible.
 * @see https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over the concatenated parts; used to turn strings into a PRNG seed. */
export function hashSeed(...parts: (string | number | undefined | null)[]): number {
  const s = parts.map((p) => (p === undefined || p === null ? "" : String(p))).join("|");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Exponential moving average step: prev + alpha * (target - prev). */
export function ema(prev: number, target: number, alpha: number): number {
  return prev + alpha * (target - prev);
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

export function sum(xs: number[]): number {
  let total = 0;
  for (const x of xs) total += x;
  return total;
}

/** Round up to the nearest multiple of `step`. */
export function ceilTo(n: number, step: number): number {
  if (step <= 0) return n;
  return Math.ceil(n / step) * step;
}

/** Round to `digits` decimal places (default 2). */
export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Round to the nearest half (2.25 -> 2.5). */
export function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/** Lowercase, collapse every non-alphanumeric run to a single space. */
export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function words(s: string): string[] {
  const n = normalizeText(s);
  return n.length ? n.split(" ") : [];
}

/**
 * Word-ish token match: `token` matches a whole word of `haystack`
 * (allowing a simple plural on either side). Multi-word tokens fall back to
 * a substring test. Avoids "egg" matching "eggplant".
 */
export function matchesToken(haystack: string, token: string): boolean {
  const hay = normalizeText(haystack);
  const tok = normalizeText(token);
  if (!hay || !tok) return false;
  if (tok.includes(" ")) return hay.includes(tok);
  return words(hay).some(
    (w) => w === tok || w === `${tok}s` || `${w}s` === tok || w === `${tok}es`,
  );
}

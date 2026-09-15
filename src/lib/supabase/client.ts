"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/** Typed browser client. `null` whenever the app runs in local demo mode. */
export type CookwiseClient = SupabaseClient<Database>;

let cached: CookwiseClient | null = null;

/**
 * Browser Supabase client, or `null` in demo mode.
 * Cached so every caller shares one auth/realtime connection.
 */
export function getBrowserSupabase(): CookwiseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    cached = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
  return cached;
}

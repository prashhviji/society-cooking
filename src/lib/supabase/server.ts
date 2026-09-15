/**
 * Server-side Supabase clients — RSC, route handlers and server actions only.
 * `server-only` makes any client import a build-time error.
 */
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  getServiceRoleKey,
  isSupabaseConfigured,
} from "./env";
import type { Database } from "./types";

export type CookwiseServerClient = SupabaseClient<Database>;

/**
 * Request-scoped client that reads (and refreshes) the session from cookies.
 * Returns `null` in demo mode. Never cache the result across requests.
 *
 * `cookies()` is async in Next 16, hence the await.
 */
export async function getServerSupabase(): Promise<CookwiseServerClient | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // src/proxy.ts refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/** The signed-in user for this request, or `null` (demo mode / signed out). */
export async function getServerUser(): Promise<{ id: string; email?: string } | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

/**
 * Service-role client. Bypasses RLS — only for trusted server code such as
 * `/api/admin/seed`. Throws when `SUPABASE_SERVICE_ROLE_KEY` is missing.
 */
export function getServiceSupabase(): CookwiseServerClient {
  const key = getServiceRoleKey();
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

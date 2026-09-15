/**
 * Session refresh for `src/proxy.ts` (Next 16's replacement for middleware).
 *
 * Follows the Supabase SSR pattern: create a client bound to the *incoming*
 * request cookies, write any refreshed tokens onto BOTH the request (so the
 * rendered route sees them) and the outgoing response (so the browser stores
 * them), then call `getUser()` to trigger the refresh.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";
import type { Database } from "./types";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: do not run any code between createServerClient and getUser().
  // getUser() is what revalidates the token and triggers setAll().
  try {
    await supabase.auth.getUser();
  } catch {
    // Network hiccup or an expired refresh token — let the request through and
    // let the route decide what to render. Never block navigation on auth.
  }

  return response;
}

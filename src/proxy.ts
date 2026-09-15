/**
 * Next.js 16 proxy (formerly `middleware.ts`).
 *
 * Its only job is refreshing the Supabase session cookie. It is a complete
 * no-op in demo mode so the app works with zero configuration, and it never
 * redirects: routing/auth gating is decided client-side by the stores.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!isSupabaseConfigured()) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every path except:
     * - _next/static, _next/image  (build output)
     * - favicon.ico, sw.js, manifest.webmanifest, offline.html, icons/
     * - image / font files
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|woff|woff2|ttf|otf)$).*)",
  ],
};

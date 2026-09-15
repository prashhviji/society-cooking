/**
 * Magic-link / PKCE callback.
 *
 * Supabase redirects here with `?code=…` after the user clicks the emailed
 * link (the 6-digit OTP path in /auth does not need this route). We exchange
 * the code for a session — `getServerSupabase()` writes the cookies — and then
 * send the user to /home.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";
  // Only allow same-origin relative redirects.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  const authError = searchParams.get("error_description") ?? searchParams.get("error");
  if (authError) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(authError)}`, origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/auth?error=missing_code", origin));
  }

  const supabase = await getServerSupabase();
  if (!supabase) {
    // Demo mode — nothing to exchange.
    return NextResponse.redirect(new URL(target, origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(error.message)}`, origin),
    );
  }

  return NextResponse.redirect(new URL(target, origin));
}

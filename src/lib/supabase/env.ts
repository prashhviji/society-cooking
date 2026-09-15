/** Supabase environment helpers. Safe to import from client and server code. */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** True when the app should talk to Supabase; false = local demo mode. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_PUBLISHABLE_KEY.length > 0;
}

/**
 * Service-role key. Server-only: it bypasses RLS, so it must never be read
 * from a client component or shipped to the browser (no NEXT_PUBLIC_ prefix).
 *
 * @throws when the key or the project URL is missing.
 */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Copy it from the Supabase " +
        "dashboard (Project Settings → API → service_role) into .env.local. " +
        "It is server-only — never expose it to the browser.",
    );
  }
  if (!SUPABASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set; the service-role client needs a project URL.",
    );
  }
  return key;
}

/** True when the service-role client can be constructed. */
export function isServiceRoleConfigured(): boolean {
  return (
    SUPABASE_URL.length > 0 && (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length > 0
  );
}

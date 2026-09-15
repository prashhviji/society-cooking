"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "./client";
import { isSupabaseConfigured } from "./env";

export interface AuthUser {
  id: string;
  email?: string;
}

export interface UseAuth {
  user: AuthUser | null;
  loading: boolean;
  /** True when Supabase is not configured; the app runs purely local. */
  demo: boolean;
  /** Send a 6-digit code to the address (creates the account on first use). */
  signInWithOtp(email: string): Promise<{ error?: string }>;
  /** Exchange the emailed 6-digit code for a session. */
  verifyOtp(email: string, token: string): Promise<{ error?: string }>;
  signOut(): Promise<void>;
}

/** The stand-in identity used while Supabase is not configured. */
export const DEMO_USER: AuthUser = { id: "demo-user" };

function message(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  return fallback;
}

/**
 * Auth state for client components.
 *
 * In demo mode it resolves immediately to a fixed local user so every screen
 * has a stable `userId` to hang rows off, and the sign-in actions are no-ops
 * that report a friendly error.
 */
export function useAuth(): UseAuth {
  const demo = !isSupabaseConfigured();
  const [user, setUser] = useState<AuthUser | null>(demo ? DEMO_USER : null);
  const [loading, setLoading] = useState(!demo);

  useEffect(() => {
    if (demo) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    let alive = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!alive) return;
        setUser(
          data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null,
        );
      })
      .catch(() => {
        if (alive) setUser(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUser(
        session?.user
          ? { id: session.user.id, email: session.user.email ?? undefined }
          : null,
      );
      setLoading(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [demo]);

  const signInWithOtp = useCallback(
    async (email: string): Promise<{ error?: string }> => {
      const supabase = getBrowserSupabase();
      if (!supabase) return { error: "Supabase is not configured (demo mode)." };
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: true,
            emailRedirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/auth/callback`
                : undefined,
          },
        });
        return error ? { error: error.message } : {};
      } catch (e) {
        return { error: message(e, "Could not send the code. Try again.") };
      }
    },
    [],
  );

  const verifyOtp = useCallback(
    async (email: string, token: string): Promise<{ error?: string }> => {
      const supabase = getBrowserSupabase();
      if (!supabase) return { error: "Supabase is not configured (demo mode)." };
      try {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: token.trim(),
          type: "email",
        });
        return error ? { error: error.message } : {};
      } catch (e) {
        return { error: message(e, "That code did not work. Try again.") };
      }
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch {
      // Already signed out or offline — the local state is cleared either way.
    }
    setUser(null);
  }, []);

  return useMemo(
    () => ({ user, loading, demo, signInWithOtp, verifyOtp, signOut }),
    [user, loading, demo, signInWithOtp, verifyOtp, signOut],
  );
}

/** The current user id, falling back to the demo id. Safe on the server. */
export function currentUserId(user: AuthUser | null): string {
  return user?.id ?? DEMO_USER.id;
}

"use client";

import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui";
import { ensureSeeded } from "@/lib/data/seed";
import { startSync } from "@/lib/data/sync";

/**
 * Client-side bootstrap for the local-first data layer.
 *
 * On mount it waits for every persisted store to rehydrate, seeds the demo data
 * once (idempotent), then starts the Supabase mirror (a no-op in demo mode).
 * Children render immediately (wrapped in the UI kit's `ToastProvider`) —
 * screens gate their own content on `useHydrated()` from `@/lib/data/storage`.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    let stopSync: (() => void) | undefined;

    void (async () => {
      await ensureSeeded();
      if (cancelled) return;
      try {
        stopSync = startSync();
      } catch (err) {
        console.warn("[cookwise] sync failed to start", err);
      }
    })();

    return () => {
      cancelled = true;
      stopSync?.();
    };
  }, []);

  return <ToastProvider>{children}</ToastProvider>;
}

export default AppProviders;

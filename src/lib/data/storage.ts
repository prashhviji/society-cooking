/**
 * Zustand `persist` storage adapter over Dexie + the app-wide hydration gate.
 *
 * Every persisted store registers itself here (via `persistConfig`) and reports
 * when zustand finished rehydrating it (via `trackHydration`). `useHydrated()`
 * flips to `true` once **every** registered store has rehydrated *and* demo
 * seeding has finished, so screens can render a skeleton until then.
 *
 * A `HYDRATION_TIMEOUT_MS` fallback guarantees the gate opens even when
 * IndexedDB is unavailable (private browsing, blocked storage, …) — the Dexie
 * helpers already degrade to an in-memory map in that case.
 */

import { useSyncExternalStore } from "react";
import {
  createJSONStorage,
  type PersistOptions,
  type StateStorage,
} from "zustand/middleware";
import { kvDelete, kvGet, kvSet } from "./db";

/** The UI never waits longer than this for hydration + seeding. */
export const HYDRATION_TIMEOUT_MS = 4000;

// ---------------------------------------------------------------------------
// StateStorage implementation
// ---------------------------------------------------------------------------

/**
 * Async `StateStorage` backed by the Dexie `kv` table.
 *
 * All three methods are intentionally `async` (never synchronous): zustand's
 * `persist` hydrates synchronously when `getItem` returns a non-thenable, which
 * would fire `onFinishHydration` before we can subscribe to it.
 */
export const idbStorage: StateStorage = {
  async getItem(name) {
    try {
      return await kvGet(name);
    } catch (err) {
      console.warn(`[cookwise/storage] read failed for "${name}"`, err);
      return null;
    }
  },
  async setItem(name, value) {
    try {
      await kvSet(name, value);
    } catch (err) {
      console.warn(`[cookwise/storage] write failed for "${name}"`, err);
    }
  },
  async removeItem(name) {
    try {
      await kvDelete(name);
    } catch (err) {
      console.warn(`[cookwise/storage] delete failed for "${name}"`, err);
    }
  },
};

// ---------------------------------------------------------------------------
// Hydration registry
// ---------------------------------------------------------------------------

const registered = new Set<string>();
const hydrated = new Set<string>();
const listeners = new Set<() => void>();
let storeWaiters: Array<() => void> = [];

let seedComplete = false;
/** Once the gate opens it stays open — late-registered stores must not close it. */
let latched = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let timedOut = false;

function emit(): void {
  for (const l of listeners) l();
}

function resolveStoreWaiters(): void {
  const waiters = storeWaiters;
  storeWaiters = [];
  for (const w of waiters) w();
}

function allStoresHydrated(): boolean {
  if (timedOut) return true;
  for (const name of registered) if (!hydrated.has(name)) return false;
  return true;
}

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function startTimeout(): void {
  if (timer !== null || timedOut) return;
  // Browser-only: on the server every store hydrates from the memory fallback
  // immediately, and a pending timer per render would only add noise.
  if (typeof window === "undefined") return;
  timer = setTimeout(() => {
    timer = null;
    timedOut = true;
    seedComplete = true;
    console.warn(
      `[cookwise/storage] hydration timed out after ${HYDRATION_TIMEOUT_MS}ms — rendering with whatever loaded.`,
    );
    resolveStoreWaiters();
    emit();
  }, HYDRATION_TIMEOUT_MS);
  // Node only: never hold a test/SSR process open just for the fallback timer.
  (timer as unknown as { unref?: () => void }).unref?.();
}

/** Called by `persistConfig` when a persisted store module is evaluated. */
export function registerPersistedStore(name: string): void {
  if (registered.has(name)) return;
  registered.add(name);
  startTimeout();
}

/** Called once zustand finished rehydrating a store. */
export function markStoreHydrated(name: string): void {
  if (hydrated.has(name)) return;
  hydrated.add(name);
  if (allStoresHydrated()) {
    clearTimer();
    resolveStoreWaiters();
  }
  emit();
}

/** Called by `ensureSeeded()` once demo seeding finished (or was skipped). */
export function markSeedComplete(): void {
  if (seedComplete) return;
  seedComplete = true;
  emit();
}

/** True when all persisted stores rehydrated AND seeding finished. */
export function isAppHydrated(): boolean {
  if (latched) return true;
  if (allStoresHydrated() && seedComplete) {
    latched = true;
    clearTimer();
    return true;
  }
  return false;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * `true` once every persisted store rehydrated and seeding completed.
 * Always `false` during SSR so server and first client render agree.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, isAppHydrated, () => false);
}

/**
 * Resolves when every registered store has rehydrated (or the timeout fired).
 * Used by `ensureSeeded()` so seeding never races store rehydration.
 */
export function waitForStoresHydrated(): Promise<void> {
  if (allStoresHydrated()) return Promise.resolve();
  startTimeout();
  return new Promise<void>((resolve) => {
    storeWaiters.push(resolve);
  });
}

/** Handle shape exposed by a store created with the `persist` middleware. */
export interface PersistedStoreHandle<S> {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: (state: S) => void) => () => void;
    rehydrate: () => Promise<void> | void;
    clearStorage: () => void;
  };
}

/** Wire a persisted store's rehydration into the app-wide gate. */
export function trackHydration<S>(
  name: string,
  store: PersistedStoreHandle<S>,
): void {
  registerPersistedStore(name);
  if (store.persist.hasHydrated()) {
    markStoreHydrated(name);
    return;
  }
  store.persist.onFinishHydration(() => markStoreHydrated(name));
}

/**
 * Standard persist options: Dexie-backed JSON storage + registration.
 * `extra` may add `partialize`, `merge`, `version`, `migrate`, …
 */
export function persistConfig<S, P = S>(
  name: string,
  extra: Omit<PersistOptions<S, P>, "name" | "storage"> = {},
): PersistOptions<S, P> {
  registerPersistedStore(name);
  return {
    name,
    version: 1,
    storage: createJSONStorage<P>(() => idbStorage),
    ...extra,
  };
}

/** Test seam: forget every registration so a fresh module graph starts clean. */
export function __resetHydrationForTests(): void {
  registered.clear();
  hydrated.clear();
  storeWaiters = [];
  seedComplete = false;
  latched = false;
  timedOut = false;
  clearTimer();
  emit();
}

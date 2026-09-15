/**
 * Supabase mirror for the local-first stores.
 *
 * `startSync()` is a **no-op in demo mode** (no Supabase env vars, or no signed
 * in user). Otherwise, on every auth session it:
 *   1. re-keys local rows from the demo user id to the auth user id,
 *   2. pulls the user's rows and merges them in (newer `updated_at` wins),
 *   3. subscribes to each store and pushes changed rows as debounced upserts.
 *
 * Nothing here ever throws into the UI — every failure is logged and swallowed.
 *
 * ## Schema assumptions (reconcile with `supabase/migrations/0001_init.sql`)
 * - Table names: `profiles`, `pantry_items`, `recipes`, `meal_plans`,
 *   `grocery_lists`, `schedule_changes`, `cook_sessions`, `meal_feedback`,
 *   `preference_models`.
 * - Top-level columns are the snake_case of the camelCase field in `types.ts`
 *   (`proteinTargetG` → `protein_target_g`, `vitaminCMg` → `vitamin_c_mg`, …).
 * - Nested arrays/objects are single `jsonb` columns (`meals`, `items`,
 *   `ingredients`, `steps`, `ingredient_logs`, `step_logs`,
 *   `temperature_history`, `nutrition_per_serving`, `retention`,
 *   `recipe_scores`, `ingredient_affinity`, `cuisine_affinity`, `tag_affinity`)
 *   and their **inner keys stay camelCase**, exactly as in `types.ts`.
 * - Owner column: `profiles.id`, `recipes.created_by`, `user_id` everywhere else.
 * - Conflict target: `preference_models` upserts on `user_id`; every other table
 *   on `id`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  CookSession,
  GroceryList,
  ID,
  MealFeedback,
  MealPlan,
  PantryItem,
  PreferenceModel,
  Recipe,
  ScheduleChange,
  UserProfile,
} from "@/lib/types";
import {
  useCookStore,
  useFeedbackStore,
  useGroceryStore,
  usePantryStore,
  usePlanStore,
  usePreferenceStore,
  useProfileStore,
  useRecipeStore,
} from "./stores";

/** Debounce window for pushes (ms). */
export const PUSH_DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// camelCase <-> snake_case (top level only; nested values are jsonb payloads)
// ---------------------------------------------------------------------------

export function snakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function camelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function toSnakeRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[snakeKey(k)] = v;
  }
  return out;
}

export function toCamelRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) continue;
    out[camelKey(k)] = v;
  }
  return out;
}

function warn(scope: string, err: unknown): void {
  console.warn(`[cookwise/sync] ${scope}`, err);
}

// ---------------------------------------------------------------------------
// Minimal query surface
//
// The Supabase client may later gain a generated `Database` generic; casting to
// this structural view keeps sync.ts compiling either way (table names are
// dynamic here, so generated row types cannot be inferred anyway).
// ---------------------------------------------------------------------------

type AnyRow = Record<string, unknown>;
type Result<T> = PromiseLike<{ data?: T; error: unknown }>;

interface QueryLike {
  select(columns: string): {
    eq(column: string, value: string): Result<AnyRow[] | null>;
  };
  upsert(values: AnyRow[], options: { onConflict: string }): Result<null>;
  delete(): {
    in(
      column: string,
      values: string[],
    ): { eq(column: string, value: string): Result<null> };
  };
}

function table(client: SupabaseClient, name: string): QueryLike {
  return client.from(name) as unknown as QueryLike;
}

// ---------------------------------------------------------------------------
// Entity descriptors
// ---------------------------------------------------------------------------

interface Entity<T> {
  table: string;
  /** Column used to scope the pull to the signed-in user. */
  ownerColumn: string;
  /** Upsert conflict target. */
  conflict: string;
  /** Local identity used for change tracking. */
  idOf(row: T): string;
  /** Timestamp used for "newer wins". */
  stamp(row: T): string;
  /** Rows currently held locally. */
  rows(): T[];
  /** Merge pulled rows into the store. */
  apply(remote: T[], userId: ID): void;
  /** Stamp the row with the owner before pushing. */
  own(row: T, userId: ID): Record<string, unknown>;
  subscribe(cb: () => void): () => void;
}

function mergeById<T>(
  local: T[],
  remote: T[],
  idOf: (r: T) => string,
  stamp: (r: T) => string,
): T[] {
  const map = new Map(local.map((r) => [idOf(r), r]));
  for (const r of remote) {
    const cur = map.get(idOf(r));
    if (!cur || stamp(r) > stamp(cur)) map.set(idOf(r), r);
  }
  return [...map.values()];
}

const withOwner = (row: object, userId: ID, column = "userId") => ({
  ...(row as Record<string, unknown>),
  [column]: userId,
});

function buildEntities(): Entity<never>[] {
  const list: Entity<never>[] = [];
  const push = <T>(e: Entity<T>) => list.push(e as unknown as Entity<never>);

  push<UserProfile>({
    table: "profiles",
    ownerColumn: "id",
    conflict: "id",
    idOf: (p) => p.id,
    stamp: (p) => p.updatedAt,
    rows: () => {
      const p = useProfileStore.getState().profile;
      return p ? [p] : [];
    },
    apply: (remote) => {
      const local = useProfileStore.getState().profile;
      const incoming = remote[0];
      if (!incoming) return;
      if (!local || incoming.updatedAt > local.updatedAt) {
        useProfileStore.setState({ profile: incoming });
      }
    },
    own: (p, userId) => ({ ...p, id: userId }),
    subscribe: (cb) => useProfileStore.subscribe(cb),
  });

  push<PantryItem>({
    table: "pantry_items",
    ownerColumn: "user_id",
    conflict: "id",
    idOf: (i) => i.id,
    stamp: (i) => i.updatedAt,
    rows: () => usePantryStore.getState().items,
    apply: (remote) => {
      usePantryStore.setState({
        items: mergeById(
          usePantryStore.getState().items,
          remote,
          (i) => i.id,
          (i) => i.updatedAt,
        ),
      });
    },
    own: (i, userId) => withOwner(i, userId),
    subscribe: (cb) => usePantryStore.subscribe(cb),
  });

  push<Recipe>({
    table: "recipes",
    ownerColumn: "created_by",
    conflict: "id",
    idOf: (r) => r.id,
    // Recipes have no updatedAt; remote never overwrites a local edit.
    stamp: () => "",
    rows: () => useRecipeStore.getState().recipes.filter((r) => !r.isPublic),
    apply: (remote) => {
      useRecipeStore.setState({
        recipes: mergeById(
          useRecipeStore.getState().recipes,
          remote,
          (r) => r.id,
          () => "",
        ),
      });
    },
    own: (r, userId) => withOwner(r, userId, "createdBy"),
    subscribe: (cb) => useRecipeStore.subscribe(cb),
  });

  push<MealPlan>({
    table: "meal_plans",
    ownerColumn: "user_id",
    conflict: "id",
    idOf: (p) => p.id,
    stamp: (p) => p.updatedAt,
    rows: () => usePlanStore.getState().plans,
    apply: (remote) => {
      usePlanStore.setState({
        plans: mergeById(
          usePlanStore.getState().plans,
          remote,
          (p) => p.id,
          (p) => p.updatedAt,
        ),
      });
    },
    own: (p, userId) => withOwner(p, userId),
    subscribe: (cb) => usePlanStore.subscribe(cb),
  });

  push<ScheduleChange>({
    table: "schedule_changes",
    ownerColumn: "user_id",
    conflict: "id",
    idOf: (c) => c.id,
    stamp: (c) => c.createdAt,
    rows: () => usePlanStore.getState().changes,
    apply: (remote) => {
      usePlanStore.setState({
        changes: mergeById(
          usePlanStore.getState().changes,
          remote,
          (c) => c.id,
          (c) => c.createdAt,
        ),
      });
    },
    own: (c, userId) => withOwner(c, userId),
    subscribe: (cb) => usePlanStore.subscribe(cb),
  });

  push<GroceryList>({
    table: "grocery_lists",
    ownerColumn: "user_id",
    conflict: "id",
    idOf: (l) => l.id,
    stamp: (l) => l.updatedAt,
    rows: () => useGroceryStore.getState().lists,
    apply: (remote) => {
      useGroceryStore.setState({
        lists: mergeById(
          useGroceryStore.getState().lists,
          remote,
          (l) => l.id,
          (l) => l.updatedAt,
        ),
      });
    },
    own: (l, userId) => withOwner(l, userId),
    subscribe: (cb) => useGroceryStore.subscribe(cb),
  });

  push<CookSession>({
    table: "cook_sessions",
    ownerColumn: "user_id",
    conflict: "id",
    idOf: (s) => s.id,
    stamp: (s) => s.completedAt ?? s.startedAt,
    rows: () => useCookStore.getState().sessions,
    apply: (remote) => {
      useCookStore.setState({
        sessions: mergeById(
          useCookStore.getState().sessions,
          remote,
          (s) => s.id,
          (s) => s.completedAt ?? s.startedAt,
        ),
      });
    },
    own: (s, userId) => withOwner(s, userId),
    subscribe: (cb) => useCookStore.subscribe(cb),
  });

  push<MealFeedback>({
    table: "meal_feedback",
    ownerColumn: "user_id",
    conflict: "id",
    idOf: (f) => f.id,
    stamp: (f) => f.createdAt,
    rows: () => useFeedbackStore.getState().feedback,
    apply: (remote) => {
      useFeedbackStore.setState({
        feedback: mergeById(
          useFeedbackStore.getState().feedback,
          remote,
          (f) => f.id,
          (f) => f.createdAt,
        ),
      });
    },
    own: (f, userId) => withOwner(f, userId),
    subscribe: (cb) => useFeedbackStore.subscribe(cb),
  });

  push<PreferenceModel>({
    table: "preference_models",
    ownerColumn: "user_id",
    conflict: "user_id",
    idOf: (m) => m.userId,
    stamp: (m) => m.updatedAt,
    rows: () => [usePreferenceStore.getState().model],
    apply: (remote) => {
      const incoming = remote[0];
      if (!incoming) return;
      const local = usePreferenceStore.getState().model;
      if (incoming.updatedAt > local.updatedAt) {
        usePreferenceStore.setState({ model: incoming });
      }
    },
    own: (m, userId) => withOwner(m, userId),
    subscribe: (cb) => usePreferenceStore.subscribe(cb),
  });

  return list;
}

// ---------------------------------------------------------------------------
// Pull / push
// ---------------------------------------------------------------------------

async function pullEntity(
  client: SupabaseClient,
  entity: Entity<never>,
  userId: ID,
): Promise<void> {
  try {
    const { data, error } = await table(client, entity.table)
      .select("*")
      .eq(entity.ownerColumn, userId);
    if (error) {
      warn(`pull ${entity.table}`, error);
      return;
    }
    const rows = (data ?? []).map((r) =>
      toCamelRow(r as Record<string, unknown>),
    ) as never[];
    if (rows.length) entity.apply(rows, userId);
  } catch (err) {
    warn(`pull ${entity.table}`, err);
  }
}

/** One debounced pusher per entity; tracks what it last sent to avoid churn. */
function createPusher(
  client: SupabaseClient,
  entity: Entity<never>,
  userId: ID,
) {
  const lastSent = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  const flush = async (): Promise<void> => {
    const rows = entity.rows();
    const seen = new Set<string>();
    const changed: Record<string, unknown>[] = [];

    for (const row of rows) {
      const id = entity.idOf(row);
      seen.add(id);
      const owned = entity.own(row, userId);
      const json = JSON.stringify(owned);
      if (lastSent.get(id) === json) continue;
      lastSent.set(id, json);
      changed.push(toSnakeRow(owned));
    }

    const removed = [...lastSent.keys()].filter((id) => !seen.has(id));
    for (const id of removed) lastSent.delete(id);

    try {
      if (changed.length) {
        const { error } = await table(client, entity.table).upsert(changed, {
          onConflict: entity.conflict,
        });
        if (error) warn(`push ${entity.table}`, error);
      }
      if (removed.length && entity.conflict === "id") {
        const { error } = await table(client, entity.table)
          .delete()
          .in("id", removed)
          .eq(entity.ownerColumn, userId);
        if (error) warn(`delete ${entity.table}`, error);
      }
    } catch (err) {
      warn(`push ${entity.table}`, err);
    }
  };

  return {
    /** Record the current rows as already-synced (after a pull). */
    prime(): void {
      lastSent.clear();
      for (const row of entity.rows()) {
        lastSent.set(entity.idOf(row), JSON.stringify(entity.own(row, userId)));
      }
    },
    schedule(): void {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        inFlight = inFlight.then(flush).catch((err) => warn(entity.table, err));
      }, PUSH_DEBOUNCE_MS);
    },
    dispose(): void {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/**
 * Re-key local rows from the demo user id to the signed-in auth user id, so the
 * first push does not violate the "owner only" RLS policies.
 */
function reassignUserId(userId: ID): void {
  const profile = useProfileStore.getState().profile;
  if (profile && profile.id !== userId) {
    useProfileStore.getState().setUserId(userId);
  }
  usePreferenceStore.getState().setUserId(userId);

  const stamp = <T extends { userId: ID }>(rows: T[]): T[] =>
    rows.some((r) => r.userId !== userId)
      ? rows.map((r) => (r.userId === userId ? r : { ...r, userId }))
      : rows;

  usePantryStore.setState({ items: stamp(usePantryStore.getState().items) });
  usePlanStore.setState({
    plans: stamp(usePlanStore.getState().plans),
    changes: stamp(usePlanStore.getState().changes),
  });
  useGroceryStore.setState({ lists: stamp(useGroceryStore.getState().lists) });
  useCookStore.setState({ sessions: stamp(useCookStore.getState().sessions) });
  useFeedbackStore.setState({
    feedback: stamp(useFeedbackStore.getState().feedback),
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start mirroring the local stores to Supabase.
 * Returns a disposer; a no-op function in demo mode.
 */
export function startSync(): () => void {
  if (!isSupabaseConfigured()) return () => {};
  const client = getBrowserSupabase();
  if (!client) return () => {};

  const entities = buildEntities();
  let sessionDisposers: Array<() => void> = [];
  let currentUserId: ID | null = null;
  let stopped = false;

  const stopSession = (): void => {
    for (const d of sessionDisposers) {
      try {
        d();
      } catch (err) {
        warn("dispose", err);
      }
    }
    sessionDisposers = [];
    currentUserId = null;
  };

  const startForUser = async (userId: ID): Promise<void> => {
    if (stopped || currentUserId === userId) return;
    stopSession();
    currentUserId = userId;
    try {
      reassignUserId(userId);
      for (const entity of entities) {
        await pullEntity(client, entity, userId);
      }
      if (stopped || currentUserId !== userId) return;

      for (const entity of entities) {
        const pusher = createPusher(client, entity, userId);
        pusher.prime();
        const unsubscribe = entity.subscribe(() => pusher.schedule());
        sessionDisposers.push(() => {
          pusher.dispose();
          unsubscribe();
        });
      }
    } catch (err) {
      warn("startForUser", err);
    }
  };

  client.auth
    .getSession()
    .then(({ data }) => {
      const user = data.session?.user;
      if (user) void startForUser(user.id);
    })
    .catch((err) => warn("getSession", err));

  let authUnsubscribe: (() => void) | null = null;
  try {
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) void startForUser(user.id);
      else stopSession();
    });
    authUnsubscribe = () => data.subscription.unsubscribe();
  } catch (err) {
    warn("onAuthStateChange", err);
  }

  return () => {
    stopped = true;
    stopSession();
    try {
      authUnsubscribe?.();
    } catch (err) {
      warn("dispose auth", err);
    }
  };
}

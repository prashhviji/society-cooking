/**
 * Local-first persistence primitives.
 *
 * A single Dexie database (`cookwise`) with one `kv` table backs the Zustand
 * `persist` middleware (see `./storage.ts`). Everything here is browser-only:
 * on the server (RSC / route handlers / tests running in node) `getDb()`
 * returns `null` and the helpers transparently fall back to an in-memory map so
 * imports never explode and the UI never hangs.
 */

import Dexie, { type Table } from "dexie";

export interface KvRow {
  key: string;
  /** JSON string produced by zustand's `createJSONStorage`. */
  value: string;
}

export const DB_NAME = "cookwise";
export const DB_VERSION = 1;

export class CookwiseDb extends Dexie {
  kv!: Table<KvRow, string>;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({ kv: "key" });
  }
}

let instance: CookwiseDb | null = null;
/** Flipped once IndexedDB proves unusable (SSR, private mode, quota errors). */
let memoryOnly = false;

/** In-memory fallback so the app still works without IndexedDB. */
const memory = new Map<string, string>();

function indexedDbAvailable(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function degrade(err: unknown): null {
  if (!memoryOnly) {
    memoryOnly = true;
    console.warn(
      "[cookwise/db] IndexedDB unavailable — falling back to in-memory storage.",
      err,
    );
  }
  return null;
}

/** The Dexie instance, or `null` on the server / when IndexedDB is unusable. */
export function getDb(): CookwiseDb | null {
  if (memoryOnly) return null;
  if (!indexedDbAvailable()) return null;
  if (!instance) {
    try {
      instance = new CookwiseDb();
    } catch (err) {
      return degrade(err);
    }
  }
  return instance;
}

/** True when reads/writes are going to the in-memory map instead of Dexie. */
export function isUsingMemoryFallback(): boolean {
  return memoryOnly || !indexedDbAvailable();
}

export async function kvGet(key: string): Promise<string | null> {
  const db = getDb();
  if (!db) return memory.get(key) ?? null;
  try {
    const row = await db.kv.get(key);
    return row?.value ?? null;
  } catch (err) {
    degrade(err);
    return memory.get(key) ?? null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  memory.set(key, value);
  const db = getDb();
  if (!db) return;
  try {
    await db.kv.put({ key, value });
  } catch (err) {
    degrade(err);
  }
}

export async function kvDelete(key: string): Promise<void> {
  memory.delete(key);
  const db = getDb();
  if (!db) return;
  try {
    await db.kv.delete(key);
  } catch (err) {
    degrade(err);
  }
}

export async function kvKeys(): Promise<string[]> {
  const db = getDb();
  if (!db) return [...memory.keys()];
  try {
    return (await db.kv.toCollection().primaryKeys()) as string[];
  } catch (err) {
    degrade(err);
    return [...memory.keys()];
  }
}

/** Wipe every persisted store + seed flag (used by "Reset demo data"). */
export async function kvClear(): Promise<void> {
  memory.clear();
  const db = getDb();
  if (!db) return;
  try {
    await db.kv.clear();
  } catch (err) {
    degrade(err);
  }
}

/** Test seam: forget the cached Dexie handle and the memory map. */
export function __resetDbForTests(): void {
  instance = null;
  memoryOnly = false;
  memory.clear();
}

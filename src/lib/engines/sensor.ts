/**
 * Sensor dock abstraction: a kitchen scale + pan thermometer.
 *
 * `SimulatedSensorDock` is the default everywhere — it drives the demo and the
 * tests. `WebBluetoothDock` talks to a real dock when the browser exposes Web
 * Bluetooth and fails with a friendly message when it does not.
 *
 * Nothing in this module touches `window` / `navigator` at import time, so it
 * is safe to import from a server component.
 */

import type { SensorReading } from "@/lib/types";

export type BurnerLevel = 0 | 1 | 2 | 3 | 4; // off, low, medium-low, medium, high
export type DockKind = "simulated" | "bluetooth";

export interface SensorDock {
  readonly kind: DockKind;
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(cb: (r: SensorReading) => void): () => void;
  tare(): void;
  isConnected(): boolean;
}

export interface SimulatedDock extends SensorDock {
  readonly kind: "simulated";
  /** Add (or remove, negative) grams to the pan; weight ramps and settles. */
  simulateAdd(grams: number): void;
  /** Set burner level; temperature drifts toward the level's setpoint. */
  setBurner(level: BurnerLevel): void;
  getBurner(): BurnerLevel;
}

// ---------------------------------------------------------------------------
// Simulator tuning
// ---------------------------------------------------------------------------

/** Emit a reading this often while connected. */
export const SIM_TICK_MS = 200;
/** Share of the remaining gap the weight closes each tick. */
export const SIM_EASE = 0.35;
/** Peak ± measurement noise on the reported weight. */
export const SIM_NOISE_G = 0.3;
/** |gap| below this counts as settled. */
export const SIM_STABLE_EPS_G = 0.5;
/** …for this many consecutive ticks. */
export const SIM_STABLE_TICKS = 4;
/** Pan setpoint per burner level, °C. */
export const BURNER_SETPOINT_C: readonly number[] = [25, 90, 120, 150, 200];
export const AMBIENT_C = 25;
/** First-order thermal time constant of the pan, seconds. */
export const SIM_TEMP_TAU_S = 8;

export interface SimulatedDockOptions {
  /** Seed the noise generator for reproducible tests. */
  seed?: number;
  /** Starting weight on the pan, grams. */
  initialWeightG?: number;
  tickMs?: number;
}

function noiseGenerator(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SimulatedSensorDock implements SimulatedDock {
  readonly kind = "simulated" as const;

  private readonly tickMs: number;
  private readonly rnd: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private subscribers = new Set<(r: SensorReading) => void>();

  /** True contents of the pan; the reading eases toward this. */
  private target: number;
  /** Smoothed (noise-free) weight. */
  private weight: number;
  /** Tare offset subtracted from every reported weight. */
  private offset = 0;
  private stableTicks = 0;
  private stable = true;
  private tempC = AMBIENT_C;
  private burner: BurnerLevel = 0;
  private connected = false;

  constructor(options: SimulatedDockOptions = {}) {
    this.tickMs = options.tickMs ?? SIM_TICK_MS;
    this.rnd = noiseGenerator(options.seed ?? 0x9e3779b9);
    this.target = options.initialWeightG ?? 0;
    this.weight = this.target;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.connected = true;
    this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  disconnect(): void {
    this.connected = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribe(cb: (r: SensorReading) => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  /** Zero the scale: whatever is on the pan right now reads as 0 g. */
  tare(): void {
    this.offset = this.weight;
    this.stableTicks = 0;
    this.stable = false;
  }

  simulateAdd(grams: number): void {
    this.target = Math.max(0, this.target + grams);
    this.stableTicks = 0;
    this.stable = false;
  }

  setBurner(level: BurnerLevel): void {
    this.burner = level;
  }

  getBurner(): BurnerLevel {
    return this.burner;
  }

  /** Latest reading without waiting for the next tick. */
  read(): SensorReading {
    return {
      weightG: roundG(this.weight - this.offset),
      stable: this.stable,
      tempC: Math.round(this.tempC * 10) / 10,
      ts: Date.now(),
    };
  }

  private tick(): void {
    // Weight: close a fixed share of the gap each tick (exponential approach).
    const gap = this.target - this.weight;
    this.weight += gap * SIM_EASE;
    if (Math.abs(this.target - this.weight) < SIM_STABLE_EPS_G) {
      this.stableTicks += 1;
    } else {
      this.stableTicks = 0;
    }
    this.stable = this.stableTicks >= SIM_STABLE_TICKS;

    // Temperature: first-order approach to the burner setpoint (ambient when off).
    const setpoint = this.burner === 0 ? AMBIENT_C : BURNER_SETPOINT_C[this.burner];
    const dt = this.tickMs / 1000;
    this.tempC += (setpoint - this.tempC) * (dt / SIM_TEMP_TAU_S);

    const noise = (this.rnd() * 2 - 1) * SIM_NOISE_G;
    const reading: SensorReading = {
      weightG: roundG(this.weight - this.offset + noise),
      stable: this.stable,
      tempC: Math.round(this.tempC * 10) / 10,
      ts: Date.now(),
    };
    for (const cb of this.subscribers) cb(reading);
  }
}

function roundG(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Web Bluetooth
// ---------------------------------------------------------------------------

/**
 * Assumed dock protocol (documented in docs/ENGINES.md):
 * one notify characteristic, little-endian, 6–7 bytes:
 *   [0..3] int32  weight in grams
 *   [4..5] int16  pan temperature × 10 °C
 *   [6]    uint8  flags — bit 0 = weight stable (optional)
 */
export const DOCK_SERVICE_UUID = 0x181d; // Bluetooth SIG "Weight Scale"
export const DOCK_MEASUREMENT_CHAR_UUID = 0x2a9d; // "Weight Measurement"

export const WEB_BLUETOOTH_UNAVAILABLE =
  "Web Bluetooth is not available on this device. Using the simulator instead.";

interface BluetoothCharacteristicLike {
  value?: DataView;
  startNotifications(): Promise<BluetoothCharacteristicLike>;
  stopNotifications(): Promise<BluetoothCharacteristicLike>;
  addEventListener(type: string, listener: (ev: Event) => void): void;
  removeEventListener(type: string, listener: (ev: Event) => void): void;
}

interface BluetoothServiceLike {
  getCharacteristic(uuid: string | number): Promise<BluetoothCharacteristicLike>;
}

interface BluetoothServerLike {
  connected: boolean;
  getPrimaryService(uuid: string | number): Promise<BluetoothServiceLike>;
  disconnect(): void;
}

interface BluetoothDeviceLike {
  name?: string;
  gatt?: { connect(): Promise<BluetoothServerLike>; disconnect(): void };
}

interface BluetoothLike {
  requestDevice(options: {
    filters?: { services?: (string | number)[]; namePrefix?: string }[];
    optionalServices?: (string | number)[];
  }): Promise<BluetoothDeviceLike>;
}

/** Safe in SSR: reads `navigator` lazily, never at module scope. */
export function webBluetoothAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean((navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth);
}

/** Parse the dock's notify payload. Exported so it can be unit-tested. */
export function parseDockPayload(view: DataView): SensorReading {
  const weightG = view.byteLength >= 4 ? view.getInt32(0, true) : 0;
  const tempC = view.byteLength >= 6 ? view.getInt16(4, true) / 10 : undefined;
  const stable = view.byteLength >= 7 ? (view.getUint8(6) & 0x01) === 0x01 : true;
  return { weightG, stable, tempC, ts: Date.now() };
}

export class WebBluetoothDock implements SensorDock {
  readonly kind = "bluetooth" as const;

  private subscribers = new Set<(r: SensorReading) => void>();
  private server: BluetoothServerLike | null = null;
  private characteristic: BluetoothCharacteristicLike | null = null;
  private listener: ((ev: Event) => void) | null = null;
  private offset = 0;
  private lastRawG = 0;

  async connect(): Promise<void> {
    if (!webBluetoothAvailable()) {
      throw new Error(WEB_BLUETOOTH_UNAVAILABLE);
    }
    const bluetooth = (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth;
    if (!bluetooth) throw new Error(WEB_BLUETOOTH_UNAVAILABLE);

    const device = await bluetooth.requestDevice({
      filters: [{ services: [DOCK_SERVICE_UUID] }],
      optionalServices: [DOCK_SERVICE_UUID],
    });
    if (!device.gatt) throw new Error(WEB_BLUETOOTH_UNAVAILABLE);

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(DOCK_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(DOCK_MEASUREMENT_CHAR_UUID);

    const listener = (ev: Event) => {
      const target = ev.target as { value?: DataView } | null;
      const view = target?.value ?? characteristic.value;
      if (!view) return;
      const raw = parseDockPayload(view);
      this.lastRawG = raw.weightG;
      const reading: SensorReading = { ...raw, weightG: raw.weightG - this.offset };
      for (const cb of this.subscribers) cb(reading);
    };

    characteristic.addEventListener("characteristicvaluechanged", listener);
    await characteristic.startNotifications();

    this.server = server;
    this.characteristic = characteristic;
    this.listener = listener;
  }

  disconnect(): void {
    if (this.characteristic && this.listener) {
      this.characteristic.removeEventListener("characteristicvaluechanged", this.listener);
      void this.characteristic.stopNotifications().catch(() => {});
    }
    if (this.server?.connected) this.server.disconnect();
    this.characteristic = null;
    this.listener = null;
    this.server = null;
  }

  isConnected(): boolean {
    return Boolean(this.server?.connected);
  }

  subscribe(cb: (r: SensorReading) => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  /** The reference dock has no tare command, so we zero in software. */
  tare(): void {
    this.offset = this.lastRawG;
  }
}

export function createSensorDock(kind: DockKind = "simulated"): SensorDock {
  return kind === "bluetooth" ? new WebBluetoothDock() : new SimulatedSensorDock();
}

export function isSimulatedDock(d: SensorDock): d is SimulatedDock {
  return d.kind === "simulated";
}

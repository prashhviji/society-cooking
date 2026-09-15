import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SensorReading } from "@/lib/types";
import {
  AMBIENT_C,
  SIM_TICK_MS,
  SimulatedSensorDock,
  WEB_BLUETOOTH_UNAVAILABLE,
  WebBluetoothDock,
  createSensorDock,
  isSimulatedDock,
  parseDockPayload,
  webBluetoothAvailable,
} from "../sensor";

function collect(dock: SimulatedSensorDock): SensorReading[] {
  const out: SensorReading[] = [];
  dock.subscribe((r) => out.push(r));
  return out;
}

describe("createSensorDock", () => {
  it("returns a simulator by default", () => {
    const dock = createSensorDock();
    expect(dock.kind).toBe("simulated");
    expect(isSimulatedDock(dock)).toBe(true);
  });

  it("returns a bluetooth dock when asked", () => {
    const dock = createSensorDock("bluetooth");
    expect(dock.kind).toBe("bluetooth");
    expect(isSimulatedDock(dock)).toBe(false);
  });

  it("does not touch the DOM at import time", () => {
    expect(webBluetoothAvailable()).toBe(false); // node environment
  });
});

describe("SimulatedSensorDock", () => {
  let dock: SimulatedSensorDock;

  beforeEach(() => {
    vi.useFakeTimers();
    dock = new SimulatedSensorDock({ seed: 42 });
  });

  afterEach(() => {
    dock.disconnect();
    vi.useRealTimers();
  });

  it("emits a reading every 200 ms while connected", async () => {
    const readings = collect(dock);
    await dock.connect();
    expect(dock.isConnected()).toBe(true);
    vi.advanceTimersByTime(SIM_TICK_MS * 5);
    expect(readings).toHaveLength(5);

    dock.disconnect();
    vi.advanceTimersByTime(SIM_TICK_MS * 5);
    expect(readings).toHaveLength(5);
    expect(dock.isConnected()).toBe(false);
  });

  it("ramps toward the target and reports stable once settled", async () => {
    const readings = collect(dock);
    await dock.connect();
    dock.simulateAdd(100);

    vi.advanceTimersByTime(SIM_TICK_MS * 3);
    const early = readings[readings.length - 1];
    expect(early.weightG).toBeGreaterThan(0);
    expect(early.weightG).toBeLessThan(100);
    expect(early.stable).toBe(false);

    vi.advanceTimersByTime(SIM_TICK_MS * 30);
    const settled = readings[readings.length - 1];
    expect(settled.weightG).toBeGreaterThan(99.4);
    expect(settled.weightG).toBeLessThan(100.6);
    expect(settled.stable).toBe(true);
  });

  it("only reports stable after 4 consecutive settled ticks", async () => {
    const readings = collect(dock);
    await dock.connect();
    dock.simulateAdd(50);
    // 0.65^n × 50 < 0.5 → n ≥ 11; stable then needs 4 more ticks.
    vi.advanceTimersByTime(SIM_TICK_MS * 12);
    expect(readings[readings.length - 1].stable).toBe(false);
    vi.advanceTimersByTime(SIM_TICK_MS * 4);
    expect(readings[readings.length - 1].stable).toBe(true);
  });

  it("tares to zero and keeps counting from there", async () => {
    const readings = collect(dock);
    await dock.connect();
    dock.simulateAdd(200);
    vi.advanceTimersByTime(SIM_TICK_MS * 40);
    expect(readings[readings.length - 1].weightG).toBeCloseTo(200, 0);

    dock.tare();
    vi.advanceTimersByTime(SIM_TICK_MS * 5);
    expect(Math.abs(readings[readings.length - 1].weightG)).toBeLessThan(0.5);

    dock.simulateAdd(75);
    vi.advanceTimersByTime(SIM_TICK_MS * 40);
    expect(readings[readings.length - 1].weightG).toBeCloseTo(75, 0);
  });

  it("removes weight when simulateAdd is negative and never goes below zero", async () => {
    const readings = collect(dock);
    await dock.connect();
    dock.simulateAdd(100);
    vi.advanceTimersByTime(SIM_TICK_MS * 40);
    dock.simulateAdd(-500);
    vi.advanceTimersByTime(SIM_TICK_MS * 60);
    expect(Math.abs(readings[readings.length - 1].weightG)).toBeLessThan(0.5);
  });

  it("drifts the pan temperature toward the burner setpoint and back to ambient", async () => {
    const readings = collect(dock);
    await dock.connect();
    expect(dock.getBurner()).toBe(0);

    dock.setBurner(4); // 200 °C
    vi.advanceTimersByTime(30_000); // ≈ 3.75 time constants
    expect(dock.getBurner()).toBe(4);
    const hot = readings[readings.length - 1].tempC ?? 0;
    expect(hot).toBeGreaterThan(180);
    expect(hot).toBeLessThanOrEqual(200);

    dock.setBurner(2); // 120 °C
    vi.advanceTimersByTime(40_000);
    const medium = readings[readings.length - 1].tempC ?? 0;
    expect(medium).toBeGreaterThan(115);
    expect(medium).toBeLessThan(125);

    dock.setBurner(0);
    vi.advanceTimersByTime(60_000);
    expect(readings[readings.length - 1].tempC ?? 0).toBeLessThan(AMBIENT_C + 2);
  });

  it("unsubscribes cleanly", async () => {
    const seen: SensorReading[] = [];
    const off = dock.subscribe((r) => seen.push(r));
    await dock.connect();
    vi.advanceTimersByTime(SIM_TICK_MS * 2);
    off();
    vi.advanceTimersByTime(SIM_TICK_MS * 5);
    expect(seen).toHaveLength(2);
  });

  it("exposes a synchronous read()", async () => {
    await dock.connect();
    dock.simulateAdd(10);
    vi.advanceTimersByTime(SIM_TICK_MS * 40);
    expect(dock.read().weightG).toBeCloseTo(10, 1);
    expect(dock.read().stable).toBe(true);
  });
});

describe("WebBluetoothDock", () => {
  it("rejects with a friendly message when Web Bluetooth is missing", async () => {
    const dock = new WebBluetoothDock();
    await expect(dock.connect()).rejects.toThrow(WEB_BLUETOOTH_UNAVAILABLE);
    expect(dock.isConnected()).toBe(false);
  });

  it("parses the little-endian int32 grams + int16 °C×10 payload", () => {
    const buf = new ArrayBuffer(7);
    const view = new DataView(buf);
    view.setInt32(0, 1234, true);
    view.setInt16(4, 1755, true); // 175.5 °C
    view.setUint8(6, 0x01);
    const reading = parseDockPayload(view);
    expect(reading.weightG).toBe(1234);
    expect(reading.tempC).toBeCloseTo(175.5, 3);
    expect(reading.stable).toBe(true);
  });

  it("treats a short payload as weight-only and stable", () => {
    const view = new DataView(new ArrayBuffer(4));
    view.setInt32(0, -12, true);
    const reading = parseDockPayload(view);
    expect(reading.weightG).toBe(-12);
    expect(reading.tempC).toBeUndefined();
    expect(reading.stable).toBe(true);
  });
});

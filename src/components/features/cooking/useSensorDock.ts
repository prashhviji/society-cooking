"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSensorDock,
  isSimulatedDock,
  type BurnerLevel,
  type DockKind,
  type SensorDock,
} from "@/lib/engines/sensor";
import type { SensorReading } from "@/lib/types";

/** Ignore readings that arrive faster than this (the simulator ticks at 200 ms). */
const THROTTLE_MS = 150;

export interface SensorDockState {
  /** Latest reading, or `null` before the first tick. */
  reading: SensorReading | null;
  /** Latest weight in grams (0 before the first tick). */
  weightG: number;
  /** Latest pan temperature, if the dock reports one. */
  tempC: number | undefined;
  stable: boolean;
  connected: boolean;
  kind: DockKind;
  /** True while the simulator is driving the readings. */
  simulated: boolean;
  burner: BurnerLevel;
  tare(): void;
  /** Simulator only — add (or remove) grams from the pan. */
  simulateAdd(grams: number): void;
  /** Simulator only — change the burner setpoint. */
  setBurner(level: BurnerLevel): void;
  /**
   * Try to pair a real Web Bluetooth dock. Rejects with a friendly message
   * (`WEB_BLUETOOTH_UNAVAILABLE`) and keeps the simulator running on failure.
   */
  connectBluetooth(): Promise<void>;
}

/**
 * Owns one `SensorDock` for the lifetime of the screen: connects on mount,
 * throttles readings into React state and always disconnects on unmount.
 */
export function useSensorDock(): SensorDockState {
  const dockRef = useRef<SensorDock | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastAtRef = useRef(0);

  const [reading, setReading] = useState<SensorReading | null>(null);
  const [kind, setKind] = useState<DockKind>("simulated");
  const [connected, setConnected] = useState(false);
  const [burner, setBurnerLevel] = useState<BurnerLevel>(0);

  const attach = useCallback((dock: SensorDock) => {
    unsubscribeRef.current?.();
    dockRef.current = dock;
    lastAtRef.current = 0;
    unsubscribeRef.current = dock.subscribe((r) => {
      const now = Date.now();
      if (now - lastAtRef.current < THROTTLE_MS) return;
      lastAtRef.current = now;
      setReading(r);
    });
  }, []);

  useEffect(() => {
    const dock = createSensorDock("simulated");
    attach(dock);
    let cancelled = false;
    void dock
      .connect()
      .then(() => {
        if (!cancelled) setConnected(true);
      })
      .catch(() => {
        /* the simulator never rejects; a real dock reports through connectBluetooth */
      });

    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      dockRef.current?.disconnect();
      dockRef.current = null;
      setConnected(false);
    };
  }, [attach]);

  const tare = useCallback(() => {
    dockRef.current?.tare();
    setReading((r) => (r ? { ...r, weightG: 0, stable: false } : r));
  }, []);

  const simulateAdd = useCallback((grams: number) => {
    const dock = dockRef.current;
    if (dock && isSimulatedDock(dock)) dock.simulateAdd(grams);
  }, []);

  const setBurner = useCallback((level: BurnerLevel) => {
    const dock = dockRef.current;
    if (dock && isSimulatedDock(dock)) {
      dock.setBurner(level);
      setBurnerLevel(level);
    }
  }, []);

  const connectBluetooth = useCallback(async () => {
    const next = createSensorDock("bluetooth");
    await next.connect(); // throws WEB_BLUETOOTH_UNAVAILABLE when unsupported
    dockRef.current?.disconnect();
    attach(next);
    setKind(next.kind);
    setConnected(true);
  }, [attach]);

  return {
    reading,
    weightG: reading?.weightG ?? 0,
    tempC: reading?.tempC,
    stable: reading?.stable ?? true,
    connected,
    kind,
    simulated: kind === "simulated",
    burner,
    tare,
    simulateAdd,
    setBurner,
    connectBluetooth,
  };
}

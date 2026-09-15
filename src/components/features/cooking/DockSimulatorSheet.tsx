"use client";

import { Button, SegmentedControl, Sheet } from "@/components/ui";
import type { BurnerLevel } from "@/lib/engines/sensor";
import type { SensorDockState } from "./useSensorDock";

const BURNERS: { value: string; label: string }[] = [
  { value: "0", label: "Off" },
  { value: "1", label: "Low" },
  { value: "2", label: "M-low" },
  { value: "3", label: "Med" },
  { value: "4", label: "High" },
];

const ADDITIONS = [50, 100, 200, 1000];

export interface DockSimulatorSheetProps {
  open: boolean;
  onClose(): void;
  dock: SensorDockState;
  /** Enables "Place exact target" for the ingredient / step being measured. */
  targetGrams?: number;
}

/** Demo control panel for the simulated dock: weight, tare and burner level. */
export function DockSimulatorSheet({
  open,
  onClose,
  dock,
  targetGrams,
}: DockSimulatorSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Dock: simulate"
      description="No hardware nearby? Drive the scale and the burner by hand."
      footer={
        <Button fullWidth size="lg" variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <p className="text-[12px] font-semibold tracking-wide text-text-2 uppercase">
        Weight
      </p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {ADDITIONS.map((g) => (
          <Button
            key={g}
            variant="secondary"
            size="md"
            className="min-w-0 px-2"
            onClick={() => dock.simulateAdd(g)}
          >
            {g >= 1000 ? `+${g / 1000}kg` : `+${g}g`}
          </Button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="soft"
          size="md"
          disabled={!targetGrams}
          onClick={() => {
            if (targetGrams) dock.simulateAdd(targetGrams - dock.weightG);
          }}
        >
          Place exact target
        </Button>
        <Button variant="secondary" size="md" onClick={() => dock.simulateAdd(-50)}>
          − 50 g
        </Button>
      </div>

      <Button
        variant="ghost"
        size="md"
        fullWidth
        className="mt-1"
        onClick={dock.tare}
      >
        Tare (zero the pan)
      </Button>

      <p className="mt-5 text-[12px] font-semibold tracking-wide text-text-2 uppercase">
        Burner
      </p>
      <SegmentedControl
        className="mt-2"
        size="sm"
        label="Burner level"
        options={BURNERS}
        value={String(dock.burner)}
        onChange={(v) => dock.setBurner(Number(v) as BurnerLevel)}
      />
      <p className="mt-2 mb-2 text-[12px] text-text-2">
        Pan reads{" "}
        <span className="font-semibold text-text tabular-nums">
          {Math.max(0, dock.weightG).toFixed(1)} g
        </span>
        {dock.tempC !== undefined && (
          <>
            {" · "}
            <span className="font-semibold text-text tabular-nums">
              {Math.round(dock.tempC)}°C
            </span>
          </>
        )}
      </p>
    </Sheet>
  );
}

"use client";

import { Minus, Plus } from "lucide-react";
import { clamp, cn } from "@/lib/utils";

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Suffix after the value, e.g. `"g"` or `"servings"`. */
  unit?: string;
  /** Accessible name for the whole control, e.g. "Servings". */
  label: string;
  /** Visible label rendered to the left of the control. */
  showLabel?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Numeric − / + control used for servings, quantities and default portions. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  unit,
  label,
  showLabel = false,
  disabled,
  className,
}: StepperProps) {
  const set = (next: number) => {
    const clamped = clamp(Number(next.toFixed(4)), min, max);
    if (clamped !== value) onChange(clamped);
  };

  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-text " +
    "transition-transform duration-150 active:scale-[0.92] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
    "disabled:opacity-40 disabled:pointer-events-none";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showLabel && <span className="text-[14px] text-text-2">{label}</span>}
      <div
        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1"
        role="group"
        aria-label={label}
      >
        <button
          type="button"
          className={btn}
          onClick={() => set(value - step)}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label}`}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <output
          className="min-w-[56px] text-center text-[15px] font-semibold text-text tabular-nums"
          aria-live="polite"
        >
          {value}
          {unit && <span className="ml-0.5 text-xs font-medium text-text-2">{unit}</span>}
        </output>
        <button
          type="button"
          className={btn}
          onClick={() => set(value + step)}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label}`}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: ReactNode;
  /** Rendered on the right of the label row. Defaults to the raw value. */
  valueLabel?: ReactNode;
  /** Small captions under the track ends, e.g. "Mild" / "Very hot". */
  minLabel?: ReactNode;
  maxLabel?: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Accessible name when `label` is not plain text. */
  "aria-label"?: string;
}

/** Range input with the primary accent colour plus label / value display. */
export function Slider({
  value,
  onChange,
  min = 1,
  max = 5,
  step = 1,
  label,
  valueLabel,
  minLabel,
  maxLabel,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SliderProps) {
  const id = useId();

  return (
    <div className={cn("w-full", className)}>
      {(label != null || valueLabel != null) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-[13px] font-medium text-text-2">
            {label}
          </label>
          <span className="text-[15px] font-semibold text-text">
            {valueLabel ?? value}
          </span>
        </div>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "h-6 w-full cursor-pointer accent-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-full",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      />
      {(minLabel != null || maxLabel != null) && (
        <div className="flex items-center justify-between text-[11px] text-text-3">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

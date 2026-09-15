"use client";

import { cn } from "@/lib/utils";

export interface WeightReadoutProps {
  grams: number;
  /** Pulses while the scale has not settled. */
  stable?: boolean;
  /** `lg` = the 48 px verify readout, `md` = the live dock card. */
  size?: "md" | "lg";
  /** Render in white (on the dark live card). */
  inverted?: boolean;
  className?: string;
}

/** Big live weight, e.g. "100.2 g". */
export function WeightReadout({
  grams,
  stable = true,
  size = "lg",
  inverted,
  className,
}: WeightReadoutProps) {
  const value = Math.max(0, grams);

  return (
    <p
      aria-live="polite"
      className={cn(
        "leading-none font-bold tabular-nums",
        size === "lg" ? "text-[48px]" : "text-[32px]",
        inverted ? "text-primary-fg" : "text-text",
        !stable && "pulse",
        className,
      )}
    >
      {value.toFixed(1)}
      <span
        className={cn(
          "ml-1 font-semibold",
          size === "lg" ? "text-[20px]" : "text-[15px]",
          inverted ? "text-primary-fg/70" : "text-text-2",
        )}
      >
        g
      </span>
    </p>
  );
}

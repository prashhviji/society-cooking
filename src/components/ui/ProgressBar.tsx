import type { ReactNode } from "react";
import { clamp, cn } from "@/lib/utils";

export type ProgressTone = "green" | "orange" | "amber" | "auto";

const FILLS: Record<Exclude<ProgressTone, "auto">, string> = {
  green: "bg-green-500",
  orange: "bg-orange-600",
  amber: "bg-amber-600",
};

/** `auto` tone: orange under 40 %, amber under 60 %, green above. */
export function progressTone(value: number): Exclude<ProgressTone, "auto"> {
  if (value < 40) return "orange";
  if (value < 60) return "amber";
  return "green";
}

export interface ProgressBarProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  /** Track height in pixels. Defaults to 8. */
  height?: 6 | 8;
  tone?: ProgressTone;
  /** Caption shown above the bar on the left. */
  label?: ReactNode;
  /** Caption shown above the bar on the right, e.g. `"92%"`. */
  rightLabel?: ReactNode;
  className?: string;
  /** Accessible name when no visible `label` is given. */
  "aria-label"?: string;
}

/** Rounded progress track with an animated fill. */
export function ProgressBar({
  value,
  height = 8,
  tone = "green",
  label,
  rightLabel,
  className,
  "aria-label": ariaLabel,
}: ProgressBarProps) {
  const pct = clamp(Math.round(value), 0, 100);
  const fill = FILLS[tone === "auto" ? progressTone(pct) : tone];

  return (
    <div className={cn("w-full", className)}>
      {(label || rightLabel) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="min-w-0 truncate text-text-2">{label}</span>
          {rightLabel && (
            <span className="shrink-0 font-semibold text-text">{rightLabel}</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        className="track w-full"
        style={{ height }}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", fill)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

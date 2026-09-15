"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  /** Optional leading icon, rendered `aria-hidden`. */
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group, e.g. "Spice level". */
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Track of mutually exclusive options with a white selected pill — used for
 * Scan / Dock / Receipt / Manual and the feedback scales.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex w-full items-stretch gap-1 rounded-xl bg-surface-2 p-1",
        className,
      )}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg font-medium",
              "transition-[background-color,color,box-shadow] duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              "disabled:pointer-events-none disabled:opacity-40",
              size === "sm" ? "h-8 px-2 text-[12px]" : "h-10 px-3 text-[13px]",
              selected
                ? "bg-surface text-text shadow-card"
                : "bg-transparent text-text-2",
            )}
          >
            {o.icon && (
              <span aria-hidden="true" className="shrink-0">
                {o.icon}
              </span>
            )}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name; also rendered when `showLabel` is set. */
  label: string;
  showLabel?: boolean;
  /** Muted second line, only shown with `showLabel`. */
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** Switch for boolean settings (sync, notifications, simulator mode). */
export function Toggle({
  checked,
  onChange,
  label,
  showLabel = false,
  description,
  disabled,
  className,
}: ToggleProps) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:pointer-events-none disabled:opacity-50",
        checked ? "bg-primary" : "bg-surface-2 border border-border",
        !showLabel && className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-surface shadow-card transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );

  if (!showLabel) return control;

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-text">{label}</span>
        {description != null && (
          <span className="mt-0.5 block text-xs text-text-2">{description}</span>
        )}
      </span>
      {control}
    </div>
  );
}

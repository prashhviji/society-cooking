"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StarRatingProps {
  /** 0 = nothing chosen yet. */
  value: number;
  onChange(value: 1 | 2 | 3 | 4 | 5): void;
  /** Accessible name for the group, e.g. "Overall". */
  label: string;
  className?: string;
}

const STARS: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

/** Five 44 px tap targets. */
export function StarRating({ value, onChange, label, className }: StarRatingProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex items-center gap-1", className)}
    >
      {STARS.map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5`}
            onClick={() => onChange(n)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-150 active:scale-[0.9] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <Star
              size={28}
              aria-hidden="true"
              className={cn(
                filled ? "fill-amber-600 text-amber-600" : "text-border",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

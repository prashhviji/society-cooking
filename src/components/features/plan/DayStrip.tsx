"use client";

import { format } from "date-fns";
import { Check } from "lucide-react";
import type { ISODate } from "@/lib/types";
import { addDays, cn, parseISODate, toISODate } from "@/lib/utils";

export interface DayStripProps {
  /** Monday of the displayed week. */
  weekStart: ISODate;
  selected: ISODate;
  onSelect: (date: ISODate) => void;
  /** Dates whose meals are all cooked — they get a tiny green check. */
  completed?: ReadonlySet<ISODate>;
  /** Overridable for tests; defaults to the real today. */
  today?: ISODate;
  className?: string;
}

/** Seven day squares (Mon…Sun); the selected one is a filled primary tile. */
export function DayStrip({
  weekStart,
  selected,
  onSelect,
  completed,
  today = toISODate(),
  className,
}: DayStripProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className={cn("grid grid-cols-7 gap-1", className)}>
      {days.map((date) => {
        const d = parseISODate(date);
        const isSelected = date === selected;
        const isToday = date === today;
        const done = completed?.has(date) ?? false;

        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
            aria-pressed={isSelected}
            aria-label={format(d, "EEEE d MMMM")}
            className={cn(
              "relative flex h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl",
              "transition-colors duration-150 active:scale-[0.97]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-primary text-primary-fg"
                : "bg-surface text-text border border-border",
            )}
          >
            <span
              className={cn(
                "text-[10px] leading-none font-medium",
                isSelected ? "text-primary-fg/80" : "text-text-3",
              )}
            >
              {format(d, "EEEEE")}
            </span>
            <span className="text-[15px] leading-none font-semibold">
              {format(d, "d")}
            </span>
            {isToday && (
              <span
                aria-hidden="true"
                className={cn(
                  "h-1 w-1 rounded-full",
                  isSelected ? "bg-primary-fg" : "bg-primary",
                )}
              />
            )}
            {!isToday && <span aria-hidden="true" className="h-1" />}
            {done && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full",
                  isSelected ? "bg-primary-fg text-primary" : "bg-green-100 text-green-700",
                )}
              >
                <Check size={9} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

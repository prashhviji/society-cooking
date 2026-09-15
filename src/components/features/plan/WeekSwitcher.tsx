"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui";
import type { ISODate } from "@/lib/types";
import { addDays, cn, parseISODate } from "@/lib/utils";

export interface WeekSwitcherProps {
  /** Monday of the displayed week. */
  weekStart: ISODate;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

/** "Aug 25 – Aug 31" for the week starting at `weekStart`. */
export function weekRangeLabel(weekStart: ISODate): string {
  const from = parseISODate(weekStart);
  const to = parseISODate(addDays(weekStart, 6));
  return `${format(from, "MMM d")} – ${format(to, "MMM d")}`;
}

/** `<` week range `>` — the row above the day strip on the plan screen. */
export function WeekSwitcher({
  weekStart,
  onPrev,
  onNext,
  className,
}: WeekSwitcherProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <IconButton aria-label="Previous week" size={40} onClick={onPrev}>
        <ChevronLeft size={20} />
      </IconButton>
      <p className="min-w-0 truncate text-[15px] font-semibold text-primary">
        {weekRangeLabel(weekStart)}
      </p>
      <IconButton aria-label="Next week" size={40} onClick={onNext}>
        <ChevronRight size={20} />
      </IconButton>
    </div>
  );
}

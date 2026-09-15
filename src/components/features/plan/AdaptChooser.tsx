"use client";

import { Smile, Timer, Users, UtensilsCrossed, X } from "lucide-react";
import type { ReactNode } from "react";
import type { ScheduleChangeType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChoiceSpec {
  type: ScheduleChangeType;
  label: string;
  caption: string;
  icon: ReactNode;
}

export const ADAPT_CHOICES: ChoiceSpec[] = [
  {
    type: "less_time",
    label: "Less time today",
    caption: "Swap in quicker recipes",
    icon: <Timer size={20} />,
  },
  {
    type: "guests",
    label: "Guests coming",
    caption: "Scale portions up",
    icon: <Users size={20} />,
  },
  {
    type: "eating_out",
    label: "Eating out",
    caption: "Skip cooking for one meal",
    icon: <UtensilsCrossed size={20} />,
  },
  {
    type: "mood_change",
    label: "Change of mood",
    caption: "Something lighter, spicier…",
    icon: <Smile size={20} />,
  },
  {
    type: "skip_meal",
    label: "Skip a meal",
    caption: "Remove it from the plan",
    icon: <X size={20} />,
  },
];

export interface AdaptChooserProps {
  value: ScheduleChangeType | null;
  onSelect: (type: ScheduleChangeType) => void;
  /** Inline inputs rendered inside the selected card. */
  children?: ReactNode;
}

/** Five change cards; the selected one expands to show its inputs. */
export function AdaptChooser({ value, onSelect, children }: AdaptChooserProps) {
  return (
    <div className="flex flex-col gap-2">
      {ADAPT_CHOICES.map((choice) => {
        const selected = value === choice.type;
        return (
          <div
            key={choice.type}
            className={cn(
              "overflow-hidden rounded-2xl border bg-surface transition-colors",
              selected ? "border-primary shadow-card" : "border-border",
            )}
          >
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(choice.type)}
              className="flex w-full min-h-[64px] items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  selected
                    ? "bg-primary text-primary-fg"
                    : "bg-surface-2 text-text-2",
                )}
              >
                {choice.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-text">
                  {choice.label}
                </span>
                <span className="block truncate text-xs text-text-2">
                  {choice.caption}
                </span>
              </span>
            </button>

            {selected && children && (
              <div className="border-t border-border px-3 pt-3 pb-4">{children}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import type { Priority } from "@/lib/types";
import { PRIORITY_OPTIONS } from "../options";
import { OptionCard, StepSection, type StepProps } from "./common";

/**
 * Step 7 — tap-to-rank list. Tapping an unranked row gives it the next free
 * rank; tapping a ranked row releases it and closes the gap.
 */
export function StepPriorities({ draft, onChange }: StepProps) {
  const order: Priority[] = draft.priorities ?? [];
  const ranked = order.length;

  function tap(value: Priority) {
    onChange({
      priorities: order.includes(value)
        ? order.filter((p) => p !== value)
        : [...order, value],
    });
  }

  return (
    <div className="space-y-4">
      <StepSection
        title="What matters most?"
        hint="Tap them in order — 1 is the most important. Tap a ranked item to release it."
        action={
          ranked > 0 ? (
            <button
              type="button"
              onClick={() => onChange({ priorities: [] })}
              className="rounded-md px-1 py-0.5 text-[13px] font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              Reset order
            </button>
          ) : null
        }
      >
        <div className="space-y-2">
          {PRIORITY_OPTIONS.map((o) => {
            const rank = order.indexOf(o.value);
            const selected = rank >= 0;
            return (
              <OptionCard
                key={o.value}
                label={o.label}
                emoji={o.emoji}
                description={o.description}
                selected={selected}
                onSelect={() => tap(o.value)}
                badge={
                  <span
                    aria-hidden="true"
                    className={
                      selected
                        ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-fg"
                        : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[13px] font-semibold text-text-3"
                    }
                  >
                    {selected ? rank + 1 : "–"}
                  </span>
                }
              />
            );
          })}
        </div>
      </StepSection>

      <p className="text-xs leading-relaxed text-text-3">
        {ranked === PRIORITY_OPTIONS.length
          ? "All five ranked. You can change this any time from your profile."
          : `${ranked} of ${PRIORITY_OPTIONS.length} ranked — we'll fill the rest in our default order.`}
      </p>
    </div>
  );
}

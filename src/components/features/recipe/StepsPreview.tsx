"use client";

import { ChevronDown, Lightbulb } from "lucide-react";
import { useState } from "react";
import type { RecipeStep } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface StepsPreviewProps {
  steps: RecipeStep[];
}

function durationLabel(sec: number | undefined): string | null {
  if (!sec) return null;
  if (sec < 60) return `${sec} sec`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}

/** Collapsed numbered steps; tapping a row reveals its instruction and tip. */
export function StepsPreview({ steps }: StepsPreviewProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const ordered = [...steps].sort((a, b) => a.order - b.order);

  return (
    <ul className="rounded-2xl border border-border bg-surface px-3">
      {ordered.map((step, i) => {
        const open = openId === step.id;
        const duration = durationLabel(step.durationSec);
        return (
          <li
            key={step.id}
            className={cn(i < ordered.length - 1 && "border-b border-border")}
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : step.id)}
              aria-expanded={open}
              className="flex min-h-[52px] w-full items-center gap-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-[13px] font-bold text-primary"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-text">
                  {step.title}
                </span>
                {duration && !open && (
                  <span className="mt-0.5 block text-[11px] text-text-3">{duration}</span>
                )}
              </span>
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={cn(
                  "shrink-0 text-text-3 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </button>

            {open && (
              <div className="fade-up pb-3 pl-10">
                <p className="text-[13px] leading-relaxed text-text-2">
                  {step.instruction}
                </p>
                {duration && (
                  <p className="mt-1 text-[11px] text-text-3">Takes about {duration}</p>
                )}
                {step.tip && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-green-50 px-2.5 py-2 text-[12px] leading-relaxed text-green-700">
                    <Lightbulb size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                    {step.tip}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

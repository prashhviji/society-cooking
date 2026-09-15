"use client";

import { Flame } from "lucide-react";
import { Card, Chip, type ChipTone } from "@/components/ui";
import { liveRetentionHint } from "@/lib/engines/retention";
import type { RecipeStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { temperatureBand } from "./weight";

export interface TemperatureCardProps {
  step: RecipeStep;
  /** Live pan temperature from the dock. */
  tempC: number | undefined;
  elapsedSec: number;
}

/** Pan Temperature card with the live retention coaching note. */
export function TemperatureCard({ step, tempC, elapsedSec }: TemperatureCardProps) {
  const hint = liveRetentionHint(step, tempC, elapsedSec);
  const range = step.targetTempC;

  let chipLabel = "Good range";
  let chipTone: ChipTone = "green";
  if (tempC === undefined) {
    chipLabel = "No reading";
    chipTone = "neutral";
  } else if (range && tempC > range.max + 20) {
    chipLabel = "Too hot";
    chipTone = "orange";
  } else if (range && tempC > range.max) {
    chipLabel = "Slightly hot";
    chipTone = "amber";
  } else if (range && tempC < range.min) {
    chipLabel = "Warming up";
    chipTone = "neutral";
  }

  const value =
    tempC === undefined
      ? "—"
      : `${temperatureBand(tempC)} (${Math.round(tempC)}°C)`;

  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600"
        >
          <Flame size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-text-2">Pan Temperature</p>
          <p className="truncate text-[17px] leading-tight font-bold text-text tabular-nums">
            {value}
          </p>
        </div>
        <Chip tone={chipTone}>{chipLabel}</Chip>
      </div>

      <p
        className={cn(
          "mt-3 rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed",
          hint.tone === "ok"
            ? "bg-green-50 text-green-700"
            : "bg-orange-50 text-orange-600",
        )}
      >
        {hint.message}
      </p>
    </Card>
  );
}

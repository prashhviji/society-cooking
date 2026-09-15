"use client";

import { Check } from "lucide-react";
import { Chip } from "@/components/ui";
import { WeightReadout } from "./WeightReadout";
import { weightStatus } from "./weight";

export interface LiveDockCardProps {
  weightG: number;
  stable: boolean;
  /** Grams this step asks for; the pan is tared when the step starts. */
  targetGrams: number;
  /** "Add onions and cook" — used for the accessible label. */
  caption?: string;
}

/**
 * The dark "live from the sensor dock" panel from the mockup: current weight,
 * a check once the amount is inside ±10 % and the coaching chip underneath.
 */
export function LiveDockCard({
  weightG,
  stable,
  targetGrams,
  caption,
}: LiveDockCardProps) {
  const status = weightStatus(weightG, targetGrams);

  return (
    <div>
      <div className="relative h-[200px] w-full overflow-hidden rounded-2xl bg-green-900">
        <span
          aria-hidden="true"
          className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-green-600/40 blur-3xl"
        />
        <span
          aria-hidden="true"
          className="absolute -right-16 -bottom-20 h-56 w-56 rounded-full bg-green-500/20 blur-3xl"
        />

        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-green-800/80 px-2.5 py-1 text-[11px] font-medium text-primary-fg">
          <span
            aria-hidden="true"
            className="pulse h-1.5 w-1.5 rounded-full bg-green-500"
          />
          Live from sensor dock
        </span>

        <div className="absolute bottom-4 left-4">
          <p className="mb-1 text-[11px] text-primary-fg/70">
            {caption ?? "On the dock"} · target{" "}
            <span className="tabular-nums">{Math.round(targetGrams)} g</span>
          </p>
          <WeightReadout grams={weightG} stable={stable} size="md" inverted />
        </div>

        {status.within && (
          <span className="fade-up absolute right-4 bottom-4 flex h-11 w-11 items-center justify-center rounded-full bg-green-500 text-primary-fg">
            <Check size={22} aria-hidden="true" />
            <span className="sr-only">Amount reached</span>
          </span>
        )}
      </div>

      <div className="mt-2">
        <Chip
          tone={status.tone}
          icon={status.within ? <Check size={12} /> : undefined}
        >
          {status.label}
        </Chip>
      </div>
    </div>
  );
}

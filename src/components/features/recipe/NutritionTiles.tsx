"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { NutritionPerServing } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Macro {
  label: string;
  value: number;
  unit: string;
}

interface Micro {
  label: string;
  value: number | undefined;
  unit: string;
  decimals?: number;
}

export interface NutritionTilesProps {
  nutrition: NutritionPerServing;
}

function format(value: number, decimals = 0): string {
  const rounded = Number(value.toFixed(decimals));
  return `${rounded}`;
}

/** The 4 macro tiles plus a collapsible list of the micronutrients present. */
export function NutritionTiles({ nutrition }: NutritionTilesProps) {
  const [open, setOpen] = useState(false);

  const macros: Macro[] = [
    { label: "Protein", value: nutrition.proteinG, unit: "g" },
    { label: "Carbs", value: nutrition.carbsG, unit: "g" },
    { label: "Fats", value: nutrition.fatG, unit: "g" },
    { label: "Fiber", value: nutrition.fiberG, unit: "g" },
  ];

  const micros: Micro[] = [
    { label: "Vitamin C", value: nutrition.vitaminCMg, unit: "mg", decimals: 1 },
    { label: "Vitamin B6", value: nutrition.vitaminB6Mg, unit: "mg", decimals: 2 },
    { label: "Folate", value: nutrition.folateUg, unit: "µg" },
    { label: "Vitamin A", value: nutrition.vitaminAUg, unit: "µg" },
    { label: "Iron", value: nutrition.ironMg, unit: "mg", decimals: 1 },
    { label: "Calcium", value: nutrition.calciumMg, unit: "mg" },
  ].filter((m) => typeof m.value === "number" && m.value > 0);

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {macros.map((m) => (
          <div
            key={m.label}
            className="rounded-xl bg-surface-2 px-1.5 py-2.5 text-center"
          >
            <div className="text-[15px] leading-tight font-bold text-text tabular-nums">
              {format(m.value)}
              <span className="text-[11px] font-semibold text-text-2">{m.unit}</span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-text-2">{m.label}</div>
          </div>
        ))}
      </div>

      {micros.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-[13px] font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            {open ? "Less" : "More"}
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={cn("transition-transform duration-200", open && "rotate-180")}
            />
          </button>

          {open && (
            <ul className="fade-up mt-1 rounded-xl border border-border bg-surface px-3">
              {micros.map((m, i) => (
                <li
                  key={m.label}
                  className={cn(
                    "flex items-center justify-between py-2.5 text-[13px]",
                    i < micros.length - 1 && "border-b border-border",
                  )}
                >
                  <span className="text-text-2">{m.label}</span>
                  <span className="font-semibold text-text tabular-nums">
                    {format(m.value ?? 0, m.decimals)} {m.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

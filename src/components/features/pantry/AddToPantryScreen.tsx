"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { AppHeader, Page } from "@/components/layout";
import { SegmentedControl, Skeleton, type SegmentedOption } from "@/components/ui";
import { useHydrated } from "@/lib/data/storage";
import { DockTab } from "./DockTab";
import { ManualTab } from "./ManualTab";
import { ReceiptTab } from "./ReceiptTab";
import { ScanTab } from "./ScanTab";

export type AddMode = "scan" | "dock" | "receipt" | "manual";

const MODES: AddMode[] = ["scan", "dock", "receipt", "manual"];

// No icons: four labels plus glyphs do not fit a 360 px track without truncating.
const OPTIONS: SegmentedOption<AddMode>[] = [
  { value: "scan", label: "Scan" },
  { value: "dock", label: "Dock" },
  { value: "receipt", label: "Receipt" },
  { value: "manual", label: "Manual" },
];

const HINTS: Record<AddMode, string> = {
  scan: "Snap one ingredient — Gemini names it and estimates the weight.",
  dock: "Place it on the sensor dock and snap it: name from the camera, grams from the scale.",
  receipt: "Photograph a grocery bill to add every line at once.",
  manual: "Search the catalog and type the quantity yourself.",
};

function isMode(value: string | null): value is AddMode {
  return value != null && (MODES as string[]).includes(value);
}

function AddSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
      <Skeleton className="h-11 rounded-full" />
    </div>
  );
}

/** Add to Pantry (`/pantry/add`) — Scan · Dock · Receipt · Manual. SCREENS §13. */
export function AddToPantryScreen() {
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  // `?mode=` only seeds the initial tab; switching tabs rewrites the query so a
  // refresh (or a shared link) lands on the same tab.
  const initial = params.get("mode");
  const [mode, setMode] = useState<AddMode>(isMode(initial) ? initial : "manual");

  const change = useCallback(
    (next: AddMode) => {
      setMode(next);
      router.replace(`/pantry/add?mode=${next}`, { scroll: false });
    },
    [router],
  );

  return (
    <>
      <AppHeader back title="Add to Pantry" />
      <Page>
        {!hydrated ? (
          <AddSkeleton />
        ) : (
          <div className="space-y-4">
            <SegmentedControl<AddMode>
              label="How would you like to add items?"
              options={OPTIONS}
              value={mode}
              onChange={change}
            />
            <p className="text-[12px] leading-relaxed text-text-2">{HINTS[mode]}</p>

            {mode === "scan" && <ScanTab />}
            {mode === "dock" && <DockTab />}
            {mode === "receipt" && <ReceiptTab />}
            {mode === "manual" && <ManualTab />}
          </div>
        )}
      </Page>
    </>
  );
}

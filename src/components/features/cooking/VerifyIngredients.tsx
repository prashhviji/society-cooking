"use client";

import { ArrowRight, Camera, Check, RotateCcw, Sliders, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Page, StickyFooter } from "@/components/layout";
import {
  Button,
  Card,
  Chip,
  EmojiTile,
  Input,
  ProgressBar,
  Sheet,
  useToast,
} from "@/components/ui";
import { ingredientById, INGREDIENTS } from "@/lib/data/seed/ingredients";
import { useCookStore } from "@/lib/data/stores";
import { aiIdentify, type CatalogEntry } from "@/lib/ai/client";
import type { CookSession, IdentifyIngredientResult, Recipe } from "@/lib/types";
import { cn, nowIso } from "@/lib/utils";
import { CameraCapture } from "./CameraCapture";
import { DockSimulatorSheet } from "./DockSimulatorSheet";
import { WeightReadout } from "./WeightReadout";
import { weightStatus, WEIGHT_TOLERANCE } from "./weight";
import type { SensorDockState } from "./useSensorDock";

export interface VerifyIngredientsProps {
  recipe: Recipe;
  session: CookSession;
  dock: SensorDockState;
  /** Starts the first step (moves the session to "cooking"). */
  onStartCooking(): void;
}

interface Row {
  ingredientId: string;
  name: string;
  prep?: string;
  emoji: string;
  targetGrams: number;
}

/** Phase A — weigh every ingredient on the dock before the heat goes on. */
export function VerifyIngredients({
  recipe,
  session,
  dock,
  onStartCooking,
}: VerifyIngredientsProps) {
  const { toast } = useToast();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [identified, setIdentified] = useState<IdentifyIngredientResult | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const factor = recipe.servings > 0 ? session.servings / recipe.servings : 1;

  const rows: Row[] = useMemo(
    () =>
      recipe.ingredients.map((ri) => ({
        ingredientId: ri.ingredientId,
        name: ri.name,
        prep: ri.prep,
        emoji: ingredientById(ri.ingredientId)?.emoji ?? "🥄",
        targetGrams: Math.round(ri.grams * factor * 10) / 10,
      })),
    [recipe, factor],
  );

  const catalog: CatalogEntry[] = useMemo(
    () => INGREDIENTS.map((i) => ({ id: i.id, name: i.name })),
    [],
  );

  const logged = useMemo(
    () => new Map(session.ingredientLogs.map((l) => [l.ingredientId, l])),
    [session.ingredientLogs],
  );

  const verifiedCount = rows.filter((r) => logged.has(r.ingredientId)).length;
  const current = rows.find((r) => !logged.has(r.ingredientId));
  const allVerified = !current;

  const status = weightStatus(dock.weightG, current?.targetGrams ?? 0);
  const mismatch =
    identified && current
      ? identified.ingredientId
        ? identified.ingredientId !== current.ingredientId
        : !identified.name.toLowerCase().includes(current.name.toLowerCase())
      : false;

  const commit = (
    row: Row,
    actualGrams: number,
    verifiedBy: "scale" | "camera_scale" | "manual",
  ) => {
    useCookStore.getState().logIngredient({
      ingredientId: row.ingredientId,
      targetGrams: row.targetGrams,
      actualGrams: Math.max(0, Math.round(actualGrams * 10) / 10),
      verifiedBy,
      identifiedAs: verifiedBy === "camera_scale" ? identified?.name : undefined,
      confidence: verifiedBy === "camera_scale" ? identified?.confidence : undefined,
      ts: nowIso(),
    });
    setIdentified(null);
    // Zero the pan so the next ingredient is measured on its own.
    dock.tare();
  };

  const onCapture = async (blob: Blob) => {
    setIdentifying(true);
    const result = await aiIdentify(blob, catalog);
    setIdentifying(false);
    setCameraOpen(false);
    if (result.ok) {
      setIdentified(result.data);
      return;
    }
    toast({
      title: "Could not identify that photo",
      description: `${result.reason}. Confirm with the scale instead.`,
      tone: "warning",
    });
  };

  return (
    <>
      <Page noNav>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[16px] font-semibold text-text">Verify ingredients</h2>
          <span className="text-[13px] font-semibold text-primary tabular-nums">
            {verifiedCount} of {rows.length} verified
          </span>
        </div>
        <ProgressBar
          className="mt-2"
          value={rows.length ? (verifiedCount / rows.length) * 100 : 0}
          height={6}
          aria-label="Ingredients verified"
        />

        {current && (
          <Card className="fade-up mt-4" padding="md">
            <p className="text-[15px] text-text-2">
              Place <span className="font-bold text-text">{current.name}</span> on the dock
            </p>

            <div className="mt-4 flex items-center gap-4">
              <EmojiTile emoji={current.emoji} size={56} tone="green" />
              <div className="min-w-0 flex-1">
                <WeightReadout grams={dock.weightG} stable={dock.stable} />
                <p className="mt-1.5 text-[12px] text-text-2">
                  Target{" "}
                  <span className="font-semibold text-text tabular-nums">
                    {current.targetGrams} g
                  </span>{" "}
                  · tolerance ±{Math.round(WEIGHT_TOLERANCE * 100)} %
                </p>
              </div>
            </div>

            <ProgressBar
              className="mt-3"
              value={Math.min(100, status.percent)}
              tone={status.barTone}
              aria-label="Weight against target"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip tone={status.tone} icon={status.within ? <Check size={12} /> : undefined}>
                {status.label}
              </Chip>
              {dock.simulated && (
                <button
                  type="button"
                  onClick={() => setSimulatorOpen(true)}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full px-1 text-[12px] font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                >
                  <Sliders size={13} aria-hidden="true" />
                  Dock: simulate
                </button>
              )}
            </div>

            {identified && (
              <div
                className={cn(
                  "fade-up mt-3 rounded-xl px-3 py-2.5 text-[13px]",
                  mismatch
                    ? "bg-orange-50 text-orange-600"
                    : "bg-green-50 text-green-700",
                )}
              >
                <p className="flex items-center gap-1.5 font-semibold">
                  {mismatch && <TriangleAlert size={14} aria-hidden="true" />}
                  Identified: {identified.name} · {Math.round(identified.confidence * 100)} %
                </p>
                {mismatch && (
                  <p className="mt-0.5 leading-relaxed">
                    That does not look like {current.name}. Check the pan before you confirm.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="md"
                className="min-w-0 px-2"
                leftIcon={<RotateCcw size={16} />}
                onClick={dock.tare}
              >
                Tare
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="min-w-0 px-2"
                leftIcon={<Camera size={16} />}
                loading={identifying}
                onClick={() => setCameraOpen(true)}
              >
                Camera
              </Button>
            </div>
            <Button
              size="md"
              fullWidth
              className="mt-2"
              leftIcon={<Check size={16} />}
              onClick={() =>
                commit(current, dock.weightG, identified ? "camera_scale" : "scale")
              }
            >
              Confirm
            </Button>

            <Button
              variant="ghost"
              size="sm"
              fullWidth
              className="mt-2"
              onClick={() => {
                setManualValue(String(current.targetGrams));
                setManualOpen(true);
              }}
            >
              Skip / enter manually
            </Button>
          </Card>
        )}

        <ul className="mt-4">
          {rows.map((row) => {
            const log = logged.get(row.ingredientId);
            const isCurrent = current?.ingredientId === row.ingredientId;
            return (
              <li
                key={row.ingredientId}
                className={cn(
                  "flex min-h-[52px] items-center gap-3 border-b border-border py-2",
                  isCurrent && "opacity-100",
                  !log && !isCurrent && "opacity-55",
                )}
              >
                <EmojiTile
                  emoji={row.emoji}
                  size={40}
                  tone={log ? "green" : "neutral"}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-text">
                    {row.name}
                  </span>
                  <span className="block truncate text-[12px] text-text-2">
                    {log
                      ? `${log.actualGrams} g logged${
                          log.verifiedBy === "manual" ? " (manual)" : ""
                        }`
                      : `${row.targetGrams} g${row.prep ? ` · ${row.prep}` : ""}`}
                  </span>
                </span>
                {log ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <Check size={14} aria-hidden="true" />
                    <span className="sr-only">Verified</span>
                  </span>
                ) : (
                  <span className="h-6 w-6 rounded-full border border-border" />
                )}
              </li>
            );
          })}
        </ul>
      </Page>

      <StickyFooter>
        <Button
          fullWidth
          size="lg"
          disabled={!allVerified}
          rightIcon={<ArrowRight size={18} />}
          onClick={onStartCooking}
        >
          {allVerified
            ? "Start cooking"
            : `${rows.length - verifiedCount} ingredient${
                rows.length - verifiedCount === 1 ? "" : "s"
              } left`}
        </Button>
      </StickyFooter>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(blob) => void onCapture(blob)}
        busy={identifying}
        title={current ? `Check the ${current.name}` : "Check the pan"}
        description="Point the camera at the dock and capture."
      />

      <DockSimulatorSheet
        open={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        dock={dock}
        targetGrams={current?.targetGrams}
      />

      <Sheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Enter the amount"
        description={current ? `How much ${current.name} went in?` : undefined}
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => {
                if (current) commit(current, current.targetGrams, "manual");
                setManualOpen(false);
              }}
            >
              Use recipe amount
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                const grams = Number(manualValue);
                if (current && Number.isFinite(grams) && grams >= 0) {
                  commit(current, grams, "manual");
                }
                setManualOpen(false);
              }}
            >
              Log it
            </Button>
          </div>
        }
      >
        <Input
          label="Weight"
          type="number"
          inputMode="decimal"
          min={0}
          step={1}
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
          rightSlot={<span className="text-[13px] text-text-2">g</span>}
        />
      </Sheet>
    </>
  );
}

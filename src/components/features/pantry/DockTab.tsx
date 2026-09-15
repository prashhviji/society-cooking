"use client";

import { Scale, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Chip, EmojiTile, Spinner, useToast } from "@/components/ui";
import { aiIdentify } from "@/lib/ai/client";
import { ingredientById } from "@/lib/data/seed/ingredients";
import { usePantryStore } from "@/lib/data/stores";
import {
  createSensorDock,
  isSimulatedDock,
  type SensorDock,
} from "@/lib/engines/sensor";
import type { IdentifyIngredientResult, Ingredient, SensorReading } from "@/lib/types";
import { cn, formatQuantity } from "@/lib/utils";
import { CameraCapture } from "./CameraCapture";
import { CATALOG, matchIngredientByName, quantityFromGrams } from "./helpers";
import { IngredientPicker } from "./IngredientPicker";
import { draftFor, ItemFields, type Draft } from "./ItemFields";

type Phase = "idle" | "identifying" | "ready" | "fallback";

const SIMULATE_STEPS = [
  { grams: 1000, label: "1 kg" },
  { grams: 500, label: "500 g" },
  { grams: 100, label: "100 g" },
];

/**
 * Connects a simulated dock for the lifetime of the tab. The dock constructor
 * touches no browser API (only `connect()` starts a timer), so building it in a
 * `useState` initialiser is SSR-safe.
 */
function useDock() {
  const [dock] = useState<SensorDock>(() => createSensorDock("simulated"));
  const [reading, setReading] = useState<SensorReading | null>(null);

  useEffect(() => {
    const unsubscribe = dock.subscribe(setReading);
    void dock.connect();
    return () => {
      unsubscribe();
      dock.disconnect();
    };
  }, [dock]);

  return { dock, reading };
}

export function DockTab() {
  const { toast } = useToast();
  const { dock, reading } = useDock();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<IdentifyIngredientResult | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const weightG = Math.max(0, Math.round(reading?.weightG ?? 0));
  const stable = reading?.stable ?? true;

  function choose(ingredient: Ingredient) {
    const base = draftFor(ingredient, weightG > 0 ? weightG : undefined);
    setDraft(base);
  }

  async function identify(blob: Blob) {
    setPhase("identifying");
    setReason(null);
    setResult(null);
    setDraft(null);

    const res = await aiIdentify(blob, CATALOG);
    if (!res.ok) {
      setReason(res.reason);
      setPhase("fallback");
      return;
    }

    setResult(res.data);
    const match =
      (res.data.ingredientId ? ingredientById(res.data.ingredientId) : undefined) ??
      matchIngredientByName(res.data.name);
    if (match) {
      choose(match);
      setPhase("ready");
    } else {
      setReason(`“${res.data.name}” is not in the catalog yet.`);
      setPhase("fallback");
    }
  }

  function useScaleWeight() {
    if (!draft) return;
    const ingredient = ingredientById(draft.ingredientId);
    const { quantity, unit } = quantityFromGrams(ingredient, weightG);
    setDraft({ ...draft, quantity, unit });
  }

  function add() {
    if (!draft) return;
    const item = usePantryStore.getState().add({
      ingredientId: draft.ingredientId,
      quantity: draft.quantity,
      unit: draft.unit,
      expiresAt: draft.expiresAt,
      source: "sensor",
    });
    toast({
      title: `Added ${item.name} · ${formatQuantity(item.quantity, item.unit)}`,
      tone: "success",
    });
    setPhase("idle");
    setResult(null);
    setDraft(null);
  }

  const ingredient = draft ? ingredientById(draft.ingredientId) : undefined;
  const cameraName = ingredient?.name ?? result?.name;

  return (
    <div className="space-y-4">
      {/* Live scale readout */}
      <Card>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700"
          >
            <Scale size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-text-2">Sensor dock</p>
            <p
              className={cn(
                "text-[28px] leading-tight font-bold text-text tabular-nums",
                !stable && "pulse",
              )}
              aria-live="polite"
            >
              {weightG.toLocaleString("en-IN")}
              <span className="ml-1 text-[15px] font-semibold text-text-2">g</span>
            </p>
          </div>
          <Chip tone={stable ? "green" : "amber"} size="sm">
            {stable ? "Stable" : "Settling…"}
          </Chip>
        </div>

        {dock && isSimulatedDock(dock) && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-[12px] text-text-2">Simulate placing</p>
            <div className="flex flex-wrap gap-2">
              {SIMULATE_STEPS.map((s) => (
                <Button
                  key={s.grams}
                  size="sm"
                  variant="secondary"
                  onClick={() => dock.simulateAdd(s.grams)}
                >
                  {s.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => dock.tare()}>
                Tare
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CameraCapture
        onCapture={identify}
        busy={phase === "identifying"}
        captureLabel="Identify what's on the dock"
        idleHint="Place the ingredient on the dock, then capture"
      />

      {phase === "identifying" && (
        <Card padding="sm">
          <p className="flex items-center gap-2 text-[14px] text-text-2">
            <Spinner size={16} />
            Identifying…
          </p>
        </Card>
      )}

      {phase === "ready" && draft && ingredient && (
        <Card>
          <div className="flex items-center gap-3">
            <EmojiTile emoji={ingredient.emoji} size={56} tone="green" />
            <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-text-2">
              Camera says <span className="font-bold text-text">{cameraName}</span> ·
              scale reads{" "}
              <span className="font-bold text-text tabular-nums">
                {weightG.toLocaleString("en-IN")} g
              </span>
            </p>
          </div>

          {result && (
            <p className="mt-2 text-[12px] text-text-2">
              Confidence {Math.round(result.confidence * 100)} %
            </p>
          )}

          <ItemFields
            className="mt-4"
            draft={draft}
            onChange={(patch) => setDraft({ ...draft, ...patch })}
          />

          <div className="mt-3 flex gap-2">
            <Button variant="secondary" fullWidth onClick={useScaleWeight}>
              Use scale weight
            </Button>
            <Button fullWidth onClick={add}>
              Add to pantry
            </Button>
          </div>
        </Card>
      )}

      {phase === "fallback" && (
        <Card tone="orange">
          <p className="flex items-start gap-2 text-[14px] font-semibold text-orange-600">
            <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            AI unavailable — pick the ingredient manually
          </p>
          {reason && <p className="mt-1 text-[12px] text-text-2">{reason}</p>}

          {draft && ingredient ? (
            <>
              <p className="mt-3 text-[14px] text-text-2">
                Scale reads{" "}
                <span className="font-bold text-text tabular-nums">
                  {weightG.toLocaleString("en-IN")} g
                </span>{" "}
                for <span className="font-semibold text-text">{ingredient.name}</span>.
              </p>
              <ItemFields
                className="mt-3"
                draft={draft}
                onChange={(patch) => setDraft({ ...draft, ...patch })}
              />
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" fullWidth onClick={() => setDraft(null)}>
                  Change
                </Button>
                <Button fullWidth onClick={add}>
                  Add to pantry
                </Button>
              </div>
            </>
          ) : (
            <IngredientPicker
              className="mt-3"
              onSelect={choose}
              label="Search ingredients to add"
            />
          )}
        </Card>
      )}
    </div>
  );
}

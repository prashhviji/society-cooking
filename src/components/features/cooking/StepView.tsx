"use client";

import { ArrowLeft, ArrowRight, Leaf, Sliders } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Page, StickyFooter } from "@/components/layout";
import { Button, ProgressBar } from "@/components/ui";
import type { CookSession, Recipe, RecipeStep } from "@/lib/types";
import { DockSimulatorSheet } from "./DockSimulatorSheet";
import { LiveDockCard } from "./LiveDockCard";
import { StateCueCheck } from "./StateCueCheck";
import { StepTimer } from "./StepTimer";
import { TemperatureCard } from "./TemperatureCard";
import type { SensorDockState } from "./useSensorDock";

export interface StepViewProps {
  recipe: Recipe;
  session: CookSession;
  step: RecipeStep;
  index: number;
  total: number;
  dock: SensorDockState;
  onBack(): void;
  onNext(): void;
  onFinish(): void;
}

/**
 * Phase B — one guided step with its live sensor sub-cards.
 *
 * Rendered with `key={step.id}` so every per-step piece of state (timer, state
 * cue) resets when the cook moves on.
 */
export function StepView({
  recipe,
  session,
  step,
  index,
  total,
  dock,
  onBack,
  onNext,
  onFinish,
}: StepViewProps) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [cueConfirmed, setCueConfirmed] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  /** Seconds spent paused, so the clock keeps tracking wall time otherwise. */
  const pausedTotalRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);

  const startedAt = session.stepLogs.find((l) => l.stepId === step.id)?.startedAt;

  // The timer counts up from the StepLog, so a reload resumes where it was.
  useEffect(() => {
    if (!running) return;
    const parsed = startedAt ? Date.parse(startedAt) : Number.NaN;
    const startMs = Number.isNaN(parsed) ? Date.now() : parsed;
    const tick = () => {
      const seconds = (Date.now() - startMs) / 1000 - pausedTotalRef.current;
      setElapsed(Math.max(0, Math.round(seconds)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running, startedAt]);

  const toggleTimer = () => {
    setRunning((wasRunning) => {
      if (wasRunning) {
        pausedAtRef.current = Date.now();
        return false;
      }
      if (pausedAtRef.current !== null) {
        pausedTotalRef.current += (Date.now() - pausedAtRef.current) / 1000;
        pausedAtRef.current = null;
      }
      return true;
    });
  };

  const factor = recipe.servings > 0 ? session.servings / recipe.servings : 1;
  const addGrams = (step.addIngredients ?? []).reduce(
    (sum, a) => sum + a.grams * factor,
    0,
  );
  const addNames = (step.addIngredients ?? [])
    .map(
      (a) =>
        recipe.ingredients.find((ri) => ri.ingredientId === a.ingredientId)?.name ??
        a.ingredientId,
    )
    .join(" + ");

  const isLast = index === total - 1;

  return (
    <>
      <Page noNav>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-primary">
            Step {index + 1} of {total}
          </span>
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
        <ProgressBar
          className="mt-2"
          value={((index + 1) / total) * 100}
          height={6}
          aria-label={`Step ${index + 1} of ${total}`}
        />

        <h2 className="mt-4 text-[22px] leading-tight font-bold text-text">
          {step.title}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-text-2">
          {step.instruction}
        </p>

        <div className="mt-4 space-y-3">
          {addGrams > 0 && (
            <LiveDockCard
              weightG={dock.weightG}
              stable={dock.stable}
              targetGrams={addGrams}
              caption={addNames || "On the dock"}
            />
          )}

          {step.targetTempC && (
            <TemperatureCard step={step} tempC={dock.tempC} elapsedSec={elapsed} />
          )}

          {step.durationSec != null && step.durationSec > 0 && (
            <StepTimer
              elapsedSec={elapsed}
              plannedSec={step.durationSec}
              running={running}
              onToggle={toggleTimer}
            />
          )}

          {step.stateCue && (
            <StateCueCheck
              stateCue={step.stateCue}
              stepTitle={step.title}
              recipeName={recipe.name}
              confirmed={cueConfirmed}
              onConfirm={() => setCueConfirmed(true)}
            />
          )}

          {step.tip && (
            <p className="flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-green-700">
              <Leaf size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
              {step.tip}
            </p>
          )}
        </div>
      </Page>

      <StickyFooter>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            leftIcon={<ArrowLeft size={18} />}
            disabled={index === 0}
            onClick={onBack}
          >
            Back
          </Button>
          <Button
            size="lg"
            className="flex-[1.4]"
            rightIcon={<ArrowRight size={18} />}
            onClick={isLast ? onFinish : onNext}
          >
            {isLast ? "Finish cooking" : "Next"}
          </Button>
        </div>
      </StickyFooter>

      <DockSimulatorSheet
        open={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        dock={dock}
        targetGrams={addGrams > 0 ? addGrams : undefined}
      />
    </>
  );
}

"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Card, Input } from "@/components/ui";
import type { Goal } from "@/lib/types";
import { GOAL_OPTIONS } from "../options";
import { computeTargets } from "../targets";
import {
  OptionCard,
  StepSection,
  numberOrUndefined,
  type StepProps,
} from "./common";

/**
 * Step 3 — a single goal plus the calorie / protein targets it implies.
 * Picking a goal recomputes both numbers; the inputs then override them.
 */
export function StepGoals({ draft, onChange, errors }: StepProps) {
  const computed = computeTargets(draft);
  const kcal = draft.dailyCalorieTarget ?? computed.dailyCalorieTarget;
  const protein = draft.proteinTargetG ?? computed.proteinTargetG;
  const overridden =
    kcal !== computed.dailyCalorieTarget || protein !== computed.proteinTargetG;

  // Seed the draft the first time the step is shown so the numbers on screen
  // are the numbers that get saved, even if the user never edits them.
  useEffect(() => {
    if (draft.dailyCalorieTarget == null || draft.proteinTargetG == null) {
      onChange({ dailyCalorieTarget: kcal, proteinTargetG: protein });
    }
  }, [draft.dailyCalorieTarget, draft.proteinTargetG, kcal, protein, onChange]);

  function selectGoal(goal: Goal) {
    const next = computeTargets({ ...draft, goal });
    onChange({
      goal,
      dailyCalorieTarget: next.dailyCalorieTarget,
      proteinTargetG: next.proteinTargetG,
    });
  }

  return (
    <div className="space-y-6">
      <StepSection
        title="Your main goal"
        hint="Pick one — it drives every plan we build."
        error={errors?.goal}
      >
        <div className="space-y-2">
          {GOAL_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              label={o.label}
              emoji={o.emoji}
              description={o.description}
              selected={draft.goal === o.value}
              onSelect={() => selectGoal(o.value)}
            />
          ))}
        </div>
      </StepSection>

      <Card tone="green" className="space-y-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-100 text-primary"
          >
            <Sparkles size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-text">Your daily targets</h3>
            <p className="mt-0.5 text-xs text-text-2">
              {computed.personalised
                ? "Estimated from your height, weight, age and goal. Change them if you know better."
                : "Add your height and weight in step 1 for a personalised estimate."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Calories"
            inputMode="numeric"
            value={kcal}
            rightSlot={<span className="pr-2 text-xs text-text-3">kcal</span>}
            onChange={(e) =>
              onChange({
                dailyCalorieTarget:
                  numberOrUndefined(e.target.value) ?? computed.dailyCalorieTarget,
              })
            }
          />
          <Input
            label="Protein"
            inputMode="numeric"
            value={protein}
            rightSlot={<span className="pr-2 text-xs text-text-3">g</span>}
            onChange={(e) =>
              onChange({
                proteinTargetG: numberOrUndefined(e.target.value) ?? computed.proteinTargetG,
              })
            }
          />
        </div>

        {overridden && (
          <button
            type="button"
            onClick={() =>
              onChange({
                dailyCalorieTarget: computed.dailyCalorieTarget,
                proteinTargetG: computed.proteinTargetG,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[13px] font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Reset to our estimate
          </button>
        )}
      </Card>
    </div>
  );
}

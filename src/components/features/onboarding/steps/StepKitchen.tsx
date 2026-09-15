"use client";

import { EQUIPMENT_OPTIONS } from "../options";
import { ChipToggleGroup, StepSection, toggleValue, type StepProps } from "./common";

/** Step 4 — the equipment the user actually owns (hard filter for the planner). */
export function StepKitchen({ draft, onChange, errors }: StepProps) {
  const selected = draft.equipment ?? [];

  return (
    <div className="space-y-6">
      <StepSection
        title="What's in your kitchen?"
        hint="Tap everything you have. We only suggest recipes you can cook with these."
        action={
          <span className="text-xs font-medium text-text-2">{selected.length} selected</span>
        }
        error={errors?.equipment}
      >
        <ChipToggleGroup
          label="Kitchen equipment"
          options={EQUIPMENT_OPTIONS}
          values={selected}
          onToggle={(v) => onChange({ equipment: toggleValue(draft.equipment, v) })}
        />
      </StepSection>

      <p className="text-xs leading-relaxed text-text-3">
        Have the Cookwise sensor dock? Select it to unlock live weight and pan
        temperature during cooking.
      </p>
    </div>
  );
}

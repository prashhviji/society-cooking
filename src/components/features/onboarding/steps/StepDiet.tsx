"use client";

import type { DietType } from "@/lib/types";
import { ALLERGY_OPTIONS, DIET_OPTIONS, RESTRICTION_OPTIONS } from "../options";
import {
  ChipToggleGroup,
  OptionCard,
  StepSection,
  toggleValue,
  type StepProps,
} from "./common";

/** Step 2 — diet type (single), allergies and restrictions (multi). */
export function StepDiet({ draft, onChange, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <StepSection
        title="Diet type"
        hint="We never plan a meal that breaks this."
        error={errors?.diet}
      >
        <div className="space-y-2">
          {DIET_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              label={o.label}
              emoji={o.emoji}
              description={o.description}
              selected={draft.diet === o.value}
              onSelect={() => onChange({ diet: o.value as DietType })}
            />
          ))}
        </div>
      </StepSection>

      <StepSection title="Allergies" hint="Ingredients we'll keep out of your plan entirely.">
        <ChipToggleGroup
          label="Allergies"
          options={ALLERGY_OPTIONS}
          values={draft.allergies ?? []}
          onToggle={(v) => onChange({ allergies: toggleValue(draft.allergies, v) })}
        />
      </StepSection>

      <StepSection title="Other restrictions">
        <ChipToggleGroup
          label="Dietary restrictions"
          options={RESTRICTION_OPTIONS}
          values={draft.restrictions ?? []}
          onToggle={(v) => onChange({ restrictions: toggleValue(draft.restrictions, v) })}
        />
      </StepSection>
    </div>
  );
}

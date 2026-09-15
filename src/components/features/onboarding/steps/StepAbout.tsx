"use client";

import { Input, Select } from "@/components/ui";
import { GENDER_OPTIONS, type Gender } from "../options";
import { StepSection, numberOrUndefined, type StepProps } from "./common";

/** Step 1 — name, age, city, gender and the optional height / weight. */
export function StepAbout({ draft, onChange, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <StepSection title="Who's cooking?">
        <Input
          label="Your name"
          placeholder="Santhosh"
          autoComplete="given-name"
          value={draft.name ?? ""}
          error={errors?.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Age"
            inputMode="numeric"
            placeholder="20"
            value={draft.age ?? ""}
            onChange={(e) => onChange({ age: numberOrUndefined(e.target.value) })}
          />
          <Input
            label="City"
            placeholder="Chennai, India"
            autoComplete="address-level2"
            value={draft.city ?? ""}
            onChange={(e) => onChange({ city: e.target.value || undefined })}
          />
        </div>
        <Select
          label="Gender (optional)"
          placeholder="Select an option"
          value={draft.gender ?? ""}
          options={GENDER_OPTIONS}
          onChange={(e) =>
            onChange({ gender: (e.target.value || undefined) as Gender | undefined })
          }
        />
      </StepSection>

      <StepSection
        title="Body basics (optional)"
        hint="Used only to estimate your daily calorie and protein targets. Skip it and we'll use sensible defaults."
      >
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Height"
            inputMode="numeric"
            placeholder="172"
            rightSlot={<span className="pr-2 text-xs text-text-3">cm</span>}
            value={draft.heightCm ?? ""}
            onChange={(e) => onChange({ heightCm: numberOrUndefined(e.target.value) })}
          />
          <Input
            label="Weight"
            inputMode="numeric"
            placeholder="65"
            rightSlot={<span className="pr-2 text-xs text-text-3">kg</span>}
            value={draft.weightKg ?? ""}
            onChange={(e) => onChange({ weightKg: numberOrUndefined(e.target.value) })}
          />
        </div>
      </StepSection>
    </div>
  );
}

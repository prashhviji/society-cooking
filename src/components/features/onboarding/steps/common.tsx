"use client";

/**
 * Shared building blocks for the onboarding steps.
 *
 * Every step takes the same `{ draft, onChange }` pair so `/onboarding` and
 * `/profile/edit` can render the exact same component.
 */

import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { Card, Chip } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { DraftPatch, ProfileDraft, StepErrors } from "../draft";
import type { Option } from "../options";

export interface StepProps {
  draft: ProfileDraft;
  /** Shallow-merges the patch into the draft. */
  onChange: (patch: DraftPatch) => void;
  /** Inline validation messages; only shown once the user tried to advance. */
  errors?: StepErrors;
}

// ---------------------------------------------------------------------------

export interface StepSectionProps {
  title: string;
  hint?: ReactNode;
  /** Right-hand slot on the title row (counters, "Reset order", …). */
  action?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

/** Labelled block inside a step: title, optional hint, content, error. */
export function StepSection({
  title,
  hint,
  action,
  error,
  children,
  className,
}: StepSectionProps) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        {action}
      </div>
      {hint != null && <p className="-mt-1 text-xs text-text-2">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

export interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  emoji?: string;
  description?: string;
  /** Rank badge for the priorities step. */
  badge?: ReactNode;
}

/** Tappable card used for the diet, goal and priority lists. */
export function OptionCard({
  selected,
  onSelect,
  label,
  emoji,
  description,
  badge,
}: OptionCardProps) {
  return (
    <Card
      padding="sm"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-3",
        selected ? "border-primary bg-green-50" : "border-border",
      )}
    >
      {emoji && (
        <span
          aria-hidden="true"
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl",
            selected ? "bg-green-100" : "bg-surface-2",
          )}
        >
          {emoji}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-text">{label}</span>
        {description && (
          <span className="mt-0.5 block truncate text-xs text-text-2">{description}</span>
        )}
      </span>
      {badge ?? (
        <span
          aria-hidden="true"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
            selected
              ? "border-primary bg-primary text-primary-fg"
              : "border-border bg-surface text-transparent",
          )}
        >
          <Check size={14} strokeWidth={3} />
        </span>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

export interface ChipToggleGroupProps<T extends string> {
  options: Option<T>[];
  values: readonly T[];
  onToggle: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
}

/** Wrapping row of multi-select filter chips (allergies, equipment, cuisines). */
export function ChipToggleGroup<T extends string>({
  options,
  values,
  onToggle,
  label,
}: ChipToggleGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip
          key={o.value}
          selected={values.includes(o.value)}
          onClick={() => onToggle(o.value)}
          icon={o.emoji ? <span className="text-[13px]">{o.emoji}</span> : undefined}
          className="h-9 px-3.5 text-[13px]"
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface RemovableChipProps {
  label: string;
  onRemove: () => void;
  /** Screen-reader wording, e.g. "Remove dosa from favourite foods". */
  removeLabel: string;
}

/** Green chip with a trailing × — free-text favourites and disliked items. */
export function RemovableChip({ label, onRemove, removeLabel }: RemovableChipProps) {
  return (
    <span className="inline-flex h-9 max-w-full items-center gap-1 rounded-full bg-green-100 pr-1 pl-3 text-[13px] font-medium text-green-700">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-green-700 transition-transform duration-150 active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------

/** Toggle a value inside a string array without mutating it. */
export function toggleValue<T extends string>(list: readonly T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
}

/** Parse a numeric text input; empty / invalid becomes `undefined`. */
export function numberOrUndefined(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

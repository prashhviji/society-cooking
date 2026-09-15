import type { ChipTone } from "@/components/ui";
import type { ProgressTone } from "@/components/ui";

/** The dock tolerance the mockups quote: ±10 % of the target. */
export const WEIGHT_TOLERANCE = 0.1;
/** Above this share of the target the progress bar turns orange. */
const OVERSHOOT_ALERT = 1.15;

export interface WeightStatus {
  /** `actual / target` as a percentage (0 when there is no target). */
  percent: number;
  /** Inside ±10 % of the target. */
  within: boolean;
  /** Short line for the status chip. */
  label: string;
  tone: ChipTone;
  /** Tone for the fill of the progress bar. */
  barTone: Exclude<ProgressTone, "auto">;
}

function grams(n: number): string {
  const v = Math.abs(n);
  return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} g`;
}

/**
 * Turns a live weight into the mockup's three states:
 * "Perfect amount!" / "Add 20 g more" / "20 g over — that's fine".
 */
export function weightStatus(actualG: number, targetG: number): WeightStatus {
  if (targetG <= 0) {
    return {
      percent: 0,
      within: true,
      label: "Ready",
      tone: "neutral",
      barTone: "green",
    };
  }

  const actual = Math.max(0, actualG); // the scale can read −0.1 g from noise
  const percent = (actual / targetG) * 100;
  const delta = actual - targetG;
  const within = Math.abs(delta) <= targetG * WEIGHT_TOLERANCE;

  if (within) {
    return { percent, within, label: "Perfect amount!", tone: "green", barTone: "green" };
  }
  if (delta < 0) {
    return {
      percent,
      within,
      label: `Add ${grams(delta)} more`,
      tone: "amber",
      barTone: "amber",
    };
  }
  return {
    percent,
    within,
    label: `${grams(delta)} over — that's fine`,
    tone: "neutral",
    barTone: percent > OVERSHOOT_ALERT * 100 ? "orange" : "amber",
  };
}

/** Burner band label used by the Pan Temperature card. */
export function temperatureBand(tempC: number): string {
  if (tempC < 100) return "Low";
  if (tempC < 130) return "Medium-low";
  if (tempC < 160) return "Medium";
  return "High";
}

/** `125` -> "2:05". */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

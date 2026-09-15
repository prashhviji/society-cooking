import { ChartColumn, Leaf } from "lucide-react";
import { Card, ProgressBar } from "@/components/ui";
import type { DailyIntake, UserProfile } from "@/lib/types";
import { clamp } from "@/lib/utils";

export interface StayOnTrackCardProps {
  goal: string;
  intake: DailyIntake;
  profile: UserProfile | null;
}

/** Daily kcal progress against the profile target; tap opens the weekly plan. */
export function StayOnTrackCard({ goal, intake, profile }: StayOnTrackCardProps) {
  const target = profile?.dailyCalorieTarget ?? 0;
  const proteinTarget = profile?.proteinTargetG ?? 0;
  const pct = target > 0 ? clamp((intake.kcal / target) * 100, 0, 100) : 0;

  return (
    <Card href="/plan" aria-label="Stay on track — open your weekly plan">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700"
        >
          <Leaf size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-text-2">
            Your weekly goal: <span className="font-semibold text-text">{goal}</span>
          </p>
          <p className="mt-1 text-[15px] text-text-2">
            <span className="text-[20px] leading-none font-bold text-text tabular-nums">
              {intake.kcal.toLocaleString("en-IN")}
            </span>{" "}
            / {target.toLocaleString("en-IN")} kcal
          </p>
        </div>
        <span aria-hidden="true" className="shrink-0 text-text-3">
          <ChartColumn size={18} />
        </span>
      </div>

      <ProgressBar
        className="mt-3"
        value={pct}
        tone="green"
        aria-label="Calories eaten today"
      />
      <p className="mt-2 text-[11px] text-text-2">
        Protein{" "}
        <span className="font-semibold text-text tabular-nums">{intake.proteinG}</span> /{" "}
        {proteinTarget} g
      </p>
    </Card>
  );
}

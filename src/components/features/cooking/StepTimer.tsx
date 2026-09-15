"use client";

import { Pause, Play } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatClock } from "./weight";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface StepTimerProps {
  elapsedSec: number;
  /** Planned duration from the recipe step. */
  plannedSec: number;
  running: boolean;
  onToggle(): void;
}

/** Count-up ring for a timed step; the ring turns amber once it runs over. */
export function StepTimer({ elapsedSec, plannedSec, running, onToggle }: StepTimerProps) {
  const ratio = plannedSec > 0 ? Math.min(1, elapsedSec / plannedSec) : 0;
  const over = plannedSec > 0 && elapsedSec > plannedSec;

  return (
    <Card padding="md">
      <div className="flex items-center gap-4">
        <div className="relative h-[108px] w-[108px] shrink-0">
          <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90">
            <circle
              cx="54"
              cy="54"
              r={RADIUS}
              fill="none"
              strokeWidth="8"
              className="stroke-surface-2"
            />
            <circle
              cx="54"
              cy="54"
              r={RADIUS}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
              className={cn(
                "transition-[stroke-dashoffset] duration-500 ease-linear",
                over ? "stroke-amber-600" : "stroke-green-500",
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={cn(
                "text-[22px] leading-none font-bold tabular-nums",
                over ? "text-amber-600" : "text-text",
              )}
            >
              {formatClock(elapsedSec)}
            </span>
            <span className="mt-1 text-[10px] text-text-3">elapsed</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-text-2">
            planned{" "}
            <span className="font-semibold text-text tabular-nums">
              {formatClock(plannedSec)}
            </span>
          </p>
          {over && (
            <p className="mt-1 text-[12px] font-medium text-amber-600">
              {formatClock(elapsedSec - plannedSec)} over — check it now.
            </p>
          )}
          <Button
            variant="secondary"
            size="md"
            className="mt-3"
            leftIcon={running ? <Pause size={16} /> : <Play size={16} />}
            onClick={onToggle}
          >
            {running ? "Pause" : "Start"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

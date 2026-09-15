"use client";

import { Camera, Check, Eye, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Chip } from "@/components/ui";
import { aiAvailable, aiCookingState } from "@/lib/ai/client";
import type { CookingStateResult } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";
import { CameraCapture } from "./CameraCapture";

export interface StateCueCheckProps {
  /** e.g. "onions golden brown". */
  stateCue: string;
  stepTitle: string;
  recipeName: string;
  confirmed: boolean;
  onConfirm(): void;
}

/**
 * "Check: onions golden brown" — confirm by eye, or let the vision model look
 * at the pan. Falls back to the manual confirm when Gemini is not configured.
 */
export function StateCueCheck({
  stateCue,
  stepTitle,
  recipeName,
  confirmed,
  onConfirm,
}: StateCueCheckProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CookingStateResult | null>(null);
  const [aiOn, setAiOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void aiAvailable().then((ok) => {
      if (!cancelled) setAiOn(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onCapture = async (blob: Blob) => {
    setChecking(true);
    const res = await aiCookingState(blob, stateCue, { stepTitle, recipeName });
    setChecking(false);
    setCameraOpen(false);
    if (res.ok) {
      setResult(res.data);
      if (res.data.matches) onConfirm();
    } else {
      setResult(null);
    }
  };

  return (
    <>
      <Card padding="md">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-primary"
          >
            <Eye size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-text-2">Check</p>
            <p className="text-[15px] leading-snug font-semibold text-text">{stateCue}</p>
          </div>
          {confirmed && (
            <Chip tone="green" icon={<Check size={12} />}>
              Confirmed
            </Chip>
          )}
        </div>

        {result && (
          <div
            className={cn(
              "fade-up mt-3 rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed",
              result.matches
                ? "bg-green-50 text-green-700"
                : "bg-orange-50 text-orange-600",
            )}
          >
            <p className="flex items-center gap-1.5 font-semibold">
              {result.matches ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <TriangleAlert size={14} aria-hidden="true" />
              )}
              {result.matches ? "Looks right" : "Not there yet"} ·{" "}
              {Math.round(result.confidence * 100)} %
            </p>
            <p className="mt-0.5">{result.advice}</p>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            variant={confirmed ? "soft" : "secondary"}
            size="md"
            className="flex-1"
            leftIcon={<Check size={16} />}
            onClick={onConfirm}
          >
            Looks right
          </Button>
          {aiOn && (
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Camera size={16} />}
              loading={checking}
              onClick={() => setCameraOpen(true)}
            >
              Check with camera
            </Button>
          )}
        </div>
      </Card>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(blob) => void onCapture(blob)}
        busy={checking}
        title="Check the pan"
        description={`Looking for: ${stateCue}`}
      />
    </>
  );
}

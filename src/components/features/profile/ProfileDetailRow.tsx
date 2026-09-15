import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DetailTone = "green" | "orange" | "blue" | "neutral";

const TILE_TONES: Record<DetailTone, string> = {
  green: "bg-green-50 text-primary",
  orange: "bg-orange-50 text-orange-600",
  blue: "bg-blue-100 text-blue-600",
  neutral: "bg-surface-2 text-text-2",
};

export interface ProfileDetailRowProps {
  /** 18 px lucide icon — rendered `aria-hidden` inside the tile. */
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: DetailTone;
  /** Hairline separator under the row. */
  divider?: boolean;
}

/** One "icon tile + label + value" row inside the profile summary card. */
export function ProfileDetailRow({
  icon,
  label,
  value,
  tone = "green",
  divider,
}: ProfileDetailRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3",
        divider && "border-b border-border",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          TILE_TONES[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-text-2">{label}</p>
        <p className="text-[14px] leading-snug font-medium break-words text-text">
          {value}
        </p>
      </div>
    </div>
  );
}

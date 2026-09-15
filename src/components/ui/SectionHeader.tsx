import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SectionCaptionTone = "muted" | "orange" | "green" | "amber";

const CAPTION_TONES: Record<SectionCaptionTone, string> = {
  muted: "text-text-2",
  orange: "text-orange-600",
  green: "text-green-700",
  amber: "text-amber-600",
};

export interface SectionHeaderProps {
  title: ReactNode;
  /** Second line under the title, e.g. "3 items expiring soon". */
  caption?: ReactNode;
  captionTone?: SectionCaptionTone;
  /** Right-hand action label, e.g. "See all". */
  actionLabel?: ReactNode;
  actionHref?: string;
  onAction?: () => void;
  /** Extra node rendered on the right instead of / next to the action. */
  right?: ReactNode;
  className?: string;
}

/** Title row above a list or card group, with an optional "See all" action. */
export function SectionHeader({
  title,
  caption,
  captionTone = "muted",
  actionLabel,
  actionHref,
  onAction,
  right,
  className,
}: SectionHeaderProps) {
  const actionClasses =
    "shrink-0 text-[13px] font-semibold text-primary rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <div className={cn("mb-2 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="truncate text-[16px] leading-tight font-semibold text-text">
          {title}
        </h2>
        {caption != null && (
          <p className={cn("mt-0.5 text-xs", CAPTION_TONES[captionTone])}>{caption}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actionLabel != null &&
          (actionHref ? (
            <Link href={actionHref} className={actionClasses}>
              {actionLabel}
            </Link>
          ) : (
            <button type="button" onClick={onAction} className={actionClasses}>
              {actionLabel}
            </button>
          ))}
        {right}
      </div>
    </div>
  );
}

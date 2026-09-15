import { cn } from "@/lib/utils";

export type BadgeTone = "red" | "primary" | "orange";

const TONES: Record<BadgeTone, string> = {
  red: "bg-red-600 text-primary-fg",
  primary: "bg-primary text-primary-fg",
  orange: "bg-orange-600 text-primary-fg",
};

export interface BadgeProps {
  /** Numeric count. Omit (or pass `dot`) for a plain indicator dot. */
  count?: number;
  /** Force the 8 px dot form — used on the notification bell. */
  dot?: boolean;
  /** Counts above this render as `"{max}+"`. Defaults to 9. */
  max?: number;
  tone?: BadgeTone;
  /** Screen-reader text, e.g. "3 unread alerts". */
  label?: string;
  /** Position it yourself, e.g. `"absolute top-1 right-1"`. */
  className?: string;
}

/** Small count / dot indicator, typically absolutely positioned on an icon. */
export function Badge({
  count,
  dot,
  max = 9,
  tone = "red",
  label,
  className,
}: BadgeProps) {
  const isDot = dot || count == null;
  const text = count != null && count > max ? `${max}+` : String(count ?? "");

  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      className={cn(
        "inline-flex items-center justify-center rounded-full ring-2 ring-bg",
        TONES[tone],
        isDot
          ? "h-2.5 w-2.5"
          : "h-[18px] min-w-[18px] px-1 text-[10px] leading-none font-bold tabular-nums",
        className,
      )}
    >
      {!isDot && text}
    </span>
  );
}

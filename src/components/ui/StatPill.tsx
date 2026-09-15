import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatPillProps extends HTMLAttributes<HTMLDivElement> {
  /** Leading icon node, rendered `aria-hidden`. */
  icon?: ReactNode;
  /** Bold headline value, e.g. `20` or `"320"`. */
  value: ReactNode;
  /** Muted unit after the value, e.g. `"min"`, `"kcal"`, `"g protein"`. */
  unit?: string;
  /** Optional caption under the value (used by nutrition tiles). */
  caption?: string;
}

/** Compact "⏱ 20 min" metric box used in rows of three under recipe titles. */
export function StatPill({
  icon,
  value,
  unit,
  caption,
  className,
  ...rest
}: StatPillProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-auto items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-2",
        className,
      )}
      {...rest}
    >
      {icon && (
        <span aria-hidden="true" className="shrink-0 text-text-2">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate text-[12.5px] leading-tight font-semibold text-text">
          {value}
          {unit && (
            <span className="ml-0.5 text-[11px] font-medium text-text-2">{unit}</span>
          )}
        </div>
        {caption && (
          <div className="truncate text-[11px] leading-tight text-text-3">{caption}</div>
        )}
      </div>
    </div>
  );
}

export type StatPillRowProps = HTMLAttributes<HTMLDivElement>;

/** Lays out 2–4 `StatPill`s in an equal-width row. */
export function StatPillRow({ className, children, ...rest }: StatPillRowProps) {
  return (
    <div className={cn("flex items-stretch gap-2", className)} {...rest}>
      {children}
    </div>
  );
}

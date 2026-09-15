import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export interface EmptyStateProps {
  /** Emoji string or an icon node shown in the tinted tile. */
  emoji?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Primary action label; renders a button when set. */
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /** Extra content under the action (e.g. a secondary link). */
  children?: ReactNode;
  className?: string;
}

/** Friendly placeholder for empty lists — every list in the app has one. */
export function EmptyState({
  emoji = "🍳",
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-10 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-50 to-green-100 text-3xl text-primary"
      >
        {emoji}
      </span>
      <h3 className="text-[16px] font-semibold text-text">{title}</h3>
      {description != null && (
        <p className="mt-1 max-w-[280px] text-[13px] leading-relaxed text-text-2">
          {description}
        </p>
      )}
      {actionLabel && (
        <Button
          className="mt-4"
          href={actionHref}
          onClick={onAction}
          variant="primary"
          size="md"
        >
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}

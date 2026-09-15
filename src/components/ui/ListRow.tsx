import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ListRowProps {
  /** Left slot — an `EmojiTile`, `Avatar`, checkbox or icon tile. */
  leading?: ReactNode;
  title: ReactNode;
  /** Muted second line. */
  subtitle?: ReactNode;
  /** Right slot — a `Chip`, chevron, kebab `IconButton` or value. */
  trailing?: ReactNode;
  href?: string;
  prefetch?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  /** Hairline separator under the row. */
  divider?: boolean;
  className?: string;
  /** Accessible name when the title is not plain text. */
  "aria-label"?: string;
}

/**
 * Generic 60 px list row: leading slot, two lines of text, trailing slot.
 * Renders a link or button when navigable so the whole row is one target.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  href,
  prefetch,
  onClick,
  divider,
  className,
  "aria-label": ariaLabel,
}: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const classes = cn(
    "flex w-full min-h-[60px] items-center gap-3 py-2.5 text-left",
    divider && "border-b border-border",
    interactive &&
      "transition-colors duration-150 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-xl",
    className,
  );

  const content = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-text">{title}</span>
        {subtitle != null && (
          <span className="mt-0.5 block truncate text-xs text-text-2">{subtitle}</span>
        )}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        prefetch={prefetch}
        className={classes}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={classes} aria-label={ariaLabel} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className={classes} aria-label={ariaLabel}>
      {content}
    </div>
  );
}

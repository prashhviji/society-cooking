import Link from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type CardTone = "default" | "green" | "orange";
export type CardPadding = "none" | "sm" | "md";

const TONES: Record<CardTone, string> = {
  default: "bg-surface border-border",
  green: "bg-green-50 border-green-100",
  orange: "bg-orange-50 border-orange-100",
};

const PADDINGS: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
};

interface CardOwnProps {
  tone?: CardTone;
  /** Inner padding. Use `none` for edge-to-edge lists and hero images. */
  padding?: CardPadding;
  href?: string;
  prefetch?: boolean;
  /** Makes the whole card a button (or adds a handler to the link). */
  onClick?: MouseEventHandler<HTMLElement>;
  children?: ReactNode;
}

export type CardProps = CardOwnProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof CardOwnProps>;

/**
 * White rounded surface with a hairline border and the Cookwise card shadow.
 * Renders a link or a button when `href` / `onClick` is supplied so the whole
 * card is a single accessible target.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { tone = "default", padding = "md", href, prefetch, className, children, onClick, ...rest },
  ref,
) {
  const interactive = Boolean(href || onClick);
  const classes = cn(
    "block rounded-2xl border shadow-card",
    TONES[tone],
    PADDINGS[padding],
    interactive &&
      "w-full text-left transition-transform duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    className,
  );

  if (href) {
    const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link
        href={href}
        prefetch={prefetch}
        className={classes}
        onClick={onClick}
        {...anchorProps}
      >
        {children}
      </Link>
    );
  }

  if (onClick) {
    const buttonProps = rest as unknown as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button type="button" className={classes} onClick={onClick} {...buttonProps}>
        {children}
      </button>
    );
  }

  return (
    <div ref={ref} className={classes} {...rest}>
      {children}
    </div>
  );
});

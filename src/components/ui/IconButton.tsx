import Link from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type IconButtonVariant = "plain" | "white" | "primary" | "soft";
export type IconButtonSize = 32 | 36 | 40 | 44;

const VARIANTS: Record<IconButtonVariant, string> = {
  plain: "bg-transparent text-text hover:bg-surface-2",
  white: "bg-surface text-text shadow-raised hover:bg-surface-2",
  primary: "bg-primary text-primary-fg shadow-card hover:bg-primary-strong",
  soft: "bg-primary-soft text-primary hover:bg-green-50",
};

interface IconButtonOwnProps {
  variant?: IconButtonVariant;
  /** Diameter in pixels. Defaults to 40. */
  size?: IconButtonSize;
  /** Icon node — rendered `aria-hidden`, so always pass `aria-label` too. */
  children?: ReactNode;
  href?: string;
  prefetch?: boolean;
}

export type IconButtonProps = IconButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof IconButtonOwnProps> & {
    /** Required: the button shows an icon only. */
    "aria-label": string;
  };

/** Circular icon-only button — headers, card overlays and image heroes. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      variant = "plain",
      size = 40,
      href,
      prefetch,
      className,
      children,
      type = "button",
      disabled,
      ...rest
    },
    ref,
  ) {
    const classes = cn(
      "inline-flex shrink-0 items-center justify-center rounded-full",
      "transition-[transform,background-color] duration-150 active:scale-[0.94]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
      "disabled:pointer-events-none disabled:opacity-50",
      VARIANTS[variant],
      className,
    );
    const style = { width: size, height: size };

    const content = (
      <span aria-hidden="true" className="inline-flex items-center justify-center">
        {children}
      </span>
    );

    if (href && !disabled) {
      const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <Link
          href={href}
          prefetch={prefetch}
          className={classes}
          style={style}
          {...anchorProps}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        style={style}
        disabled={disabled}
        {...rest}
      >
        {content}
      </button>
    );
  },
);

import Link from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "soft"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-fg hover:bg-primary-strong shadow-card disabled:hover:bg-primary",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-2 disabled:hover:bg-surface",
  soft: "bg-green-100 text-green-700 hover:bg-green-50 disabled:hover:bg-green-100",
  ghost: "bg-transparent text-text-2 hover:bg-surface-2 disabled:hover:bg-transparent",
  danger: "bg-red-600 text-primary-fg hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[13px] gap-1.5",
  md: "h-11 px-5 text-[14px] gap-2",
  lg: "h-[52px] px-6 text-[15px] gap-2",
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width — the default for bottom CTAs. */
  fullWidth?: boolean;
  /** Swaps the left icon for a spinner and blocks interaction. */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** When set the button renders a `next/link` anchor instead of a `<button>`. */
  href?: string;
  /** Forwarded to `next/link`; ignored without `href`. */
  prefetch?: boolean;
}

export type ButtonProps = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps>;

/**
 * The single button primitive for Cookwise. Pill shaped in every variant so a
 * row of mixed buttons stays visually consistent.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth,
    loading = false,
    leftIcon,
    rightIcon,
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
  const isDisabled = disabled || loading;
  const classes = cn(
    "inline-flex select-none items-center justify-center rounded-full font-semibold",
    "transition-[transform,background-color,opacity] duration-150 active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className,
  );

  const content = (
    <>
      {loading ? (
        <Spinner size={ICON_SIZE[size] as 14 | 16 | 20} />
      ) : (
        leftIcon && (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {leftIcon}
          </span>
        )
      )}
      {children != null && <span className="truncate">{children}</span>}
      {rightIcon && (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {rightIcon}
        </span>
      )}
    </>
  );

  if (href && !isDisabled) {
    const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link href={href} prefetch={prefetch} className={classes} {...anchorProps}>
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});

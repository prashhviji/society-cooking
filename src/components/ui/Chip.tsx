import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipTone =
  | "green"
  | "orange"
  | "amber"
  | "neutral"
  | "blue"
  | "red"
  | "dark";
export type ChipSize = "sm" | "md";

const TONES: Record<ChipTone, string> = {
  green: "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-600",
  amber: "bg-amber-100 text-amber-600",
  neutral: "bg-surface-2 text-text-2",
  blue: "bg-blue-100 text-blue-600",
  red: "bg-red-100 text-red-600",
  dark: "bg-primary text-primary-fg",
};

const SIZES: Record<ChipSize, string> = {
  sm: "h-6 gap-1 px-2 text-[11px]",
  md: "h-7 gap-1.5 px-2.5 text-xs",
};

interface ChipOwnProps {
  tone?: ChipTone;
  size?: ChipSize;
  /**
   * Filter-chip mode. `true` forces the dark (active) look, `false` renders the
   * outlined inactive look; leave undefined for a plain label chip.
   */
  selected?: boolean;
  /** Small leading node (icon or emoji) — rendered `aria-hidden`. */
  icon?: ReactNode;
  children?: ReactNode;
}

export type ChipProps = ChipOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ChipOwnProps>;

/**
 * Small pill label. Used both as a static badge ("High Protein", "2 days") and
 * as a tappable filter chip when `onClick` is supplied.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { tone = "neutral", size = "md", selected, icon, className, children, onClick, type = "button", ...rest },
  ref,
) {
  const toneClasses =
    selected === true
      ? TONES.dark
      : selected === false
        ? "bg-surface text-text-2 border border-border"
        : TONES[tone];

  const classes = cn(
    "inline-flex max-w-full shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap",
    SIZES[size],
    toneClasses,
    onClick &&
      "transition-transform duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    className,
  );

  const content = (
    <>
      {icon && (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center">
          {icon}
        </span>
      )}
      <span className="truncate">{children}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        onClick={onClick}
        aria-pressed={selected}
        {...rest}
      >
        {content}
      </button>
    );
  }

  return <span className={classes}>{content}</span>;
});

import { cn } from "@/lib/utils";

export type SpinnerSize = 14 | 16 | 20 | 24 | 32;

export interface SpinnerProps {
  /** Pixel size of the spinner. Defaults to 16. */
  size?: SpinnerSize;
  className?: string;
  /** Screen-reader label. Omit inside a button that already announces its state. */
  label?: string;
}

/**
 * Indeterminate loading indicator. Inherits `currentColor` so it works on any
 * button variant without extra props.
 */
export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="animate-spin"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2.5"
          opacity="0.22"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

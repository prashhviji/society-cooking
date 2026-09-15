import { cn } from "@/lib/utils";

export interface DotsProps {
  /** Total number of steps. */
  count: number;
  /** Zero-based index of the current step. */
  active: number;
  /** Accessible label, e.g. "Step 3 of 7". Defaults to that wording. */
  label?: string;
  className?: string;
}

/** Step progress dots for the onboarding wizard; the active dot is a short bar. */
export function Dots({ count, active, label, className }: DotsProps) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={active + 1}
      aria-label={label ?? `Step ${active + 1} of ${count}`}
      className={cn("flex items-center justify-center gap-1.5", className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === active ? "w-5 bg-primary" : "w-1.5 bg-border",
          )}
        />
      ))}
    </div>
  );
}

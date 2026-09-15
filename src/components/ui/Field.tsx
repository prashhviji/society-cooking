import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  /** Input id the label points at. */
  htmlFor?: string;
  label?: ReactNode;
  /** Muted helper text under the control. Hidden while `error` is set. */
  hint?: ReactNode;
  /** Validation message; also turns the control's border red. */
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error wrapper shared by every form primitive. */
export function Field({ htmlFor, label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("w-full", className)}>
      {label != null && (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-[13px] font-medium text-text-2"
        >
          {label}
        </label>
      )}
      {children}
      {error != null ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : hint != null ? (
        <p className="mt-1.5 text-xs text-text-3">{hint}</p>
      ) : null}
    </div>
  );
}

/** Shared control chrome: 48 px tall, rounded, hairline border, focus ring. */
export const controlClasses =
  "w-full h-12 rounded-xl bg-surface border border-border px-3.5 text-[15px] text-text placeholder:text-text-3 " +
  "transition-[border-color,box-shadow] outline-none " +
  "focus:border-primary focus:ring-2 focus:ring-primary/30 " +
  "disabled:opacity-60 disabled:bg-surface-2";

export const controlErrorClasses = "border-red-600 focus:border-red-600 focus:ring-red-600/25";

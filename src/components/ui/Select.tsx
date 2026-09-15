"use client";

import { ChevronDown } from "lucide-react";
import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Field, controlClasses, controlErrorClasses } from "./Field";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectOwnProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Convenience alternative to passing `<option>` children. */
  options?: SelectOption[];
  /** Shown as a disabled first option when the value is empty. */
  placeholder?: string;
  containerClassName?: string;
}

export type SelectProps = SelectOwnProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, keyof SelectOwnProps>;

/** Native select with the shared 48 px control chrome and a chevron. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    options,
    placeholder,
    containerClassName,
    className,
    id,
    children,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <Field
      htmlFor={selectId}
      label={label}
      hint={hint}
      error={error}
      className={containerClassName}
    >
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(
            controlClasses,
            "cursor-pointer appearance-none pr-10",
            error && controlErrorClasses,
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options?.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-text-3"
        />
      </div>
    </Field>
  );
});

"use client";

import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Field, controlErrorClasses } from "./Field";

interface TextareaOwnProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export type TextareaProps = TextareaOwnProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof TextareaOwnProps>;

/** Multi-line input sharing the `Input` chrome (notes, feedback). */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, containerClassName, className, id, rows = 4, ...rest },
  ref,
) {
  const autoId = useId();
  const textareaId = id ?? autoId;

  return (
    <Field
      htmlFor={textareaId}
      label={label}
      hint={hint}
      error={error}
      className={containerClassName}
    >
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full min-h-24 resize-y rounded-xl border border-border bg-surface px-3.5 py-3 text-[15px] text-text placeholder:text-text-3",
          "transition-[border-color,box-shadow] outline-none",
          "focus:border-primary focus:ring-2 focus:ring-primary/30",
          "disabled:bg-surface-2 disabled:opacity-60",
          error && controlErrorClasses,
          className,
        )}
        {...rest}
      />
    </Field>
  );
});

"use client";

import { Search, X } from "lucide-react";
import {
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { Field, controlClasses, controlErrorClasses } from "./Field";

interface InputOwnProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Node rendered inside the control on the left (usually a 16 px icon). */
  leftIcon?: ReactNode;
  /** Node rendered inside the control on the right. */
  rightSlot?: ReactNode;
  /** Class applied to the outer `Field`, not the `<input>`. */
  containerClassName?: string;
}

export type InputProps = InputOwnProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, keyof InputOwnProps>;

/** 48 px text input with label, hint and error states. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, containerClassName, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <Field
      htmlFor={inputId}
      label={label}
      hint={hint}
      error={error}
      className={containerClassName}
    >
      <div className="relative">
        {leftIcon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-3"
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            controlClasses,
            leftIcon && "pl-10",
            rightSlot && "pr-10",
            error && controlErrorClasses,
            className,
          )}
          {...rest}
        />
        {rightSlot && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2">{rightSlot}</span>
        )}
      </div>
    </Field>
  );
});

export type SearchInputProps = Omit<InputProps, "leftIcon" | "type"> & {
  /** Called when the clear (×) button is pressed. */
  onClear?: () => void;
};

/** `Input` preset with a leading search icon and a clear button. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    { onClear, onChange, value, defaultValue, placeholder = "Search…", ...rest },
    ref,
  ) {
    const innerRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, []);

    const controlled = value !== undefined;
    const [inner, setInner] = useState(String(defaultValue ?? ""));
    const current = controlled ? String(value ?? "") : inner;

    return (
      <Input
        ref={innerRef}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        leftIcon={<Search size={18} />}
        onChange={(e) => {
          if (!controlled) setInner(e.target.value);
          onChange?.(e);
        }}
        rightSlot={
          current ? (
            <button
              type="button"
              aria-label="Clear search"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-3 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              onClick={() => {
                if (!controlled) {
                  setInner("");
                  if (innerRef.current) innerRef.current.value = "";
                }
                onClear?.();
                innerRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : undefined
        }
        {...rest}
      />
    );
  },
);

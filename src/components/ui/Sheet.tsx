"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useIsClient } from "./useIsClient";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Heading shown next to the close button. */
  title?: ReactNode;
  /** Muted line under the title. */
  description?: ReactNode;
  /** Pinned action area under the scrollable body (e.g. a confirm button). */
  footer?: ReactNode;
  /** Hide the × button when the sheet must be dismissed via an action. */
  hideClose?: boolean;
  /** Class applied to the sheet panel. */
  className?: string;
  children?: ReactNode;
}

/**
 * Bottom sheet modal. Portals to `document.body`, locks body scroll, closes on
 * backdrop click or Escape, and stays inside the app shell width on desktop.
 *
 * The panel stays mounted and animates in/out with a transform + visibility
 * transition, so children keep their state while the sheet is closed. Render
 * expensive children conditionally if that matters.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  footer,
  hideClose,
  className,
  children,
}: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();

  // Escape to close, focus the panel and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!isClient) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50",
        open ? "visible" : "invisible pointer-events-none",
      )}
      // `visibility` transitions discretely, so it flips only after the slide out.
      style={{ transition: "visibility 220ms" }}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          "absolute inset-0 h-full w-full cursor-default bg-text/40 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "absolute bottom-0 left-1/2 flex max-h-[85dvh] w-full max-w-[var(--app-max-width)] flex-col",
          "-translate-x-1/2 rounded-t-3xl bg-surface shadow-raised outline-none",
          "transition-transform duration-[220ms] ease-out",
          open ? "translate-y-0" : "translate-y-full",
          className,
        )}
      >
        <div className="shrink-0 pt-2.5 pb-1">
          <div aria-hidden="true" className="mx-auto h-1 w-9 rounded-full bg-border" />
        </div>

        {(title != null || !hideClose) && (
          <div className="flex shrink-0 items-start gap-3 px-4 pt-2 pb-3">
            <div className="min-w-0 flex-1">
              {title != null && (
                <h2 id={titleId} className="text-[17px] font-bold text-text">
                  {title}
                </h2>
              )}
              {description != null && (
                <p className="mt-0.5 text-xs text-text-2">{description}</p>
              )}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                tabIndex={open ? 0 : -1}
                className="-mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4",
            footer ? "pb-4" : "pb-[calc(16px+env(safe-area-inset-bottom))]",
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-border px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

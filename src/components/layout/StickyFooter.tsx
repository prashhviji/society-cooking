import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StickyFooterProps {
  children: ReactNode;
  /** Sit above the bottom nav — use inside the `(tabs)` route group. */
  withNav?: boolean;
  /** Skip the in-flow spacer when the page already reserves the space. */
  noSpacer?: boolean;
  className?: string;
}

/**
 * Bottom-fixed action bar for primary CTAs ("Start Cooking →", "Back / Next").
 * Renders an in-flow spacer of the same height so content is never covered.
 */
export function StickyFooter({
  children,
  withNav,
  noSpacer,
  className,
}: StickyFooterProps) {
  return (
    <>
      {!noSpacer && (
        <div
          aria-hidden="true"
          className={cn(
            "h-[76px]",
            withNav ? "pb-0" : "pb-[env(safe-area-inset-bottom)]",
          )}
        />
      )}
      <div
        className={cn(
          "fixed left-1/2 z-40 w-full max-w-[var(--app-max-width)] -translate-x-1/2",
          "border-t border-border bg-surface px-4 pt-3",
          withNav
            ? "bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom))] pb-3"
            : "bottom-0 pb-[calc(12px+env(safe-area-inset-bottom))]",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}

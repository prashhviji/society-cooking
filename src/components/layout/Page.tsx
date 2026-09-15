import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface PageProps extends HTMLAttributes<HTMLElement> {
  /** Drop the bottom-nav clearance (screens outside the `(tabs)` group). */
  noNav?: boolean;
  /** Skip the mount fade-in (e.g. inside an already-animated container). */
  noAnimate?: boolean;
}

/**
 * Screen content wrapper: 16 px gutters, clearance for the bottom nav and the
 * subtle `fade-up` mount animation from `globals.css`.
 */
export function Page({ noNav, noAnimate, className, children, ...rest }: PageProps) {
  return (
    <main
      className={cn("page", noNav && "page--no-nav", !noAnimate && "fade-up", className)}
      {...rest}
    >
      {children}
    </main>
  );
}

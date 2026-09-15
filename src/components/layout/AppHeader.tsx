"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface AppHeaderProps {
  title?: ReactNode;
  /** Muted line under the title. */
  subtitle?: ReactNode;
  /**
   * `true` renders a back chevron that calls `router.back()`;
   * a string renders a link to that href. Omit for tab roots.
   */
  back?: boolean | string;
  /** Right slot — usually an `IconButton` or a text action. */
  right?: ReactNode;
  /** 26 px page title, left aligned (Home / Profile style). */
  large?: boolean;
  /** No background or blur — for overlaying a hero image. */
  transparent?: boolean;
  /** Override the computed alignment. */
  align?: "left" | "center";
  className?: string;
  /** Extra content rendered under the title row, inside the sticky area. */
  children?: ReactNode;
}

/**
 * Sticky screen header: optional back control, title and a right action.
 * Adds safe-area top padding; blurs the off-white ground when not transparent.
 */
export function AppHeader({
  title,
  subtitle,
  back,
  right,
  large,
  transparent,
  align,
  className,
  children,
}: AppHeaderProps) {
  const router = useRouter();
  const resolvedAlign = align ?? (large ? "left" : back ? "center" : "left");
  const backVariant = transparent ? "white" : "plain";

  const backButton =
    back === true ? (
      <IconButton
        aria-label="Go back"
        variant={backVariant}
        size={40}
        onClick={() => router.back()}
        className="-ml-2"
      >
        <ChevronLeft size={22} />
      </IconButton>
    ) : typeof back === "string" ? (
      <IconButton aria-label="Go back" variant={backVariant} size={40} href={back} className="-ml-2">
        <ChevronLeft size={22} />
      </IconButton>
    ) : null;

  return (
    <header
      className={cn(
        transparent
          ? "absolute inset-x-0 top-0 z-30 bg-transparent"
          : "sticky top-0 z-30 bg-bg/90 backdrop-blur-md",
        "pt-[env(safe-area-inset-top)]",
        className,
      )}
    >
      <div className="flex min-h-14 items-center gap-2 px-4 py-2">
        {backButton && (
          <div className="flex min-w-10 shrink-0 items-center">{backButton}</div>
        )}

        <div
          className={cn(
            "min-w-0 flex-1",
            resolvedAlign === "center" ? "text-center" : "text-left",
          )}
        >
          {title != null && (
            <h1
              className={cn(
                "truncate text-text",
                large ? "text-[26px] leading-tight font-bold" : "text-[17px] font-semibold",
              )}
            >
              {title}
            </h1>
          )}
          {subtitle != null && (
            <p className="mt-0.5 truncate text-xs text-text-2">{subtitle}</p>
          )}
        </div>

        {(right != null || backButton) && (
          <div className="flex min-w-10 shrink-0 items-center justify-end gap-1">
            {right}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}

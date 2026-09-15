import { Camera, CalendarDays, CookingPot, Plus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tint = "orange" | "blue" | "green";

const TINTS: Record<Tint, string> = {
  orange: "bg-orange-100 text-orange-600",
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-700",
};

interface QuickAction {
  href: string;
  icon: LucideIcon;
  tint: Tint;
  /** Split across two 11 px lines so every tile is the same height. */
  lines: [string, string];
  label: string;
}

const ACTIONS: QuickAction[] = [
  {
    href: "/pantry/add?mode=scan",
    icon: Camera,
    tint: "orange",
    lines: ["Scan", "Ingredients"],
    label: "Scan ingredients",
  },
  {
    href: "/plan",
    icon: CalendarDays,
    tint: "blue",
    lines: ["View Meal", "Plan"],
    label: "View meal plan",
  },
  {
    href: "/cook",
    icon: CookingPot,
    tint: "green",
    lines: ["Start", "Cooking"],
    label: "Start cooking",
  },
  {
    href: "/pantry/add",
    icon: Plus,
    tint: "green",
    lines: ["Add to", "Pantry"],
    label: "Add to pantry",
  },
];

/** 4-column grid of white shortcut tiles under the Today's Meal card. */
export function QuickActions({ className }: { className?: string }) {
  return (
    <nav aria-label="Quick actions" className={className}>
      <ul className="grid grid-cols-4 gap-2">
        {ACTIONS.map(({ href, icon: Icon, tint, lines, label }) => (
          <li key={label} className="flex">
            <Link
              href={href}
              aria-label={label}
              className={cn(
                "flex min-h-[92px] flex-1 flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface px-1 py-3",
                "shadow-card transition-transform duration-150 active:scale-[0.97]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  TINTS[tint],
                )}
              >
                <Icon size={19} />
              </span>
              <span
                aria-hidden="true"
                className="px-0.5 text-center text-[11px] leading-[1.25] font-medium text-text-2"
              >
                {lines[0]}
                <br />
                {lines[1]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

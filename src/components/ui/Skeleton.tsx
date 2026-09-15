import { cn } from "@/lib/utils";

export interface SkeletonProps {
  /** Size / shape utilities, e.g. `"h-4 w-32"`. */
  className?: string;
}

/** Placeholder block shown while the persisted stores rehydrate. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-surface-2", className)}
    />
  );
}

export interface SkeletonRowProps {
  /** Show a square leading tile. Defaults to true. */
  leading?: boolean;
  /** Show the muted second line. Defaults to true. */
  subtitle?: boolean;
  className?: string;
}

/** Skeleton shaped like a `ListRow`, for pantry / recipe lists. */
export function SkeletonRow({
  leading = true,
  subtitle = true,
  className,
}: SkeletonRowProps) {
  return (
    <div
      className={cn("flex min-h-[60px] items-center gap-3 py-2.5", className)}
      aria-hidden="true"
    >
      {leading && <Skeleton className="h-11 w-11 rounded-xl" />}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/2" />
        {subtitle && <Skeleton className="h-3 w-1/3" />}
      </div>
      <Skeleton className="h-6 w-14 rounded-full" />
    </div>
  );
}

import { cn } from "@/lib/utils";

export type AvatarSize = 32 | 40 | 64 | 88;

const TEXT: Record<AvatarSize, string> = {
  32: "text-xs",
  40: "text-sm",
  64: "text-xl",
  88: "text-3xl",
};

export interface AvatarProps {
  /** Used for the initial letter and the image alt text. */
  name?: string;
  /** Local image path (`/avatars/…`). Remote hosts are not supported offline. */
  src?: string;
  size?: AvatarSize;
  className?: string;
}

/** Round profile image, falling back to a soft green initial tile. */
export function Avatar({ name, src, size = 40, className }: AvatarProps) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  const classes = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
    className,
  );
  const style = { width: size, height: size };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local assets only; the app must work offline without the image optimiser.
      <img
        src={src}
        alt={name ? `${name}'s avatar` : "Avatar"}
        width={size}
        height={size}
        className={cn(classes, "object-cover")}
        style={style}
      />
    );
  }

  return (
    <span
      className={cn(classes, "bg-primary-soft font-semibold text-primary", TEXT[size])}
      style={style}
      aria-hidden={name ? undefined : "true"}
      role={name ? "img" : undefined}
      aria-label={name ? `${name}'s avatar` : undefined}
    >
      {initial}
    </span>
  );
}

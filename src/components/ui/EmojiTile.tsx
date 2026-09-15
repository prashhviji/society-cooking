import { cn } from "@/lib/utils";

export type EmojiTileSize = 40 | 56 | 64 | 88 | "full";
export type EmojiTileTone = "green" | "orange" | "neutral";

const TONES: Record<EmojiTileTone, string> = {
  green: "bg-gradient-to-br from-green-50 to-green-100",
  orange: "bg-gradient-to-br from-orange-50 to-orange-100",
  neutral: "bg-gradient-to-br from-surface-2 to-border",
};

const EMOJI_TEXT: Record<Exclude<EmojiTileSize, "full">, string> = {
  40: "text-lg",
  56: "text-2xl",
  64: "text-[28px]",
  88: "text-[40px]",
};

export interface EmojiTileProps {
  /** Emoji shown when there is no `imageUrl`, e.g. `"🍳"`. */
  emoji?: string;
  /** Local image path (`/recipes/egg-bhurji.jpg`). Remote URLs are not supported. */
  imageUrl?: string;
  /** Alt text for the image variant; also used as the tile's accessible name. */
  alt?: string;
  size?: EmojiTileSize;
  tone?: EmojiTileTone;
  className?: string;
  /** Override the emoji font size class (handy inside `full` tiles). */
  emojiClassName?: string;
}

/**
 * Soft gradient tile with the ingredient / recipe emoji — the app's stand-in
 * for photography. Renders a local `<img>` instead when `imageUrl` is set.
 */
export function EmojiTile({
  emoji = "🍽️",
  imageUrl,
  alt,
  size = 56,
  tone = "green",
  className,
  emojiClassName,
}: EmojiTileProps) {
  const isFull = size === "full";
  const style = isFull ? undefined : { width: size, height: size };
  const base = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
    isFull && "h-full w-full",
    className,
  );

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local assets only; the app must work offline without the image optimiser.
      <img
        src={imageUrl}
        alt={alt ?? ""}
        className={cn(base, "object-cover")}
        style={style}
      />
    );
  }

  return (
    <span
      className={cn(base, TONES[tone])}
      style={style}
      role={alt ? "img" : undefined}
      aria-label={alt}
      aria-hidden={alt ? undefined : "true"}
    >
      <span className={cn(isFull ? "text-5xl" : EMOJI_TEXT[size], emojiClassName)}>
        {emoji}
      </span>
    </span>
  );
}

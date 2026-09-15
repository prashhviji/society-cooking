import { Card, SectionHeader } from "@/components/ui";
import { ingredientById } from "@/lib/data/seed/ingredients";
import type { ExpiringSummary } from "@/lib/data/selectors";
import { formatExpiry } from "@/lib/utils";

export interface PantryAlertsCardProps {
  summary: ExpiringSummary;
}

/** "3 items expiring soon" plus up to three mini tiles. */
export function PantryAlertsCard({ summary }: PantryAlertsCardProps) {
  const tiles = summary.items.slice(0, 3);

  return (
    <Card>
      <SectionHeader
        title="Pantry Alerts"
        caption={summary.label}
        captionTone={summary.count ? "orange" : "green"}
        actionLabel="See all"
        actionHref="/expiring"
        className="mb-0"
      />
      {tiles.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {tiles.map((item) => (
            <li
              key={item.id}
              className="flex flex-col items-center gap-0.5 rounded-xl bg-surface-2 px-1.5 py-2.5"
            >
              <span aria-hidden="true" className="text-[28px] leading-none">
                {ingredientById(item.ingredientId)?.emoji ?? "🥘"}
              </span>
              <span className="mt-1 w-full truncate text-center text-[11px] font-medium text-text">
                {item.name}
              </span>
              <span className="text-[11px] font-semibold text-orange-600">
                {formatExpiry(item.expiresAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

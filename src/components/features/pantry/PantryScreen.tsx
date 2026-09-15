"use client";

import { EllipsisVertical, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppHeader, Page } from "@/components/layout";
import {
  Button,
  Chip,
  EmojiTile,
  EmptyState,
  IconButton,
  ListRow,
  SearchInput,
  SkeletonRow,
} from "@/components/ui";
import { ingredientById } from "@/lib/data/seed/ingredients";
import { expiringSummary } from "@/lib/data/selectors";
import { useHydrated } from "@/lib/data/storage";
import { usePantryStore } from "@/lib/data/stores";
import type { PantryItem } from "@/lib/types";
import {
  daysUntil,
  expiryTone,
  formatExpiry,
  formatQuantity,
} from "@/lib/utils";
import {
  FILTER_LABELS,
  FILTER_ORDER,
  filterForIngredient,
  type PantryFilter,
} from "./helpers";
import { PantryItemSheet } from "./PantryItemSheet";

const EXPIRING_DAYS = 3;

/** Expiry chip colour: orange ≤ 2 days, amber ≤ 4, green after, grey > 30. */
function expiryChipTone(expiresAt: string) {
  if (daysUntil(expiresAt) > 30) return "neutral" as const;
  const tone = expiryTone(expiresAt);
  return tone === "danger" ? ("orange" as const) : tone === "warn" ? ("amber" as const) : ("green" as const);
}

function matchesQuery(item: PantryItem, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  if (item.name.toLowerCase().includes(term)) return true;
  const catalog = ingredientById(item.ingredientId);
  return Boolean(
    catalog?.aliases.some((a) => a.toLowerCase().includes(term)) ||
      catalog?.name.toLowerCase().includes(term),
  );
}

/** Pantry (`/pantry`) — search, category chips, expiry-sorted rows. SCREENS §12. */
export function PantryScreen() {
  const hydrated = useHydrated();
  const items = usePantryStore((s) => s.items);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PantryFilter>("all");
  // `sheet.item` outlives `sheet.open` so the bottom sheet can animate out.
  const [sheet, setSheet] = useState<{
    item: PantryItem | null;
    open: boolean;
    session: number;
  }>({ item: null, open: false, session: 0 });

  const openSheet = (item: PantryItem) =>
    setSheet((prev) => ({ item, open: true, session: prev.session + 1 }));
  const closeSheet = () => setSheet((prev) => ({ ...prev, open: false }));

  const summary = useMemo(
    () => expiringSummary(items, EXPIRING_DAYS),
    [items],
  );

  // "Fruits" only earns a chip when the pantry actually holds fruit.
  const filters = useMemo(() => {
    const present = new Set(items.map((i) => filterForIngredient(i.ingredientId)));
    return FILTER_ORDER.filter((f) => f !== "fruits" || present.has("fruits"));
  }, [items]);

  const rows = useMemo(
    () =>
      items
        .filter(
          (i) =>
            matchesQuery(i, query) &&
            (filter === "all" || filterForIngredient(i.ingredientId) === filter),
        )
        .sort(
          (a, b) =>
            a.expiresAt.localeCompare(b.expiresAt) || a.name.localeCompare(b.name),
        ),
    [items, query, filter],
  );

  const summaryLine = `${items.length} item${items.length === 1 ? "" : "s"} · ${
    summary.count ? `${summary.count} expiring soon` : "nothing expiring soon"
  }`;

  return (
    <>
      <AppHeader back title="My Pantry">
        <div className="px-4 pb-2">
          <SearchInput
            value={query}
            placeholder="Search ingredients…"
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            aria-label="Search ingredients"
          />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5">
          {filters.map((f) => (
            <Chip
              key={f}
              selected={filter === f}
              onClick={() => setFilter(f)}
              className="h-8 px-3 text-[12px]"
            >
              {FILTER_LABELS[f]}
            </Chip>
          ))}
        </div>
      </AppHeader>

      <Page>
        {!hydrated ? (
          <div className="divide-y divide-border">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            emoji="🧺"
            title="Your pantry is empty"
            description="Add what you have at home so Cookwise can plan around it."
            actionLabel="+ Add Item"
            actionHref="/pantry/add"
          />
        ) : (
          <>
            <p className="mb-1 text-xs text-text-2">{summaryLine}</p>

            {rows.length === 0 ? (
              <EmptyState
                emoji="🔍"
                title="No matches"
                description="Try another search term or a different category."
              />
            ) : (
              <ul>
                {rows.map((item, index) => (
                  <li key={item.id}>
                    <ListRow
                      divider={index < rows.length - 1}
                      leading={
                        <EmojiTile
                          emoji={ingredientById(item.ingredientId)?.emoji ?? "🥘"}
                          size={40}
                          tone="neutral"
                        />
                      }
                      title={item.name}
                      subtitle={formatQuantity(item.quantity, item.unit)}
                      trailing={
                        <>
                          <Chip tone={expiryChipTone(item.expiresAt)} size="sm">
                            {formatExpiry(item.expiresAt)}
                          </Chip>
                          <IconButton
                            aria-label={`Options for ${item.name}`}
                            size={36}
                            onClick={() => openSheet(item)}
                          >
                            <EllipsisVertical size={18} />
                          </IconButton>
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Page>

      {/* FAB — pinned inside the phone shell, above the bottom nav. */}
      <div className="pointer-events-none fixed bottom-0 left-1/2 z-40 w-full max-w-[var(--app-max-width)] -translate-x-1/2">
        <div className="pointer-events-none flex justify-end px-4 pb-[calc(var(--nav-height)+16px+env(safe-area-inset-bottom))]">
          <Button
            href="/pantry/add"
            className="pointer-events-auto shadow-raised"
            leftIcon={<Plus size={18} />}
          >
            Add Item
          </Button>
        </div>
      </div>

      <PantryItemSheet
        item={sheet.item}
        open={sheet.open}
        session={sheet.session}
        onClose={closeSheet}
      />
    </>
  );
}

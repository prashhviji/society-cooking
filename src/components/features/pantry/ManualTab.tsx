"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, EmojiTile, useToast } from "@/components/ui";
import { ingredientById } from "@/lib/data/seed/ingredients";
import { usePantryStore } from "@/lib/data/stores";
import { formatQuantity } from "@/lib/utils";
import { IngredientPicker } from "./IngredientPicker";
import { draftFor, ItemFields, type Draft } from "./ItemFields";

export function ManualTab() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const ingredient = draft ? ingredientById(draft.ingredientId) : undefined;
  const valid = Boolean(draft && draft.quantity > 0 && draft.expiresAt);

  function add() {
    if (!draft || !valid) return;
    const item = usePantryStore.getState().add({
      ingredientId: draft.ingredientId,
      quantity: draft.quantity,
      unit: draft.unit,
      expiresAt: draft.expiresAt,
      source: "manual",
    });
    const line = `${item.name} · ${formatQuantity(item.quantity, item.unit)}`;
    toast({ title: `Added ${line}`, tone: "success" });
    setAdded(line);
    setDraft(null);
  }

  return (
    <div className="space-y-4">
      {added && (
        <Card tone="green" padding="sm">
          <p className="flex items-center gap-2 text-[13px] font-medium text-green-700">
            <Check size={16} aria-hidden="true" className="shrink-0" />
            Added {added}
          </p>
        </Card>
      )}

      {draft && ingredient ? (
        <Card>
          <div className="flex items-center gap-3">
            <EmojiTile emoji={ingredient.emoji} size={56} tone="green" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[18px] font-bold text-text">
                {ingredient.name}
              </h3>
              <p className="truncate text-[12px] text-text-2">
                {formatQuantity(draft.quantity, draft.unit)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Change
            </Button>
          </div>

          <ItemFields
            className="mt-4"
            draft={draft}
            showStorage
            onChange={(patch) => setDraft({ ...draft, ...patch })}
          />

          <Button fullWidth size="lg" className="mt-4" onClick={add} disabled={!valid}>
            Add to pantry
          </Button>
        </Card>
      ) : (
        <Card>
          <IngredientPicker onSelect={(i) => setDraft(draftFor(i))} />
        </Card>
      )}

      <p className="text-center">
        <Link
          href="/pantry"
          className="inline-flex min-h-11 items-center px-3 text-[14px] font-semibold text-primary"
        >
          Done
        </Link>
      </p>
    </div>
  );
}

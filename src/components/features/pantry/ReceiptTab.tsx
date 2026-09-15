"use client";

import { Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Card,
  IconButton,
  Input,
  Select,
  Spinner,
  useToast,
  type SelectOption,
} from "@/components/ui";
import { aiReceipt } from "@/lib/ai/client";
import { INGREDIENTS, ingredientById } from "@/lib/data/seed/ingredients";
import { usePantryStore } from "@/lib/data/stores";
import type { Ingredient, Unit } from "@/lib/types";
import { uid } from "@/lib/utils";
import { CameraCapture } from "./CameraCapture";
import {
  CATALOG,
  defaultExpiry,
  matchIngredientByName,
  UNIT_OPTIONS,
} from "./helpers";
import { IngredientPicker } from "./IngredientPicker";

type Phase = "capture" | "scanning" | "rows" | "fallback";

const INGREDIENT_OPTIONS: SelectOption[] = INGREDIENTS.map((i) => ({
  value: i.id,
  label: i.name,
}));

interface Row {
  key: string;
  ingredientId: string;
  /** Raw label from the receipt, kept when nothing in the catalog matched. */
  rawName: string;
  quantity: number;
  unit: Unit;
}

function rowFromIngredient(ingredient: Ingredient): Row {
  return {
    key: uid(),
    ingredientId: ingredient.id,
    rawName: ingredient.name,
    quantity: ingredient.defaultUnit === "pcs" ? 1 : 250,
    unit: ingredient.defaultUnit,
  };
}

export function ReceiptTab() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("capture");
  const [reason, setReason] = useState<string | null>(null);
  const [store, setStore] = useState<string | undefined>();
  const [rows, setRows] = useState<Row[]>([]);

  async function scan(blob: Blob) {
    setPhase("scanning");
    setReason(null);
    setRows([]);

    const res = await aiReceipt(blob, CATALOG);
    if (!res.ok) {
      setReason(res.reason);
      setPhase("fallback");
      return;
    }

    setStore(res.data.store);
    setRows(
      res.data.items.map((item) => {
        const match =
          (item.ingredientId ? ingredientById(item.ingredientId) : undefined) ??
          matchIngredientByName(item.name);
        return {
          key: uid(),
          ingredientId: match?.id ?? "",
          rawName: item.name,
          quantity: item.quantity > 0 ? item.quantity : 1,
          unit: item.unit ?? match?.defaultUnit ?? "g",
        };
      }),
    );
    setPhase("rows");
  }

  function patch(key: string, next: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addAll() {
    const usable = rows.filter((r) => r.ingredientId && r.quantity > 0);
    if (!usable.length) return;
    const created = usePantryStore.getState().addMany(
      usable.map((r) => ({
        ingredientId: r.ingredientId,
        quantity: r.quantity,
        unit: r.unit,
        expiresAt: defaultExpiry(r.ingredientId),
        source: "receipt" as const,
      })),
    );
    toast({
      title: `Added ${created.length} item${created.length === 1 ? "" : "s"} to your pantry`,
      tone: "success",
    });
    setRows([]);
    setPhase("capture");
  }

  const usableCount = rows.filter((r) => r.ingredientId && r.quantity > 0).length;

  const editor = (
    <div className="space-y-3">
      {rows.map((row) => (
        <Card key={row.key} padding="sm">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Select
                label={row.rawName}
                value={row.ingredientId}
                placeholder="Pick an ingredient"
                options={INGREDIENT_OPTIONS}
                onChange={(e) => patch(row.key, { ingredientId: e.target.value })}
              />
            </div>
            <IconButton
              aria-label={`Remove ${row.rawName}`}
              size={40}
              className="mt-6"
              onClick={() => removeRow(row.key)}
            >
              <Trash2 size={17} />
            </IconButton>
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              aria-label={`Quantity for ${row.rawName}`}
              type="number"
              inputMode="decimal"
              min={0}
              value={String(row.quantity)}
              containerClassName="flex-1"
              onChange={(e) => patch(row.key, { quantity: Number(e.target.value) })}
            />
            <Select
              aria-label={`Unit for ${row.rawName}`}
              value={row.unit}
              options={UNIT_OPTIONS}
              containerClassName="w-28 shrink-0"
              onChange={(e) => patch(row.key, { unit: e.target.value as Unit })}
            />
          </div>
        </Card>
      ))}

      <IngredientPicker
        onSelect={(i) => setRows((prev) => [...prev, rowFromIngredient(i)])}
        label="Add a missing line"
      />

      <Button fullWidth size="lg" onClick={addAll} disabled={usableCount === 0}>
        Add all ({usableCount})
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <CameraCapture
        onCapture={scan}
        busy={phase === "scanning"}
        captureLabel="Scan receipt"
        idleHint="Lay the receipt flat and fit it in the frame"
      />

      {phase === "scanning" && (
        <Card padding="sm">
          <p className="flex items-center gap-2 text-[14px] text-text-2">
            <Spinner size={16} />
            Reading the receipt…
          </p>
        </Card>
      )}

      {phase === "rows" && (
        <>
          {store && (
            <p className="text-[12px] text-text-2">
              From <span className="font-semibold text-text">{store}</span>
            </p>
          )}
          {rows.length === 0 ? (
            <Card tone="orange" padding="sm">
              <p className="text-[13px] text-orange-600">
                No line items were recognised. Add them manually below.
              </p>
            </Card>
          ) : null}
          {editor}
        </>
      )}

      {phase === "fallback" && (
        <Card tone="orange">
          <p className="flex items-start gap-2 text-[14px] font-semibold text-orange-600">
            <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            AI unavailable — add the items manually
          </p>
          {reason && <p className="mt-1 text-[12px] text-text-2">{reason}</p>}
          <div className="mt-3">{editor}</div>
        </Card>
      )}
    </div>
  );
}

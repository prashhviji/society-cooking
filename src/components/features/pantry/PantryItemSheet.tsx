"use client";

import { ChefHat, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, Input, Select, Sheet, Stepper, useToast } from "@/components/ui";
import { usePantryStore } from "@/lib/data/stores";
import type { PantryItem, Unit } from "@/lib/types";
import { formatQuantity } from "@/lib/utils";
import { UNIT_OPTIONS } from "./helpers";

type Mode = "menu" | "edit" | "remove";

const ROW_CLASSES =
  "flex w-full min-h-[52px] items-center gap-3 rounded-xl px-3 text-left transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

interface BodyProps {
  item: PantryItem;
  onClose: () => void;
}

/** Remounted per item (via `key`), so the edit form always starts fresh. */
function PantryItemSheetBody({ item, onClose }: BodyProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("menu");
  const [quantity, setQuantity] = useState(item.quantity);
  const [unit, setUnit] = useState<Unit>(item.unit);
  const [expiresAt, setExpiresAt] = useState(item.expiresAt);

  const step = unit === "pcs" ? 1 : 50;

  function save() {
    usePantryStore.getState().update(item.id, { quantity, unit, expiresAt });
    toast({
      title: `Updated ${item.name}`,
      description: formatQuantity(quantity, unit),
      tone: "success",
    });
    onClose();
  }

  function remove() {
    usePantryStore.getState().remove(item.id);
    toast({ title: `Removed ${item.name}` });
    onClose();
  }

  if (mode === "menu") {
    return (
      <div className="space-y-1 pb-2">
        <button type="button" onClick={() => setMode("edit")} className={ROW_CLASSES}>
          <span
            aria-hidden="true"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-text-2"
          >
            <Pencil size={17} />
          </span>
          <span className="text-[15px] font-medium text-text">Edit</span>
        </button>

        <Link href="/expiring" className={ROW_CLASSES} onClick={onClose}>
          <span
            aria-hidden="true"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-green-700"
          >
            <ChefHat size={17} />
          </span>
          <span className="text-[15px] font-medium text-text">Use it</span>
        </Link>

        <button type="button" onClick={() => setMode("remove")} className={ROW_CLASSES}>
          <span
            aria-hidden="true"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-600"
          >
            <Trash2 size={17} />
          </span>
          <span className="text-[15px] font-medium text-red-600">Remove</span>
        </button>
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <div className="space-y-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-text-2">Quantity</span>
          <Stepper
            label="Quantity"
            value={quantity}
            onChange={setQuantity}
            min={0}
            max={20000}
            step={step}
            unit={unit}
          />
        </div>
        <Select
          label="Unit"
          value={unit}
          options={UNIT_OPTIONS}
          onChange={(e) => setUnit(e.target.value as Unit)}
        />
        <Input
          label="Expires on"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" fullWidth onClick={() => setMode("menu")}>
            Cancel
          </Button>
          <Button fullWidth onClick={save}>
            Save changes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-2">
      <p className="text-[14px] leading-relaxed text-text-2">
        Remove <span className="font-semibold text-text">{item.name}</span> (
        {formatQuantity(item.quantity, item.unit)}) from your pantry? This cannot be
        undone.
      </p>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" fullWidth onClick={() => setMode("menu")}>
          Keep it
        </Button>
        <Button variant="danger" fullWidth onClick={remove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

export interface PantryItemSheetProps {
  /** Stays set after `open` flips to false, so the sheet has content while it slides out. */
  item: PantryItem | null;
  open: boolean;
  /** Bumped by the caller on every open so the body remounts with fresh state. */
  session: number;
  onClose: () => void;
}

/** Kebab menu for a pantry row: Edit · Use it · Remove. */
export function PantryItemSheet({
  item,
  open,
  session,
  onClose,
}: PantryItemSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item?.name}
      description={item ? formatQuantity(item.quantity, item.unit) : undefined}
    >
      {item && (
        <PantryItemSheetBody
          key={`${item.id}:${session}`}
          item={item}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

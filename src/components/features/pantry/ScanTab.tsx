"use client";

import { Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button, Card, Chip, EmojiTile, Spinner, useToast } from "@/components/ui";
import { aiIdentify } from "@/lib/ai/client";
import { ingredientById } from "@/lib/data/seed/ingredients";
import { usePantryStore } from "@/lib/data/stores";
import type { IdentifyIngredientResult, Ingredient } from "@/lib/types";
import { formatQuantity } from "@/lib/utils";
import { CameraCapture } from "./CameraCapture";
import { CATALOG, matchIngredientByName } from "./helpers";
import { IngredientPicker } from "./IngredientPicker";
import { draftFor, ItemFields, type Draft } from "./ItemFields";

type Phase = "capture" | "identifying" | "result" | "fallback";

export function ScanTab() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("capture");
  const [result, setResult] = useState<IdentifyIngredientResult | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  function choose(ingredient: Ingredient, grams?: number) {
    setDraft(draftFor(ingredient, grams));
  }

  async function identify(blob: Blob) {
    setPhase("identifying");
    setReason(null);
    setResult(null);
    setDraft(null);

    const res = await aiIdentify(blob, CATALOG);
    if (!res.ok) {
      setReason(res.reason);
      setPhase("fallback");
      return;
    }

    setResult(res.data);
    const match =
      (res.data.ingredientId ? ingredientById(res.data.ingredientId) : undefined) ??
      matchIngredientByName(res.data.name);
    if (match) {
      choose(match, res.data.estimatedGrams);
      setPhase("result");
    } else {
      setReason(`“${res.data.name}” is not in the catalog yet.`);
      setPhase("fallback");
    }
  }

  function add() {
    if (!draft) return;
    const item = usePantryStore.getState().add({
      ingredientId: draft.ingredientId,
      quantity: draft.quantity,
      unit: draft.unit,
      expiresAt: draft.expiresAt,
      source: "scan",
    });
    toast({
      title: `Added ${item.name} · ${formatQuantity(item.quantity, item.unit)}`,
      tone: "success",
    });
    setPhase("capture");
    setResult(null);
    setDraft(null);
  }

  const ingredient = draft ? ingredientById(draft.ingredientId) : undefined;

  return (
    <div className="space-y-4">
      <CameraCapture
        onCapture={identify}
        busy={phase === "identifying"}
        captureLabel="Identify"
        idleHint="Point the camera at a single ingredient"
      />

      {phase === "identifying" && (
        <Card padding="sm">
          <p className="flex items-center gap-2 text-[14px] text-text-2">
            <Spinner size={16} />
            Identifying…
          </p>
        </Card>
      )}

      {phase === "result" && result && draft && ingredient && (
        <Card>
          <div className="flex items-center gap-3">
            <EmojiTile emoji={ingredient.emoji} size={56} tone="green" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-text-2">Gemini identified</p>
              <h3 className="truncate text-[18px] font-bold text-text">
                {ingredient.name}{" "}
                <span className="text-[14px] font-semibold text-green-700">
                  · {Math.round(result.confidence * 100)} %
                </span>
              </h3>
            </div>
            <Sparkles size={18} aria-hidden="true" className="shrink-0 text-primary" />
          </div>

          {result.alternatives.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[12px] text-text-2">Not right? Try:</p>
              <div className="flex flex-wrap gap-2">
                {result.alternatives.map((alt) => {
                  const altIngredient =
                    (alt.ingredientId ? ingredientById(alt.ingredientId) : undefined) ??
                    matchIngredientByName(alt.name);
                  if (!altIngredient) return null;
                  return (
                    <Chip
                      key={`${alt.ingredientId ?? alt.name}`}
                      selected={altIngredient.id === draft.ingredientId}
                      onClick={() => choose(altIngredient, result.estimatedGrams)}
                    >
                      {altIngredient.name}
                    </Chip>
                  );
                })}
              </div>
            </div>
          )}

          <ItemFields
            className="mt-4"
            draft={draft}
            onChange={(patch) => setDraft({ ...draft, ...patch })}
          />

          <Button fullWidth size="lg" className="mt-4" onClick={add}>
            Add to pantry
          </Button>
        </Card>
      )}

      {phase === "fallback" && (
        <Card tone="orange">
          <p className="flex items-start gap-2 text-[14px] font-semibold text-orange-600">
            <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            AI unavailable — pick the ingredient manually
          </p>
          {reason && <p className="mt-1 text-[12px] text-text-2">{reason}</p>}

          {draft && ingredient ? (
            <>
              <div className="mt-3 flex items-center gap-3">
                <EmojiTile emoji={ingredient.emoji} size={40} tone="neutral" />
                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text">
                  {ingredient.name}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                  Change
                </Button>
              </div>
              <ItemFields
                className="mt-3"
                draft={draft}
                onChange={(patch) => setDraft({ ...draft, ...patch })}
              />
              <Button fullWidth size="lg" className="mt-4" onClick={add}>
                Add to pantry
              </Button>
            </>
          ) : (
            <IngredientPicker
              className="mt-3"
              onSelect={(i) => choose(i)}
              label="Search ingredients to add"
            />
          )}
        </Card>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader, Page, StickyFooter } from "@/components/layout";
import {
  Button,
  Card,
  EmojiTile,
  EmptyState,
  SegmentedControl,
  Skeleton,
  Textarea,
  useToast,
} from "@/components/ui";
import { useCookStore, useFeedbackStore, useRecipeStore } from "@/lib/data/stores";
import { useHydrated } from "@/lib/data/storage";
import type {
  QuantityFeedback,
  SpiceFeedback,
  TextureFeedback,
} from "@/lib/types";
import { StarRating } from "./StarRating";

type Rating = 1 | 2 | 3 | 4 | 5;

const SPICE: { value: SpiceFeedback; label: string }[] = [
  { value: "too_mild", label: "Too mild" },
  { value: "just_right", label: "Just right" },
  { value: "too_hot", label: "Too hot" },
];

const TEXTURE: { value: TextureFeedback; label: string }[] = [
  { value: "too_soft", label: "Too soft" },
  { value: "perfect", label: "Perfect" },
  { value: "too_hard", label: "Too hard" },
];

const QUANTITY: { value: QuantityFeedback; label: string }[] = [
  { value: "too_little", label: "Too little" },
  { value: "just_right", label: "Just right" },
  { value: "too_much", label: "Too much" },
];

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-[14px] font-semibold text-text">{title}</p>
      {children}
    </div>
  );
}

export interface FeedbackScreenProps {
  sessionId: string;
}

/** Feedback — SCREENS §11. Feeds the preference model via `useFeedbackStore`. */
export function FeedbackScreen({ sessionId }: FeedbackScreenProps) {
  const router = useRouter();
  const { toast } = useToast();
  const hydrated = useHydrated();

  const session = useCookStore((s) => s.sessions.find((x) => x.id === sessionId));
  const recipe = useRecipeStore((s) =>
    session ? s.recipes.find((r) => r.id === session.recipeId) : undefined,
  );
  const existing = useFeedbackStore((s) =>
    s.feedback.find((f) => f.sessionId === sessionId),
  );

  const [rating, setRating] = useState<Rating | 0>(0);
  const [taste, setTaste] = useState<Rating | 0>(0);
  const [spice, setSpice] = useState<SpiceFeedback>("just_right");
  const [texture, setTexture] = useState<TextureFeedback>("perfect");
  const [quantity, setQuantity] = useState<QuantityFeedback>("just_right");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  if (!hydrated) {
    return (
      <>
        <AppHeader back title="How was it?" />
        <Page noNav>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="mt-5 h-16 w-full" />
          <Skeleton className="mt-5 h-16 w-full" />
        </Page>
      </>
    );
  }

  if (!session || !recipe) {
    return (
      <>
        <AppHeader back title="How was it?" />
        <Page noNav>
          <EmptyState
            emoji="⭐"
            title="Nothing to rate"
            description="We could not find this cooking session."
            actionLabel="Back home"
            actionHref="/home"
          />
        </Page>
      </>
    );
  }

  const save = () => {
    setTouched(true);
    if (rating === 0) return;

    useFeedbackStore.getState().add({
      sessionId: session.id,
      recipeId: recipe.id,
      rating,
      taste: taste === 0 ? rating : taste,
      spice,
      texture,
      quantity,
      notes: notes.trim() || undefined,
    });

    toast({ title: "Thanks! We'll adjust your future plans.", tone: "success" });
    router.replace("/home");
  };

  return (
    <>
      <AppHeader
        back
        title="How was it?"
        right={<EmojiTile emoji={recipe.emoji} size={40} tone="orange" />}
      />
      <Page noNav>
        <Card padding="md">
          <p className="text-[12px] text-text-2">You cooked</p>
          <p className="text-[18px] leading-tight font-bold text-text">{recipe.name}</p>
          <p className="mt-0.5 text-[12px] text-text-2">
            {session.servings} {session.servings === 1 ? "serving" : "servings"} ·{" "}
            {session.ingredientLogs.length} ingredients measured
          </p>
          {existing && (
            <p className="mt-2 text-[12px] font-medium text-green-700">
              You rated this {existing.rating} out of 5 already — rate it again to
              update your preferences.
            </p>
          )}
        </Card>

        <Block title="Overall">
          <StarRating value={rating} onChange={setRating} label="Overall rating" />
          {touched && rating === 0 && (
            <p className="mt-1 text-[12px] font-medium text-red-600">
              Give it a star rating first.
            </p>
          )}
        </Block>

        <Block title="Taste">
          <StarRating value={taste} onChange={setTaste} label="Taste rating" />
        </Block>

        <Block title="Spice">
          <SegmentedControl
            label="Spice"
            options={SPICE}
            value={spice}
            onChange={setSpice}
          />
        </Block>

        <Block title="Texture">
          <SegmentedControl
            label="Texture"
            options={TEXTURE}
            value={texture}
            onChange={setTexture}
          />
        </Block>

        <Block title="Quantity">
          <SegmentedControl
            label="Quantity"
            options={QUANTITY}
            value={quantity}
            onChange={setQuantity}
          />
        </Block>

        <Block title="Notes">
          <Textarea
            rows={3}
            placeholder="Anything we should remember for next time?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Block>
      </Page>

      <StickyFooter>
        <Button fullWidth size="lg" onClick={save}>
          Save feedback
        </Button>
      </StickyFooter>
    </>
  );
}

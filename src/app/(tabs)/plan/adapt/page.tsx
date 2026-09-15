"use client";

import { format } from "date-fns";
import { Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdaptChooser, PlanDiffList } from "@/components/features/plan";
import { AppHeader, Page } from "@/components/layout";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  SectionHeader,
  SegmentedControl,
  Select,
  Skeleton,
  Stepper,
  Toggle,
  useToast,
} from "@/components/ui";
import { aiAdapt, aiAvailable, toRecipeSummary } from "@/lib/ai/client";
import { useHydrated } from "@/lib/data/storage";
import {
  usePantryStore,
  usePlanStore,
  usePreferenceStore,
  useProfileStore,
  useRecipeStore,
  type ScheduleChangeInput,
} from "@/lib/data/stores";
import { adaptPlan, diffPlans, type MealDiff } from "@/lib/engines/planner";
import type {
  ISODate,
  MealPlan,
  MealType,
  PlannedMeal,
  ScheduleChange,
  ScheduleChangeType,
} from "@/lib/types";
import {
  addDays,
  humanize,
  nowIso,
  parseISODate,
  toISODate,
  uid,
  weekStartOf,
} from "@/lib/utils";

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
];

/** Change types where a single meal (rather than the whole day) is the target. */
const MEAL_SPECIFIC: ScheduleChangeType[] = ["eating_out", "skip_meal", "guests"];

const MOODS = ["light", "comfort", "spicy", "no_cooking", "quick"];

interface Preview {
  diffs: MealDiff[];
  source: "heuristic" | "ai";
  aiMeals?: PlannedMeal[];
  /** Id used for the preview; reused on apply so the seeded planner agrees. */
  changeId: string;
}

export default function AdaptPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { toast } = useToast();

  const today = toISODate();
  const weekStart = weekStartOf(today);

  const plan = usePlanStore((s) => s.currentPlan(weekStart));
  const changes = usePlanStore((s) => s.changes);
  const recipes = useRecipeStore((s) => s.recipes);
  const profile = useProfileStore((s) => s.profile);
  const pantry = usePantryStore((s) => s.items);
  const preferences = usePreferenceStore((s) => s.model);

  const [type, setType] = useState<ScheduleChangeType | null>(null);
  const [date, setDate] = useState<ISODate>(today);
  const [mealType, setMealType] = useState<MealType>("dinner");
  const [minutes, setMinutes] = useState(20);
  const [guests, setGuests] = useState(2);
  const [moods, setMoods] = useState<string[]>(["light"]);
  const [note, setNote] = useState("");

  const [useAI, setUseAI] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  /** The draft the preview was computed for; any edit invalidates it. */
  const [previewFor, setPreviewFor] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    aiAvailable().then((ok) => {
      if (alive) setAiReady(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const recipeById = useCallback(
    (id: string) => recipes.find((r) => r.id === id),
    [recipes],
  );

  /** Remaining days of the current week, starting today. */
  const dayOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(weekStart, i);
      if (d < today) continue;
      out.push({
        value: d,
        label:
          d === today
            ? `Today · ${format(parseISODate(d), "EEE d MMM")}`
            : format(parseISODate(d), "EEE d MMM"),
      });
    }
    return out;
  }, [weekStart, today]);

  const draft: ScheduleChangeInput | null = useMemo(() => {
    if (!type) return null;
    return {
      type,
      date,
      mealType: MEAL_SPECIFIC.includes(type) ? mealType : undefined,
      availableMinutes: type === "less_time" ? minutes : undefined,
      guestCount: type === "guests" ? guests : undefined,
      moodTags: type === "mood_change" ? moods : undefined,
      note: note.trim() || undefined,
    };
  }, [type, date, mealType, minutes, guests, moods, note]);

  const draftKey = useMemo(() => JSON.stringify(draft), [draft]);
  const activePreview = previewFor === draftKey ? preview : null;

  const buildPreview = useCallback(async () => {
    if (!draft || !plan || !profile) return;
    setBusy(true);
    try {
      const change: ScheduleChange = {
        ...draft,
        id: uid(),
        userId: profile.id,
        createdAt: nowIso(),
      };

      if (useAI && aiReady) {
        const res = await aiAdapt(
          {
            plan: { id: plan.id, weekStart: plan.weekStart, meals: plan.meals },
            change,
            profile,
            pantry,
            preferences,
          },
          recipes.map(toRecipeSummary),
        );
        if (res.ok && res.data.meals.length) {
          const after: MealPlan = { ...plan, meals: res.data.meals };
          setPreview({
            diffs: diffPlans(plan, after),
            source: "ai",
            aiMeals: res.data.meals,
            changeId: change.id,
          });
          setPreviewFor(draftKey);
          return;
        }
        toast({
          title: "AI unavailable — used the local planner",
          tone: "warning",
        });
      }

      const after = adaptPlan(plan, change, {
        profile,
        recipes,
        pantry,
        preferences,
      });
      setPreview({
        diffs: diffPlans(plan, after),
        source: "heuristic",
        changeId: change.id,
      });
      setPreviewFor(draftKey);
    } catch {
      toast({ title: "Could not re-optimise the week", tone: "error" });
    } finally {
      setBusy(false);
    }
  }, [
    draft,
    draftKey,
    plan,
    profile,
    pantry,
    preferences,
    recipes,
    useAI,
    aiReady,
    toast,
  ]);

  const apply = useCallback(async () => {
    if (!draft) return;
    setApplying(true);
    try {
      // Reuse the previewed change id so the seeded planner picks the same meals.
      const applied = await usePlanStore
        .getState()
        .applyChange(
          activePreview ? { ...draft, id: activePreview.changeId } : draft,
        );
      // Honour what the user reviewed when the preview came from the AI route.
      if (activePreview?.source === "ai" && activePreview.aiMeals?.length) {
        usePlanStore.getState().upsertPlan({
          ...applied,
          meals: activePreview.aiMeals.map((m) => ({ ...m, planId: applied.id })),
          generatedBy: "gemini",
        });
      }
      toast({ title: "Your week has been updated", tone: "success" });
      router.push("/plan");
    } catch {
      toast({ title: "Could not update the plan", tone: "error" });
    } finally {
      setApplying(false);
    }
  }, [draft, activePreview, router, toast]);

  const recentChanges = useMemo(() => [...changes].slice(-5).reverse(), [changes]);

  const details = type ? (
    <div className="flex flex-col gap-3">
      <Select
        label="Day"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        options={dayOptions}
      />

      {MEAL_SPECIFIC.includes(type) && (
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Meal</p>
          <SegmentedControl
            label="Meal"
            value={mealType}
            onChange={setMealType}
            options={MEAL_OPTIONS}
            size="sm"
          />
        </div>
      )}

      {type === "less_time" && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-text-2">
            Time I have
          </span>
          <Stepper
            label="Available minutes"
            value={minutes}
            onChange={setMinutes}
            min={10}
            max={60}
            step={5}
            unit="min"
          />
        </div>
      )}

      {type === "guests" && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-text-2">Extra guests</span>
          <Stepper
            label="Guest count"
            value={guests}
            onChange={setGuests}
            min={1}
            max={10}
          />
        </div>
      )}

      {type === "mood_change" && (
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text-2">
            What are you in the mood for?
          </p>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <Chip
                key={m}
                selected={moods.includes(m)}
                onClick={() =>
                  setMoods((prev) =>
                    prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
                  )
                }
              >
                {humanize(m)}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <Input
        label="Note (optional)"
        placeholder="Anything else we should know?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </div>
  ) : null;

  return (
    <>
      <AppHeader back="/plan" title="Plans changed?" />
      <Page>
        {!hydrated ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : !plan ? (
          <EmptyState
            emoji="📅"
            title="No plan for this week"
            description="Generate your week first, then tell us what changed."
            actionLabel="Go to the plan"
            actionHref="/plan"
          />
        ) : (
          <>
            <p className="mb-3 text-[13px] text-text-2">
              Tell us what changed and we will re-optimise the rest of the week.
              Locked and cooked meals are never touched.
            </p>

            <AdaptChooser value={type} onSelect={setType}>
              {details}
            </AdaptChooser>

            <div className="mt-4 rounded-2xl border border-border bg-surface p-3">
              <Toggle
                label="AI-assisted re-planning"
                showLabel
                checked={useAI && aiReady}
                disabled={!aiReady}
                onChange={setUseAI}
                description={
                  aiReady
                    ? "Ask Gemini first; the local planner is the fallback."
                    : "Needs a Gemini API key on the server. The local planner handles it either way."
                }
              />
            </div>

            <Button
              className="mt-4"
              fullWidth
              size="lg"
              disabled={!type}
              loading={busy}
              leftIcon={<Wand2 size={18} />}
              onClick={buildPreview}
            >
              Re-optimise my week
            </Button>

            {activePreview && (
              <section className="mt-5">
                <SectionHeader
                  title="What will change"
                  caption={
                    activePreview.source === "ai"
                      ? "Suggested by Gemini"
                      : `${activePreview.diffs.length} meal${activePreview.diffs.length === 1 ? "" : "s"} affected`
                  }
                  captionTone={activePreview.source === "ai" ? "green" : "muted"}
                />
                <PlanDiffList diffs={activePreview.diffs} recipeById={recipeById} />

                <Button
                  className="mt-3"
                  fullWidth
                  size="lg"
                  loading={applying}
                  disabled={activePreview.diffs.length === 0}
                  leftIcon={<Sparkles size={18} />}
                  onClick={apply}
                >
                  Apply to my week
                </Button>
              </section>
            )}

            {recentChanges.length > 0 && (
              <section className="mt-6">
                <SectionHeader title="Recent changes" />
                <Card padding="none">
                  {recentChanges.map((c, i) => (
                    <div
                      key={c.id}
                      className={`px-3 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                    >
                      <p className="text-[14px] font-semibold text-text">
                        {humanize(c.type)}
                        {c.mealType ? ` · ${humanize(c.mealType)}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-text-2">
                        {format(parseISODate(c.date), "EEE d MMM")}
                        {c.availableMinutes ? ` • ${c.availableMinutes} min` : ""}
                        {c.guestCount ? ` • ${c.guestCount} guests` : ""}
                        {c.moodTags?.length
                          ? ` • ${c.moodTags.map(humanize).join(", ")}`
                          : ""}
                      </p>
                    </div>
                  ))}
                </Card>
              </section>
            )}
          </>
        )}
      </Page>
    </>
  );
}

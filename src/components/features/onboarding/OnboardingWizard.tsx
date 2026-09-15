"use client";

import { ArrowRight, Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppHeader, Page, StickyFooter } from "@/components/layout";
import { Button, Dots, Skeleton, useToast } from "@/components/ui";
import { useHydrated } from "@/lib/data/storage";
import { useGroceryStore, usePlanStore, useProfileStore } from "@/lib/data/stores";
import { clamp, nowIso, toISODate, weekStartOf } from "@/lib/utils";
import {
  STEPS,
  TOTAL_STEPS,
  draftFromProfile,
  emptyDraft,
  firstInvalidStep,
  validateStep,
  type DraftPatch,
  type ProfileDraft,
} from "./draft";
import { completePriorities } from "./options";
import { STEP_COMPONENTS } from "./steps";
import { computeTargets } from "./targets";

/**
 * The 7-step onboarding wizard.
 *
 * The wizard only mounts once the stores have rehydrated, so the draft can be
 * pre-filled from an existing profile without a state-sync effect.
 */
export function OnboardingWizard() {
  const hydrated = useHydrated();
  const profile = useProfileStore((s) => s.profile);

  if (!hydrated) return <WizardLoading />;
  return <Wizard initialDraft={profile ? draftFromProfile(profile) : emptyDraft()} />;
}

/**
 * The step lives in `?step=` so the hardware back button walks the wizard
 * backwards; the draft lives in component state and is only written to
 * `useProfileStore` when the user finishes.
 */
function Wizard({ initialDraft }: { initialDraft: ProfileDraft }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [draft, setDraft] = useState<ProfileDraft>(initialDraft);
  /** The step whose validation messages are currently visible. */
  const [errorStep, setErrorStep] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const rawStep = Number(searchParams.get("step") ?? "1");
  const step = Number.isFinite(rawStep) ? clamp(Math.trunc(rawStep), 1, TOTAL_STEPS) : 1;
  const meta = STEPS[step - 1];
  const errors = errorStep === step ? validateStep(step, draft) : {};
  const StepComponent = STEP_COMPONENTS[step];
  const isLast = step === TOTAL_STEPS;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const onChange = useCallback((patch: DraftPatch) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const goToStep = useCallback(
    (next: number) => {
      router.push(`/onboarding?step=${clamp(next, 1, TOTAL_STEPS)}`);
    },
    [router],
  );

  async function finish() {
    const invalid = firstInvalidStep(draft);
    if (invalid !== null) {
      setErrorStep(invalid);
      toast({
        title: "Almost there",
        description: `“${STEPS[invalid - 1].title}” still needs an answer.`,
        tone: "warning",
      });
      goToStep(invalid);
      return;
    }

    setSaving(true);
    const now = nowIso();
    const store = useProfileStore.getState();
    const existing = store.profile;
    // Covers a draft that skipped step 3 by URL.
    const targets = computeTargets(draft);

    store.setProfile({
      ...draft,
      name: draft.name?.trim(),
      dailyCalorieTarget: draft.dailyCalorieTarget ?? targets.dailyCalorieTarget,
      proteinTargetG: draft.proteinTargetG ?? targets.proteinTargetG,
      priorities: completePriorities(draft.priorities),
      currency: "INR",
      onboardingComplete: true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    store.completeOnboarding();

    try {
      const plan = await usePlanStore.getState().generate(weekStartOf(toISODate()));
      useGroceryStore.getState().generateForPlan(plan.id);
    } catch (err) {
      // The week can always be generated again from /plan — never block the user.
      console.warn("[cookwise/onboarding] could not build the first week", err);
    }

    toast({ title: "Your first week is ready", tone: "success" });
    router.replace("/home");
  }

  function handleNext() {
    if (saving) return;
    if (Object.keys(validateStep(step, draft)).length > 0) {
      setErrorStep(step);
      return;
    }
    if (!isLast) {
      goToStep(step + 1);
      return;
    }
    void finish();
  }

  return (
    <>
      <AppHeader
        back={step === 1 ? "/" : true}
        title={meta.title}
        right={
          <span className="pr-1 text-xs font-medium text-text-2 tabular-nums">
            {step}/{TOTAL_STEPS}
          </span>
        }
      >
        <div className="px-4 pb-3">
          <Dots
            count={TOTAL_STEPS}
            active={step - 1}
            label={`Step ${step} of ${TOTAL_STEPS}`}
          />
        </div>
      </AppHeader>

      <Page noNav>
        <p className="mb-5 text-[13px] leading-relaxed text-text-2">{meta.caption}</p>
        <StepComponent draft={draft} onChange={onChange} errors={errors} />
      </Page>

      <StickyFooter>
        <div className="flex items-center gap-3">
          {step === 1 ? (
            <Button href="/" variant="secondary" size="lg" className="flex-1">
              Back
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => router.back()}
            >
              Back
            </Button>
          )}
          <Button
            size="lg"
            className="flex-[1.6]"
            onClick={handleNext}
            loading={saving}
            rightIcon={isLast ? <Check size={18} /> : <ArrowRight size={18} />}
          >
            {isLast ? "Finish" : "Next"}
          </Button>
        </div>
      </StickyFooter>
    </>
  );
}

/** Same chrome, skeleton body — shown while the persisted stores rehydrate. */
function WizardLoading() {
  return (
    <>
      <AppHeader back="/" title="Getting set up">
        <div className="px-4 pb-3">
          <Dots count={TOTAL_STEPS} active={0} label="Loading your details" />
        </div>
      </AppHeader>
      <Page noNav>
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-[72px] rounded-2xl" />
          <Skeleton className="h-[72px] rounded-2xl" />
          <Skeleton className="h-[72px] rounded-2xl" />
        </div>
      </Page>
    </>
  );
}

"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  STEPS,
  draftFromProfile,
  firstInvalidStep,
  validateStep,
  type DraftPatch,
  type ProfileDraft,
} from "@/components/features/onboarding/draft";
import { completePriorities } from "@/components/features/onboarding/options";
import { STEP_COMPONENTS } from "@/components/features/onboarding/steps";
import { AppHeader, Page, StickyFooter } from "@/components/layout";
import { Button, Chip, EmptyState, Skeleton, useToast } from "@/components/ui";
import { useHydrated } from "@/lib/data/storage";
import { useProfileStore } from "@/lib/data/stores";
import { nowIso } from "@/lib/utils";

/**
 * `/profile/edit` — the onboarding steps again, as tabs over one draft.
 * Nothing is written until **Save**.
 */
export function ProfileEditForm() {
  const hydrated = useHydrated();
  const profile = useProfileStore((s) => s.profile);

  if (!hydrated) {
    return (
      <EditShell>
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[72px] rounded-2xl" />
          <Skeleton className="h-[72px] rounded-2xl" />
        </div>
      </EditShell>
    );
  }

  if (!profile) {
    return (
      <EditShell>
        <EmptyState
          emoji="👋"
          title="Nothing to edit yet"
          description="Run the setup once and everything here becomes editable."
          actionLabel="Set up Cookwise"
          actionHref="/onboarding"
        />
      </EditShell>
    );
  }

  return <EditForm initialDraft={draftFromProfile(profile)} />;
}

function EditForm({ initialDraft }: { initialDraft: ProfileDraft }) {
  const router = useRouter();
  const { toast } = useToast();

  const [draft, setDraft] = useState<ProfileDraft>(initialDraft);
  const [active, setActive] = useState(1);
  const [errorStep, setErrorStep] = useState<number | null>(null);

  const onChange = useCallback((patch: DraftPatch) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const StepComponent = STEP_COMPONENTS[active];
  const errors = errorStep === active ? validateStep(active, draft) : {};

  function save() {
    const invalid = firstInvalidStep(draft);
    if (invalid !== null) {
      setActive(invalid);
      setErrorStep(invalid);
      toast({
        title: "Check this section",
        description: `“${STEPS[invalid - 1].title}” still needs an answer.`,
        tone: "warning",
      });
      return;
    }

    useProfileStore.getState().setProfile({
      ...draft,
      name: draft.name?.trim(),
      priorities: completePriorities(draft.priorities),
      currency: "INR",
      updatedAt: nowIso(),
    });
    toast({ title: "Profile updated", tone: "success" });
    router.back();
  }

  return (
    <>
      <EditTabs active={active} onSelect={setActive} />

      <Page>
        <StepComponent draft={draft} onChange={onChange} errors={errors} />
      </Page>

      <StickyFooter withNav>
        <Button fullWidth size="lg" onClick={save} rightIcon={<Check size={18} />}>
          Save
        </Button>
      </StickyFooter>
    </>
  );
}

function EditTabs({
  active,
  onSelect,
}: {
  active: number;
  onSelect: (step: number) => void;
}) {
  return (
    <AppHeader back title="Edit Profile">
      <div
        role="group"
        aria-label="Profile sections"
        className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3"
      >
        {STEPS.map((s) => (
          <Chip
            key={s.step}
            selected={active === s.step}
            className="h-9 px-3.5 text-[13px]"
            onClick={() => onSelect(s.step)}
          >
            {s.tab}
          </Chip>
        ))}
      </div>
    </AppHeader>
  );
}

/** Header + page wrapper used by the loading and empty states. */
function EditShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader back title="Edit Profile" />
      <Page>{children}</Page>
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingWizard } from "@/components/features/onboarding/OnboardingWizard";
import { Page } from "@/components/layout";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Get started",
  description: "Tell Cookwise about your diet, goals, kitchen and budget.",
};

/** `/onboarding` — the wizard reads `?step=`, so it needs a Suspense boundary. */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingWizard />
    </Suspense>
  );
}

function OnboardingFallback() {
  return (
    <Page noNav className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-[72px] rounded-2xl" />
      <Skeleton className="h-[72px] rounded-2xl" />
      <Skeleton className="h-[72px] rounded-2xl" />
    </Page>
  );
}

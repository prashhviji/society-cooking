"use client";

import { ArrowRight, ClipboardList, Leaf, Recycle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ComponentType } from "react";
import { Page } from "@/components/layout";
import { Button } from "@/components/ui";
import { useHydrated } from "@/lib/data/storage";
import { useProfileStore } from "@/lib/data/stores";

const FEATURES: { Icon: ComponentType<{ size?: number }>; label: string }[] = [
  { Icon: ClipboardList, label: "Track what you cook" },
  { Icon: Sparkles, label: "Get personalized meals" },
  { Icon: Leaf, label: "Preserve nutrients" },
  { Icon: Recycle, label: "Reduce food waste" },
];

/** Faint food-coloured glow in the four corners — no images, tokens only. */
const DECOR = [
  "radial-gradient(420px 300px at 6% -8%, var(--green-50), transparent 70%)",
  "radial-gradient(340px 260px at 104% 6%, var(--orange-50), transparent 70%)",
  "radial-gradient(360px 280px at -8% 102%, var(--orange-50), transparent 72%)",
  "radial-gradient(460px 340px at 108% 108%, var(--green-50), transparent 70%)",
].join(",");

/**
 * `/` — the splash. Redirects straight to `/home` once a completed profile has
 * rehydrated, so an onboarded user never sees this screen flash past.
 */
export function SplashScreen() {
  const router = useRouter();
  const hydrated = useHydrated();
  const profile = useProfileStore((s) => s.profile);
  const onboarded = profile?.onboardingComplete === true;

  useEffect(() => {
    if (hydrated && onboarded) router.replace("/home");
  }, [hydrated, onboarded, router]);

  // While the stores rehydrate (and while the redirect is in flight) only the
  // logo is shown, so the wrong screen never appears for a frame.
  const ready = hydrated && !onboarded;

  return (
    <Page noNav className="relative flex min-h-[100dvh] flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: DECOR }}
      />

      {!ready ? (
        <div className="relative flex flex-1 flex-col items-center justify-center">
          <LogoMark />
          <span className="sr-only" role="status">
            Loading Cookwise
          </span>
        </div>
      ) : (
        <>
          <div className="relative flex flex-1 flex-col justify-center gap-8 py-6">
            <header className="flex flex-col items-center text-center">
              <LogoMark />
              <h1 className="mt-4 text-[40px] leading-none font-extrabold tracking-tight text-primary lowercase">
                cookwise
              </h1>
              <p className="mt-2 text-[15px] font-medium text-text-2">
                Cook Smarter. Live Healthier.
              </p>
              <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-text-2">
                Your personal cooking companion that measures, guides and adapts.
              </p>
            </header>

            <ul className="mx-auto w-full max-w-[290px] space-y-3.5">
              {FEATURES.map(({ Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-primary"
                  >
                    <Icon size={18} />
                  </span>
                  <span className="text-[14px] font-medium text-text">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mt-auto space-y-3 pt-4">
            <Button
              fullWidth
              size="lg"
              href="/onboarding"
              rightIcon={<ArrowRight size={18} />}
            >
              Get Started
            </Button>
            {profile && (
              <Link
                href="/home"
                className="block rounded-md py-1 text-center text-[13px] text-text-2 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
              >
                Already onboarded?{" "}
                <span className="font-semibold text-primary">Continue</span>
              </Link>
            )}
          </div>
        </>
      )}
    </Page>
  );
}

function LogoMark() {
  return (
    <span
      aria-hidden="true"
      className="flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-primary text-primary-fg shadow-card"
    >
      <Leaf size={36} />
    </span>
  );
}

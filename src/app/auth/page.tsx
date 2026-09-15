"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Mail } from "lucide-react";
import { useAuth } from "@/lib/supabase/auth";

type Stage = "email" | "code";

export default function AuthPage() {
  const router = useRouter();
  const { user, loading, demo, signInWithOtp, verifyOtp } = useAuth();

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!demo && !loading && user) router.replace("/home");
  }, [demo, loading, user, router]);

  useEffect(() => {
    if (stage === "code") codeRef.current?.focus();
  }, [stage]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await signInWithOtp(email);
    setBusy(false);
    if (res.error) setError(res.error);
    else setStage("code");
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 6 || busy) return;
    setBusy(true);
    setError(null);
    const res = await verifyOtp(email, code);
    setBusy(false);
    if (res.error) setError(res.error);
    else router.replace("/home");
  }

  // ---------------------------------------------------------------- demo mode
  if (demo) {
    return (
      <main className="page page--no-nav flex min-h-dvh flex-col justify-center gap-6 fade-up">
        <Brand />
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 className="text-base font-semibold">You&apos;re all set</h2>
          <p className="mt-2 text-sm text-text-2">
            Running in local demo mode — connect Supabase to sync across devices.
          </p>
          <p className="mt-3 text-xs text-text-3">
            Set <code className="rounded bg-surface-2 px-1 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5">
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            </code>{" "}
            in <code className="rounded bg-surface-2 px-1 py-0.5">.env.local</code> to enable
            accounts.
          </p>
        </div>
        <Link
          href="/home"
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-fg transition-colors hover:bg-primary-strong"
        >
          Continue to Cookwise
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </main>
    );
  }

  // ------------------------------------------------------------ supabase mode
  return (
    <main className="page page--no-nav flex min-h-dvh flex-col justify-center gap-6 fade-up">
      {stage === "code" ? (
        <button
          type="button"
          onClick={() => {
            setStage("email");
            setCode("");
            setError(null);
          }}
          className="flex size-10 items-center justify-center self-start rounded-full border border-border bg-surface text-text-2"
          aria-label="Back to email"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
      ) : null}

      <Brand />

      {stage === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <label htmlFor="email" className="text-sm font-semibold">
              Email address
            </label>
            <p className="mt-1 text-xs text-text-2">
              We&apos;ll send you a 6-digit code. No password needed.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3">
              <Mail className="size-4 shrink-0 text-text-3" aria-hidden="true" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-text-3"
              />
            </div>
          </div>

          <ErrorNote error={error} />

          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-fg transition-colors hover:bg-primary-strong disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <>
                Send code
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <label htmlFor="code" className="text-sm font-semibold">
              Enter your code
            </label>
            <p className="mt-1 text-xs text-text-2">
              Sent to <span className="font-medium text-text">{email}</span>
            </p>
            <input
              ref={codeRef}
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="mt-3 h-14 w-full rounded-xl border border-border bg-surface-2 text-center font-mono text-2xl tracking-[0.4em] outline-none placeholder:text-text-3 focus:border-primary"
            />
          </div>

          <ErrorNote error={error} />

          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-fg transition-colors hover:bg-primary-strong disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <>
                Verify &amp; continue
                <Check className="size-4" aria-hidden="true" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={sendCode}
            disabled={busy}
            className="text-sm font-medium text-primary disabled:opacity-50"
          >
            Resend code
          </button>
        </form>
      )}

      <Link href="/home" className="text-center text-sm text-text-2 underline">
        Skip for now
      </Link>
    </main>
  );
}

function Brand() {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <div
        className="flex size-16 items-center justify-center rounded-2xl bg-primary text-3xl"
        aria-hidden="true"
      >
        🍳
      </div>
      <div>
        <h1 className="text-[22px] font-bold">Welcome to Cookwise</h1>
        <p className="mt-1 text-sm text-text-2">
          Cook smarter, live healthier.
        </p>
      </div>
    </header>
  );
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-xl bg-red-100 px-3 py-2 text-sm text-red-600"
    >
      {error}
    </p>
  );
}

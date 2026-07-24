"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginInner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const next = searchParams.get("next") ?? "/dashboard";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="mb-8 flex justify-center">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand font-serif text-lg font-bold text-brand-on shadow-sm">
            R
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-line bg-surface px-8 py-10 shadow-sm">
          <h1 className="text-center font-serif text-2xl font-medium tracking-tight text-ink">
            Sign in to ResumeLab
          </h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-muted">
            Your resumes, answers, and scores are private to your account.
          </p>

          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-ink shadow-sm transition hover:bg-sunken hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {/* Google G logo */}
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {loading ? "Redirecting to Google…" : "Continue with Google"}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-critical-tint px-3 py-2 text-center text-sm text-critical">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center font-mono text-xs text-muted">
          No password. No fabrications. Just facts.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

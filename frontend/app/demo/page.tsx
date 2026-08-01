"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function DemoLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [key, setKey] = useState(searchParams.get("key") ?? "");
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState("");
  const autoTriggered = useRef(false);

  // Auto-submit when ?key= is in the URL
  useEffect(() => {
    const urlKey = searchParams.get("key");
    if (urlKey && !autoTriggered.current) {
      autoTriggered.current = true;
      login(urlKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(demoKey: string) {
    if (!demoKey.trim()) return;
    setStatus("busy");
    setError("");

    try {
      // 1. Exchange demo key for a Supabase magic-link token
      const resp = await fetch(`${API}/auth/demo-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: demoKey.trim() }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail ?? `Error ${resp.status}`);
      }

      const { token, email } = await resp.json();

      // 2. Verify the OTP/magic-link token with Supabase to get a real session
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: token,
        email,
      });

      if (oauthError) throw new Error(oauthError.message);

      router.replace("/dashboard");
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
    }
  }

  const isAuto = !!searchParams.get("key");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        {/* Badge */}
        <div className="mb-6 flex justify-center">
          <span className="rounded-full border border-caution/30 bg-caution-tint px-3 py-1 font-mono text-xs text-caution">
            Demo access only
          </span>
        </div>

        <h1 className="mb-2 text-center font-serif text-2xl font-medium text-ink">
          ResumeLab reviewer login
        </h1>
        <p className="mb-8 text-center text-sm text-muted">
          For faculty review and testing. Enter the key you were given.
        </p>

        {status === "busy" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-brand" />
            <p className="text-sm text-muted">
              {isAuto ? "Signing in…" : "Verifying key…"}
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); login(key); }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                Demo key
              </label>
              <input
                autoFocus={!isAuto}
                type="password"
                className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:bg-paper"
                placeholder="Enter the demo key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>

            {status === "error" && (
              <p className="rounded-lg border border-critical/30 bg-critical-tint px-3 py-2 text-sm text-critical">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!key.trim()}
              className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-brand-on shadow-sm transition hover:bg-brand-strong disabled:opacity-50"
            >
              Sign in as reviewer
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          This account is read-only for review purposes.
          <br />
          Real users sign in with Google at{" "}
          <a href="/login" className="underline">
            /login
          </a>
          .
        </p>
      </div>
    </main>
  );
}

export default function DemoPage() {
  return (
    <Suspense>
      <DemoLoginForm />
    </Suspense>
  );
}

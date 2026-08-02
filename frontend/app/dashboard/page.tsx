import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/app/_components/brand-mark";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { SignOutButton } from "./signout-button";
import { UploadZone } from "./upload";
import { ResumeHistory } from "./history";
import { JdEnhancerPanel } from "./jd-panel";
import Link from "next/link";

export default async function Dashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* ── APP BAR ── */}
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrandMark size={30} />
            <span className="text-[15px] font-semibold tracking-tight text-ink">ResumeLab</span>
            <span className="hidden rounded-full bg-brand-tint px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-brand sm:inline">
              Beta
            </span>
          </Link>

          <div className="flex-1" />

          <ThemeToggle />
          <SignOutButton />

          <Link href="/profile" title="Your profile">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt="Your profile"
                className="h-8 w-8 shrink-0 rounded-full ring-2 ring-line transition hover:ring-brand"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint ring-2 ring-brand/20 transition hover:ring-brand">
                <span className="font-mono text-xs font-bold text-brand">
                  {(profile?.full_name?.[0] ?? profile?.email?.[0] ?? "?").toUpperCase()}
                </span>
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* ── HERO BANNER ── */}
      <div className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            Your Lab
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">
            Hello, {firstName}.
          </h1>
          <p className="mt-2 text-sm text-muted">
            {profile?.email ?? user.email}
            <span className="mx-2 text-line-strong">·</span>
            Everything is free during beta.
          </p>

          {/* Quick-action pills */}
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="#upload"
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink-soft shadow-sm transition hover:border-brand hover:text-brand"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload resume
            </a>
            <a
              href="#jd"
              className="flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-tint px-4 py-1.5 text-xs font-semibold text-brand shadow-sm transition hover:bg-brand hover:text-white"
            >
              <span className="text-[11px]">✦</span>
              Tailor for a job
            </a>
            <Link
              href="/score"
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink-soft shadow-sm transition hover:border-brand hover:text-brand"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Quick Score
            </Link>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT — two-column on large screens ── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px] lg:items-start">

          {/* ── LEFT: Upload + History ── */}
          <div className="space-y-10">
            <section id="upload">
              <UploadZone />
            </section>

            <section>
              <ResumeHistory />
            </section>
          </div>

          {/* ── RIGHT: JD Tailoring panel ── */}
          <aside id="jd" className="lg:sticky lg:top-[72px]">
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
              Job Tailoring
            </p>
            <JdEnhancerPanel />
          </aside>
        </div>
      </main>
    </div>
  );
}

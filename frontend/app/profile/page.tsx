import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/app/_components/brand-mark";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import Link from "next/link";

export const metadata = { title: "Your profile – ResumeLab" };

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, avatar_url, credits, is_free_user, created_at")
    .eq("id", user.id)
    .single();

  // Resume count
  const { count: resumeCount } = await supabase
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Version count
  const { count: versionCount } = await supabase
    .from("versions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Outcomes count
  const { count: outcomeCount } = await supabase
    .from("outcomes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n: string) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : (profile?.email?.[0] ?? "?").toUpperCase();

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="font-semibold tracking-tight text-ink">ResumeLab</span>
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
          <Link
            href="/dashboard"
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-sunken"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20 pt-10">
        {/* Hero row */}
        <div className="flex items-center gap-5 pb-8 border-b border-line">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-20 w-20 shrink-0 rounded-full ring-2 ring-line"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-tint ring-2 ring-brand/20">
              <span className="font-mono text-2xl font-bold text-brand">{initials}</span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-medium text-ink">
              {profile?.full_name ?? "Your account"}
            </h1>
            <p className="mt-0.5 text-sm text-muted">{profile?.email ?? user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-0.5 font-mono text-xs font-semibold ${
                profile?.is_free_user
                  ? "bg-brand-tint text-brand-strong"
                  : "bg-sunken text-ink-soft"
              }`}>
                {profile?.is_free_user ? "Free access" : "Standard"}
              </span>
              {memberSince && (
                <span className="text-xs text-muted">Member since {memberSince}</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Resumes uploaded", value: resumeCount ?? 0 },
            { label: "Versions generated", value: versionCount ?? 0 },
            { label: "Applications tracked", value: outcomeCount ?? 0 },
            { label: "JD credits", value: profile?.credits ?? 0 },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-line bg-surface p-4 shadow-sm"
            >
              <p className="font-mono text-2xl font-bold tabular-nums text-ink">{value}</p>
              <p className="mt-1 text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>

        {/* Account info */}
        <div className="mt-8">
          <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">
            Account
          </h2>
          <div className="divide-y divide-line rounded-xl border border-line bg-surface shadow-sm">
            {[
              { label: "Full name", value: profile?.full_name ?? "Not set" },
              { label: "Email", value: profile?.email ?? user.email ?? "Not set" },
              { label: "User ID", value: user.id, mono: true },
              {
                label: "Plan",
                value: profile?.is_free_user
                  ? "Free access (flagged by admin)"
                  : "Standard",
              },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
                <span className="shrink-0 text-sm text-muted">{label}</span>
                <span className={`min-w-0 truncate text-right text-sm text-ink ${mono ? "font-mono text-xs" : ""}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* JD Credits */}
        <div className="mt-8">
          <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">
            JD Enhancer Credits
          </h2>
          <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-3xl font-bold tabular-nums text-ink">
                  {profile?.credits ?? 0}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Credits remaining · each credit = one JD tailoring run
                </p>
              </div>
              <Link
                href="/dashboard"
                className="rounded-xl border border-brand/30 bg-brand-tint px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/20"
              >
                Get credits →
              </Link>
            </div>
            {(profile?.credits ?? 0) === 0 && !profile?.is_free_user && (
              <p className="mt-4 rounded-lg border border-caution/30 bg-caution-tint px-3 py-2.5 text-sm text-caution">
                You have no credits. Purchase credits on the dashboard to use the JD Enhancer.
              </p>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-8">
          <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">
            Quick links
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:bg-sunken"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-tint text-brand">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Dashboard</p>
                <p className="text-xs text-muted">Upload and manage resumes</p>
              </div>
            </Link>
            <Link
              href="/score"
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:bg-sunken"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-tint text-violet">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">ATS Score check</p>
                <p className="text-xs text-muted">Score any resume instantly</p>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

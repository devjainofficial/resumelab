import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/app/_components/brand-mark";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { SignOutButton } from "./signout-button";
import { UploadZone } from "./upload";
import { ResumeHistory } from "./history";
import Link from "next/link";

export default async function Dashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, avatar_url, is_free_user")
    .eq("id", user.id)
    .single();

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <>
      {/* ── APP BAR ── */}
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <div className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="font-semibold tracking-tight text-ink">ResumeLab</span>
            <span className="rounded-full bg-brand-tint px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-brand">
              Beta
            </span>
          </div>

          <div className="flex-1" />

          <ThemeToggle />

          <Link
            href="/score"
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-sunken"
          >
            Quick Score
          </Link>

          <SignOutButton />

          <Link href="/profile" title="Your profile">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt="Your profile"
                className="h-8 w-8 shrink-0 rounded-full ring-1 ring-line transition hover:ring-brand"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint ring-1 ring-brand/30 transition hover:ring-brand">
                <span className="font-mono text-xs font-bold text-brand">
                  {(profile?.full_name?.[0] ?? profile?.email?.[0] ?? "?").toUpperCase()}
                </span>
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* ── GREETING ── */}
      <div className="border-b border-line bg-paper">
        <div className="mx-auto max-w-4xl px-6 pb-8 pt-10">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {profile?.email ?? user.email} · Everything is free during beta.
          </p>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-8 space-y-10">
        <UploadZone />
        <ResumeHistory />
      </main>
    </>
  );
}

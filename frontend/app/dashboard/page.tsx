import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandLockup } from "@/app/_components/brand-mark";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { SignOutButton } from "./signout-button";
import { UploadZone } from "./upload";
import { ResumeHistory } from "./history";
import { JdEnhancerPanel } from "./jd-panel";
import Link from "next/link";

export const metadata: Metadata = { title: "Dashboard" };

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
            <BrandLockup height={22} />
            <span className="hidden rounded-full bg-brand-tint px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-brand sm:inline">
              Beta
            </span>
          </Link>

          <div className="flex-1" />

          <span className="hidden text-sm text-muted sm:inline">
            Hello, {firstName}
          </span>

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

      {/* ── MAIN CONTENT ── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        {/*
          Mobile order:  Upload → JD panel → History
          Desktop order: [Upload  ] [JD panel (sticky, spans 2 rows)]
                         [History ]
        */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] lg:items-start">

          {/* 1 — Upload (col 1 row 1 on desktop) */}
          <section id="upload" className="lg:col-start-1 lg:row-start-1">
            <UploadZone />
          </section>

          {/* 2 — JD panel (col 2 rows 1-2 on desktop, between upload+history on mobile) */}
          <aside
            id="jd"
            className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-[72px]"
          >
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
              Job Tailoring
            </p>
            <JdEnhancerPanel />
          </aside>

          {/* 3 — History (col 1 row 2 on desktop) */}
          <section id="history" className="lg:col-start-1 lg:row-start-2">
            <ResumeHistory />
          </section>
        </div>
      </main>
    </div>
  );
}

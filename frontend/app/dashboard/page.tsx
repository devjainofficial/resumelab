import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/app/_components/brand-mark";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { SignOutButton } from "./signout-button";
import { UploadZone } from "./upload";
import { ResumeHistory } from "./history";

export default async function Dashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, avatar_url, credits, is_free_user")
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
          </div>

          <div className="flex-1" />

          <ThemeToggle />

          {/* JD credits chip */}
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-sunken px-3 py-1 font-mono text-xs">
            <span className="text-muted">JD credits</span>
            <span className="font-semibold tabular-nums text-ink">
              {profile?.credits ?? 0}
            </span>
          </div>

          <SignOutButton />

          {profile?.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full ring-1 ring-line"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      </header>

      {/* ── GREETING ── */}
      <div className="border-b border-line bg-paper">
        <div className="mx-auto max-w-4xl px-6 pb-8 pt-10">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-1 text-sm text-muted">
            {profile?.is_free_user ? "Free access" : "Standard"} ·{" "}
            {profile?.email ?? user.email}
          </p>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-8">
        <UploadZone />
        <ResumeHistory />
      </main>
    </>
  );
}

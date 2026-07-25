import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/app/_components/brand-mark";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import Link from "next/link";
import { QuickScorer } from "./quick-scorer";

export const metadata = { title: "Check your ATS score – ResumeLab" };

export default async function ScorePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="font-semibold tracking-tight text-ink">ResumeLab</span>
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-sunken"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-sunken"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-20 pt-12">
        <div className="mb-10 text-center">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">
            How does your resume score?
          </h1>
          <p className="mt-2 text-base text-muted">
            Upload any resume. Get an instant ATS breakdown — no account needed.
          </p>
        </div>
        <QuickScorer />
      </main>
    </>
  );
}

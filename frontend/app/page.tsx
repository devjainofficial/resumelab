import Link from "next/link";
import { BrandMark } from "./_components/brand-mark";
import { ResumeComparison } from "./_components/resume-comparison";
import { BackToTop } from "./_components/back-to-top";
import { ThemeToggle } from "./_components/theme-toggle";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* ── NAV ── */}
      <header id="top" className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="font-semibold tracking-tight text-ink">ResumeLab</span>
          </Link>

          <div className="flex-1" />

          <nav className="hidden items-center gap-6 text-sm text-ink-soft sm:flex">
            <a href="#how-it-works" className="transition hover:text-ink">How it works</a>
            <a href="#modes" className="transition hover:text-ink">Features</a>
          </nav>

          <ThemeToggle />
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:bg-sunken"
          >
            <GoogleIcon />
            Sign in
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="dot-grid relative overflow-hidden border-b border-line bg-paper py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">

            {/* Text side */}
            <div>
              <p className="mb-4 font-mono text-xs uppercase tracking-widest text-brand">
                Resume Lab · Score Repair · JD Enhancer
              </p>
              <h1 className="mb-5 font-serif text-5xl font-medium leading-[1.1] tracking-tight text-ink">
                Your resume,<br />
                <em className="not-italic text-brand">truthfully</em> better.
              </h1>
              <p className="mb-8 max-w-md text-base leading-relaxed text-ink-soft">
                Upload your resume, answer a few focused questions, and get a
                one-page ATS-ready PDF — built only from facts you provided.
                We&nbsp;never invent a number, employer, or achievement.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-on shadow-sm transition hover:bg-brand-strong"
                >
                  <GoogleIcon />
                  Get started free
                </Link>
                <Link
                  href="/score"
                  className="flex items-center gap-2 rounded-md border border-line px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-sunken hover:text-ink"
                >
                  Check my score free →
                </Link>
              </div>
              <p className="mt-6 font-mono text-xs text-muted">
                Free for Resume Lab core &amp; Score Repair · JD Enhancer uses credits
              </p>
            </div>

            {/* Before/after resume comparison */}
            <div>
              <ResumeComparison />
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM STRIP ── */}
      <section className="border-b border-line bg-sunken py-16">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-10 font-mono text-xs uppercase tracking-widest text-muted">
            The problem with most resume tools
          </p>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              {
                heading: "A number, not a fix",
                body: "Resume Worded tells you your score is 47. It doesn't tell you which three bullets to rewrite or what number to add.",
              },
              {
                heading: "AI that fabricates",
                body: "Most AI resume writers invent metrics, exaggerate roles, and add employers you never worked for. That's a liability in an interview.",
              },
              {
                heading: "Templates, not strategy",
                body: "A beautiful template fails if the underlying content doesn't pass ATS parse-back. Most tools optimise for looks, not legibility.",
              },
            ].map(({ heading, body }) => (
              <div key={heading} className="border-l-2 border-line-strong pl-5">
                <h3 className="mb-2 font-semibold text-ink">{heading}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="border-b border-line bg-paper py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
            How it works
          </p>
          <h2 className="mb-12 font-serif text-3xl font-medium tracking-tight text-ink">
            Three steps. One truthful resume.
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Upload & parse",
                body: "Drop your existing resume (PDF or DOCX). We extract every fact — no hallucinations. Duplicate uploads cost zero tokens.",
              },
              {
                n: "02",
                title: "Answer the gaps",
                body: "A focused wizard asks only what's missing — up to 10 questions, ordered by score impact. Every answer becomes a sourced fact.",
              },
              {
                n: "03",
                title: "Download & score",
                body: "Get a one-page ATS-ready PDF and DOCX. A free built-in scorer shows a per-check breakdown. Drop in a Resume Worded screenshot to repair weak spots.",
              },
            ].map(({ n, title, body }) => (
              <div key={n} className="rounded-lg border border-line bg-surface p-6">
                <span className="mb-4 block font-mono text-xs font-semibold text-brand">
                  {n}
                </span>
                <h3 className="mb-2 font-semibold text-ink">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODES ── */}
      <section id="modes" className="border-b border-line bg-sunken py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
            Three modes
          </p>
          <h2 className="mb-10 font-serif text-3xl font-medium tracking-tight text-ink">
            Start anywhere, finish stronger.
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="rounded-lg border border-brand/30 bg-brand-tint p-6">
              <div className="mb-3">
                <span className="rounded bg-brand px-2 py-0.5 font-mono text-xs font-semibold text-brand-on">
                  Free
                </span>
              </div>
              <h3 className="mb-2 font-semibold text-ink">Resume Lab</h3>
              <p className="text-sm leading-relaxed text-ink-soft">
                Upload → parse → wizard → rewrite → PDF + DOCX. Full ATS score with a per-check breakdown. The core loop, always free.
              </p>
            </div>
            <div className="rounded-lg border border-caution/30 bg-caution-tint p-6">
              <div className="mb-3">
                <span className="rounded bg-caution px-2 py-0.5 font-mono text-xs font-semibold text-paper">
                  Free
                </span>
              </div>
              <h3 className="mb-2 font-semibold text-ink">Score Repair</h3>
              <p className="text-sm leading-relaxed text-ink-soft">
                Paste Resume Worded feedback or drop in a screenshot. We extract every finding and apply targeted patches — no full rewrites, no invented metrics.
              </p>
            </div>
            <div className="rounded-lg border border-violet/30 bg-violet-tint p-6">
              <div className="mb-3">
                <span className="rounded bg-violet px-2 py-0.5 font-mono text-xs font-semibold text-paper">
                  Credits
                </span>
              </div>
              <h3 className="mb-2 font-semibold text-ink">JD Enhancer</h3>
              <p className="text-sm leading-relaxed text-ink-soft">
                Paste a job description against a finished resume. Keyword mirroring, skills reorder, summary tailoring — only where truthful.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROMISE GRID ── */}
      <section className="border-b border-line bg-paper py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
            The no-fabrication contract
          </p>
          <h2 className="mb-10 font-serif text-3xl font-medium tracking-tight text-ink">
            We will never&hellip;
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              "Invent a metric, team size, or revenue figure you didn't provide",
              "Add an employer, role, or project that isn't in your source material",
              "Generate a FINAL resume with open placeholder gaps",
              "Call an LLM when deterministic logic is sufficient — and log every call that does happen",
            ].map((promise) => (
              <div key={promise} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
                <span className="mt-0.5 shrink-0 font-mono text-sm text-critical" aria-hidden="true">
                  ✕
                </span>
                <p className="text-sm leading-relaxed text-ink-soft">{promise}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DARK CTA ── */}
      <section className="bg-ink py-24">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="mb-4 font-serif text-4xl font-medium tracking-tight text-paper">
            Ready to build a resume<br />you can stand behind?
          </h2>
          <p className="mx-auto mb-10 max-w-md text-base leading-relaxed text-paper/60">
            Free to start. No card required. Your data is private and isolated to your account.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-brand px-6 py-3 text-sm font-semibold text-brand-on shadow-sm transition hover:bg-brand-strong"
          >
            <GoogleIcon />
            Continue with Google — it&apos;s free
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-line bg-paper py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={20} />
            <span className="font-mono text-xs text-muted">ResumeLab</span>
          </Link>
          <p className="font-mono text-xs text-muted">
            Built on truth · Your data never trains a model
          </p>
        </div>
      </footer>

      <BackToTop />
    </>
  );
}

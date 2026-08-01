import type { CSSProperties } from "react";
import Link from "next/link";
import { BrandMark } from "./_components/brand-mark";
import { ResumeComparison } from "./_components/resume-comparison";
import { BackToTop } from "./_components/back-to-top";
import { ThemeToggle } from "./_components/theme-toggle";
import { QuickScorer } from "./score/quick-scorer";

const DARK_BG = "#0B0D0B";
const DARK_BORDER = "rgba(255,255,255,0.07)";
const DARK_TEXT = "#F1F3F0";
const DARK_MUTED = "rgba(241,243,240,0.55)";
const ACCENT = "#49AE9E";
const ACCENT_ON = "#0B0D0B";
const DOT_GRID: CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(73,174,158,0.13) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
};

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

function CheckIcon() {
  return (
    <svg className="h-3 w-3 text-brand" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.485 1.929L5.5 9.914 2.515 6.929A1 1 0 001.1 8.343l3.693 3.693a1 1 0 001.414 0l8.692-8.693a1 1 0 00-1.414-1.414z" />
    </svg>
  );
}

/* ── static criterion preview used in feature section ──────────────────────── */
function CriteriaPreview() {
  const items = [
    { label: "Impact",     score: 14, max: 27 },
    { label: "Language",   score: 18, max: 22 },
    { label: "Depth",      score: 16, max: 19 },
    { label: "Structure",  score: 12, max: 17 },
    { label: "Job match",  score:  0, max: 15 },
  ];
  const total = items.reduce((s, i) => s + i.score, 0);

  function barColor(pct: number) {
    if (pct >= 0.8) return "#22c55e";
    if (pct >= 0.5) return "#f59e0b";
    if (pct === 0)  return "rgba(255,255,255,0.12)";
    return "#ef4444";
  }

  return (
    <div
      className="overflow-hidden rounded-2xl shadow-2xl"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-red-500/60" />
          <div className="h-2 w-2 rounded-full bg-amber-500/60" />
          <div className="h-2 w-2 rounded-full bg-green-500/60" />
        </div>
        <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          resume_v2.pdf
        </span>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl font-bold text-amber-400">{total}</span>
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>/100</span>
        </div>
      </div>

      {/* Criteria bars */}
      <div className="space-y-3.5 p-5">
        {items.map((c) => {
          const pct = c.max > 0 ? c.score / c.max : 0;
          return (
            <div key={c.label}>
              <div className="mb-1.5 flex justify-between text-xs">
                <span style={{ color: "rgba(255,255,255,0.75)" }} className="font-medium">
                  {c.label}
                </span>
                <span className="font-mono tabular-nums" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {c.score}/{c.max}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct * 100}%`, background: barColor(pct) }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tips */}
      <div
        className="space-y-2 px-5 pb-5 pt-2"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p className="text-xs font-medium text-amber-400">
          Fix: add team size, %, or latency numbers to 5 bullets → +8 pts
        </p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          Job match: paste a JD above to unlock +15 pts
        </p>
      </div>
    </div>
  );
}

/* ── static score repair preview ───────────────────────────────────────────── */
function ScoreRepairPreview() {
  const findings = [
    { label: "Quantify impact", count: 6, color: "#ef4444" },
    { label: "Weak language",   count: 4, color: "#f59e0b" },
    { label: "Buzzwords",       count: 3, color: "#f59e0b" },
    { label: "Verb variety",    count: 2, color: "#f59e0b" },
  ];
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <div className="border-b border-line px-4 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Resume Worded findings — extracted from screenshot
          </p>
        </div>
        <div className="divide-y divide-line/40">
          {findings.map((f) => (
            <div key={f.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-ink">{f.label}</span>
              <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: f.color }}>
                {f.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="text-center">
          <p className="font-mono text-3xl font-bold text-red-500 tabular-nums">47</p>
          <p className="mt-0.5 text-xs text-muted">Before</p>
        </div>
        <svg className="h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
        <div className="text-center">
          <p className="font-mono text-3xl font-bold text-green-600 tabular-nums">83</p>
          <p className="mt-0.5 text-xs text-muted">After</p>
        </div>
      </div>
      <p className="text-center font-mono text-xs text-muted">
        4 targeted patches · 0 fabrications · no full rewrite
      </p>
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <>
      {/* ── NAV ── */}
      <header
        className="sticky top-0 z-30 backdrop-blur-md"
        style={{ background: "rgba(11,13,11,0.92)", borderBottom: `1px solid ${DARK_BORDER}` }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={26} />
            <span className="font-semibold tracking-tight" style={{ color: DARK_TEXT }}>
              ResumeLab
            </span>
          </Link>

          <div className="flex-1" />

          <nav className="hidden items-center gap-6 text-sm sm:flex" style={{ color: DARK_MUTED }}>
            <a href="#scorer" className="transition hover:text-white">Score my resume</a>
            <a href="#features" className="transition hover:text-white">How it works</a>
          </nav>

          <ThemeToggle />

          <Link
            href="/login"
            className="flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition hover:bg-white/10"
            style={{
              background: "rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.8)",
              border: `1px solid ${DARK_BORDER}`,
            }}
          >
            <GoogleIcon />
            Sign in
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden py-28"
        style={{ background: DARK_BG, ...DOT_GRID }}
      >
        {/* Bottom fade */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-32"
          style={{ background: `linear-gradient(to bottom, transparent, ${DARK_BG})` }}
        />

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          {/* Badge */}
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium"
            style={{
              background: "rgba(73,174,158,0.12)",
              color: ACCENT,
              border: "1px solid rgba(73,174,158,0.28)",
            }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#49AE9E]" />
            Free · No login needed to score
          </div>

          <h1
            className="mb-5 text-balance font-serif text-5xl font-medium leading-[1.1] tracking-tight sm:text-[60px]"
            style={{ color: DARK_TEXT }}
          >
            Know your ATS score<br />
            <em className="not-italic" style={{ color: ACCENT }}>before you apply.</em>
          </h1>

          <p
            className="mx-auto mb-8 max-w-lg text-base leading-relaxed sm:text-lg"
            style={{ color: DARK_MUTED }}
          >
            Upload any resume. See the 5 dimensions dragging your score down —
            with a one-line fix for each. Then let us rewrite it.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{ background: ACCENT, color: ACCENT_ON }}
            >
              <GoogleIcon />
              Get started free
            </Link>
            <a
              href="#scorer"
              className="flex items-center gap-1.5 rounded-md px-5 py-2.5 text-sm font-medium transition hover:bg-white/10"
              style={{
                background: "rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.7)",
                border: `1px solid ${DARK_BORDER}`,
              }}
            >
              Check my score first →
            </a>
          </div>
        </div>
      </section>

      {/* ── LIVE SCORER (Slice C) ── */}
      <section id="scorer" className="border-b border-line bg-paper py-16">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-8 text-center">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-brand">
              Try it free — no account needed
            </p>
            <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">
              Your ATS score in 10 seconds.
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Same scoring logic as top ATS checkers. No LLM — fully deterministic.
            </p>
          </div>
          <QuickScorer />
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="border-b border-line bg-sunken py-10">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-3 sm:divide-x sm:divide-line">
            {[
              { stat: "0 LLM calls",  label: "Scoring is fully deterministic — always free" },
              { stat: "5 criteria",   label: "Impact · Language · Depth · Structure · Job match" },
              { stat: "100% private", label: "Files are never stored or used to train a model" },
            ].map(({ stat, label }) => (
              <div key={stat} className="sm:px-8 first:pl-0 last:pr-0">
                <p className="font-mono text-xl font-bold text-ink">{stat}</p>
                <p className="mt-1 text-xs text-ink-soft">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="border-b border-line bg-paper">

        {/* Feature 1 — criterion scoring */}
        <div className="border-b border-line py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div>
                <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brand">
                  Built-in scorer
                </p>
                <h2 className="mb-4 font-serif text-3xl font-medium leading-snug tracking-tight text-ink">
                  Know exactly what&rsquo;s<br />holding you back.
                </h2>
                <p className="mb-6 text-base leading-relaxed text-ink-soft">
                  Most ATS checkers give you a number. We give you 5 criterion groups —
                  Impact, Language, Depth, Structure, Job match — each with a specific
                  finding and a one-line fix you can act on today.
                </p>
                <ul className="space-y-3">
                  {[
                    "Per-check breakdown, not just a total score",
                    "Contextual page count — 2 pages is fine after 7 years of experience",
                    "Verb variety, quantification ratio, buzzword detection",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-ink-soft">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/15">
                        <CheckIcon />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className="rounded-2xl p-6"
                style={{ background: DARK_BG, ...DOT_GRID }}
              >
                <CriteriaPreview />
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2 — no fabrication */}
        <div className="border-b border-line py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div
                className="order-2 rounded-2xl p-6 lg:order-1"
                style={{ background: DARK_BG }}
              >
                <ResumeComparison />
              </div>

              <div className="order-1 lg:order-2">
                <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brand">
                  No-fabrication contract
                </p>
                <h2 className="mb-4 font-serif text-3xl font-medium leading-snug tracking-tight text-ink">
                  Every word from<br />your source material.
                </h2>
                <p className="mb-6 text-base leading-relaxed text-ink-soft">
                  Most AI resume writers invent metrics and exaggerate roles. We do the
                  opposite: if a number is missing, we ask you. A resume that survives
                  any interview question because it&rsquo;s built from facts only you know.
                </p>
                <div className="space-y-2.5">
                  {[
                    "Invent a metric, team size, or revenue figure you didn't provide",
                    "Add an employer, role, or project not in your source material",
                    "Generate a FINAL with open placeholder gaps",
                    "Call an LLM when deterministic logic is sufficient",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-2.5"
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-red-500">
                        ✕
                      </span>
                      <p className="text-sm text-ink-soft">
                        <span className="font-medium text-ink">Never: </span>
                        {item.toLowerCase()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 3 — score repair */}
        <div className="py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div>
                <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brand">
                  Score Repair
                </p>
                <h2 className="mb-4 font-serif text-3xl font-medium leading-snug tracking-tight text-ink">
                  Already on Resume Worded?<br />Bring your screenshot.
                </h2>
                <p className="mb-6 text-base leading-relaxed text-ink-soft">
                  Drop in a screenshot of your Resume Worded results page. We extract every
                  finding category and count, then apply targeted patches to your resume.
                  No full rewrite. No invented numbers. We&rsquo;ve seen scores jump 65→83
                  from a single screenshot.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-on transition hover:bg-brand-strong"
                >
                  Try Score Repair — free →
                </Link>
              </div>

              <ScoreRepairPreview />
            </div>
          </div>
        </div>

      </section>

      {/* ── JD ENHANCER CALLOUT ── */}
      <section className="border-b border-line bg-sunken py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="rounded-2xl border border-violet/30 bg-violet-tint p-8 sm:p-10">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="mb-2 font-mono text-xs uppercase tracking-widest text-violet">
                  JD Enhancer · Credits
                </p>
                <h3 className="mb-2 font-serif text-xl font-medium text-ink">
                  Tailoring for a specific role?
                </h3>
                <p className="text-sm leading-relaxed text-ink-soft">
                  Paste a job description. We mirror keywords, reorder skills, and tailor
                  your summary — only where truthful. Zero new facts introduced.
                </p>
              </div>
              <Link
                href="/login"
                className="whitespace-nowrap rounded-md bg-violet px-5 py-2.5 text-sm font-semibold text-paper transition hover:opacity-90"
              >
                Try JD Enhancer →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── DARK CTA ── */}
      <section className="py-28" style={{ background: DARK_BG }}>
        <div className="mx-auto max-w-5xl px-6 text-center" style={DOT_GRID}>
          <h2
            className="mb-4 text-balance font-serif text-4xl font-medium tracking-tight sm:text-5xl"
            style={{ color: DARK_TEXT }}
          >
            A resume you can defend<br />in every interview.
          </h2>
          <p
            className="mx-auto mb-10 max-w-md text-base leading-relaxed"
            style={{ color: DARK_MUTED }}
          >
            Free to start. No card required. Your data stays private and isolated
            to your account.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{ background: ACCENT, color: ACCENT_ON }}
            >
              <GoogleIcon />
              Continue with Google — it&apos;s free
            </Link>
            <a
              href="#scorer"
              className="rounded-md px-5 py-3 text-sm font-medium transition hover:bg-white/10"
              style={{
                background: "rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.6)",
                border: `1px solid ${DARK_BORDER}`,
              }}
            >
              Score my resume first
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="py-8"
        style={{ background: DARK_BG, borderTop: `1px solid ${DARK_BORDER}` }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={20} />
            <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              ResumeLab
            </span>
          </Link>
          <div className="flex gap-6">
            <a
              href="#scorer"
              className="font-mono text-xs transition hover:text-white"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Score my resume
            </a>
            <Link
              href="/login"
              className="font-mono text-xs transition hover:text-white"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Sign in
            </Link>
          </div>
          <p className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Built on truth · Data never trains a model
          </p>
        </div>
      </footer>

      <BackToTop />
    </>
  );
}

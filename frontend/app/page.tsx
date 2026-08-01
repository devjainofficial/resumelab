import type { CSSProperties } from "react";
import Link from "next/link";
import { BrandMark } from "./_components/brand-mark";
import { BackToTop } from "./_components/back-to-top";
import { FeatureTabs } from "./_components/feature-tabs";

// ─── design tokens (hardcoded — marketing page is always light) ───────────────
// Do NOT use CSS-variable-based Tailwind classes (bg-paper, text-ink, etc.)
// on this page; those classes respect the user's dark-mode preference but this
// page is intentionally always-light regardless of OS/app theme setting.
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  text:         "#0F172A",   // slate-900
  soft:         "#475569",   // slate-600
  muted:        "#94A3B8",   // slate-400
  bg:           "#FFFFFF",
  subtle:       "#F8FAFC",   // slate-50
  border:       "rgba(15,23,42,0.07)",
  brand:        "#0F766E",   // teal-700
  brandVivid:   "#14B8A6",   // teal-400
  green:        "#10B981",   // emerald-500
  amber:        "#F59E0B",   // amber-500
  red:          "#EF4444",   // red-500
  btnGrad:      "linear-gradient(135deg, #0F766E 0%, #2563EB 100%)",
  btnShadow:    "0 4px 20px rgba(15,118,110,0.28), 0 2px 8px rgba(15,118,110,0.14)",
} as const;

const HERO_BG: CSSProperties = {
  background: [
    "radial-gradient(ellipse 100% 80% at 12% -10%, rgba(20,184,166,0.14) 0%, transparent 55%)",
    "radial-gradient(ellipse 80% 60% at 88%  -5%, rgba(99,102,241,0.10) 0%, transparent 50%)",
    "#FFFFFF",
  ].join(", "),
};

// ─── shared primitives ────────────────────────────────────────────────────────

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

function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

// macOS window chrome (traffic-light dots + monospace title)
function WindowChrome({ title }: { title: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "10px 14px",
      background: "#F3F4F6",
      borderBottom: `1px solid ${T.border}`,
    }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57", display: "block", flexShrink: 0 }} />
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FEBC2E", display: "block", flexShrink: 0 }} />
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28C840", display: "block", flexShrink: 0 }} />
      <span style={{
        flex: 1, textAlign: "center",
        fontSize: 11, color: T.muted,
        fontFamily: "monospace",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        margin: "0 8px",
      }}>
        {title}
      </span>
    </div>
  );
}

function barColor(pct: number): string {
  if (pct >= 0.85) return "#10B981";
  if (pct >= 0.55) return "#F59E0B";
  if (pct === 0)   return "rgba(0,0,0,0.1)";
  return "#EF4444";
}

// ─── hero floating windows ────────────────────────────────────────────────────

function HeroScoreWindow() {
  const SCORE = 72;
  const R = 20;
  const CIRC = 2 * Math.PI * R;
  const items = [
    { label: "Impact",    score: 18, max: 27 },
    { label: "Language",  score: 20, max: 22 },
    { label: "Depth",     score: 19, max: 19 },
    { label: "Structure", score: 11, max: 17 },
    { label: "Job match", score:  0, max: 15 },
  ];
  return (
    <div style={{
      background: "#FFF",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      boxShadow: "0 24px 72px rgba(0,0,0,0.11), 0 6px 20px rgba(0,0,0,0.07)",
      overflow: "hidden",
    }}>
      <WindowChrome title="ATS Analysis — resume_final.pdf" />
      <div style={{ padding: "18px 20px" }}>
        {/* Score ring */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ position: "relative", width: 54, height: 54, flexShrink: 0 }}>
            <svg viewBox="0 0 48 48" width="54" height="54">
              <circle cx="24" cy="24" r={R} fill="none" stroke="#F1F5F9" strokeWidth="5" />
              <g transform="rotate(-90 24 24)">
                <circle cx="24" cy="24" r={R} fill="none" stroke={T.amber} strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - SCORE / 100)} />
              </g>
            </svg>
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: T.text }}>
              {SCORE}
            </span>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0 }}>ATS Score · {SCORE}/100</p>
            <p style={{ fontSize: 12, color: T.amber, margin: "3px 0 0" }}>Needs improvement</p>
          </div>
        </div>

        {/* Criteria bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {items.map(c => {
            const pct = c.max > 0 ? c.score / c.max : 0;
            return (
              <div key={c.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 500, color: "#334155" }}>{c.label}</span>
                  <span style={{ fontFamily: "monospace", color: T.muted }}>{c.score}/{c.max}</span>
                </div>
                <div style={{ height: 5, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(0, pct * 100)}%`, background: barColor(pct), borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Tip */}
        <div style={{ marginTop: 14, padding: "9px 11px", background: "rgba(245,158,11,0.08)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.18)" }}>
          <p style={{ fontSize: 11, color: "#B45309", fontWeight: 500, margin: 0 }}>
            Fix: add team sizes, %, or latency numbers to 4 bullets → +8 pts
          </p>
        </div>

        {/* CTA inside window */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginTop: 12,
          padding: "9px 14px",
          borderRadius: 8,
          background: T.btnGrad,
          color: "#FFF",
          fontSize: 12,
          fontWeight: 600,
        }}>
          Fix this with Resume Lab
          <ArrowRight size={13} />
        </div>
      </div>
    </div>
  );
}

function HeroBeforeAfterCard() {
  return (
    <div style={{
      background: "#FFF",
      borderRadius: 12,
      border: `1px solid ${T.border}`,
      boxShadow: "0 12px 40px rgba(0,0,0,0.09), 0 3px 10px rgba(0,0,0,0.05)",
      overflow: "hidden",
    }}>
      <WindowChrome title="Before vs After" />
      <div style={{ padding: "14px" }}>
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: T.red, margin: "0 0 5px" }}>Before</p>
          <div style={{ background: "#FEF2F2", borderRadius: 6, padding: "8px 10px" }}>
            <p style={{ fontSize: 11, color: "#7F1D1D", lineHeight: 1.5, margin: 0 }}>
              Was responsible for developing features and fixing bugs in the codebase.
            </p>
          </div>
        </div>
        <div>
          <p style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: T.green, margin: "0 0 5px" }}>After</p>
          <div style={{ background: "#F0FDF4", borderRadius: 6, padding: "8px 10px" }}>
            <p style={{ fontSize: 11, color: "#14532D", lineHeight: 1.5, margin: 0 }}>
              Led <strong>4 microservices</strong> at <strong>500K req/day</strong>, 99.9% uptime; cut p99 latency <strong>60%</strong>.
            </p>
          </div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.border}`, textAlign: "center" }}>
          <p style={{ fontSize: 10, color: T.muted, margin: 0, fontFamily: "monospace" }}>+39 pts · one session · 0 fabrications</p>
        </div>
      </div>
    </div>
  );
}

function HeroRepairBadge() {
  return (
    <div style={{
      background: "#FFF",
      borderRadius: 12,
      border: `1px solid ${T.border}`,
      boxShadow: "0 12px 40px rgba(0,0,0,0.09), 0 3px 10px rgba(0,0,0,0.05)",
      padding: "18px 16px",
      textAlign: "center",
    }}>
      <p style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: T.muted, margin: "0 0 12px" }}>Score Repair</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontFamily: "monospace", fontSize: 34, fontWeight: 700, color: T.red, lineHeight: 1 }}>47</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <span style={{ fontFamily: "monospace", fontSize: 34, fontWeight: 700, color: T.green, lineHeight: 1 }}>83</span>
      </div>
      <p style={{ fontSize: 10, color: T.muted, margin: "0 0 10px", lineHeight: 1.5 }}>4 patches · 0 fabrications</p>
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
        <p style={{ fontSize: 10, color: T.brand, fontWeight: 500, margin: 0 }}>from one screenshot</p>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2" style={{ textDecoration: "none" }}>
            <BrandMark size={26} />
            <span style={{ fontWeight: 600, fontSize: 15, color: T.text, letterSpacing: "-0.01em" }}>ResumeLab</span>
          </Link>

          <div className="flex-1" />

          {/* Links — hidden on mobile */}
          <nav className="hidden items-center gap-6 sm:flex">
            <a href="#features" style={{ fontSize: 13, color: T.soft, textDecoration: "none" }}
              className="transition-colors hover:text-slate-900">How it works</a>
            <a href="/score" style={{ fontSize: 13, color: T.soft, textDecoration: "none" }}
              className="transition-colors hover:text-slate-900">Score free</a>
          </nav>

          {/* Auth CTAs */}
          <Link href="/login" style={{
            padding: "6px 14px",
            fontSize: 13, fontWeight: 500,
            color: T.soft,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            textDecoration: "none",
            background: T.subtle,
          }}
            className="hidden sm:inline-flex transition-colors hover:text-slate-900">
            Sign in
          </Link>

          <Link href="/login" style={{
            padding: "7px 16px",
            fontSize: 13, fontWeight: 600,
            color: "#FFF",
            borderRadius: 8,
            textDecoration: "none",
            background: T.btnGrad,
          }}>
            Start free →
          </Link>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section style={{ ...HERO_BG, paddingTop: 80 }}>
        <div className="mx-auto max-w-4xl px-6 text-center">
          {/* Badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 14px",
            borderRadius: 100,
            fontSize: 12, fontWeight: 500,
            color: T.brand,
            background: "rgba(15,118,110,0.08)",
            border: "1px solid rgba(15,118,110,0.2)",
            marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.brand, flexShrink: 0 }} />
            Free to start · No credit card needed
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: "clamp(44px, 7.5vw, 76px)",
            fontWeight: 500,
            lineHeight: 1.04,
            letterSpacing: "-0.025em",
            color: T.text,
            margin: "0 0 22px",
          }}>
            Get shortlisted.
            <br />
            <span style={{ color: T.brand }}>Not just scored.</span>
          </h1>

          {/* Sub */}
          <p style={{
            fontSize: "clamp(15px, 2vw, 18px)",
            lineHeight: 1.65,
            color: T.soft,
            maxWidth: 500,
            margin: "0 auto 36px",
          }}>
            Upload your resume. See your ATS score in 10 seconds. Fix it with our wizard, using only what you give us.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 64 }}>
            <Link href="/login" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              color: "#FFF",
              background: T.btnGrad,
              textDecoration: "none",
              boxShadow: T.btnShadow,
            }}>
              <GoogleIcon />
              Start free with Google
            </Link>

            <Link href="/score" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "12px 20px",
              borderRadius: 10,
              fontSize: 14, fontWeight: 500,
              color: T.soft,
              border: `1px solid ${T.border}`,
              background: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              backdropFilter: "blur(8px)",
            }}>
              Score my resume first
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Floating product windows */}
        <div className="relative mx-auto max-w-5xl px-6">
          {/* Mobile — single card, centered */}
          <div className="px-4 pb-10 lg:hidden">
            <div className="mx-auto max-w-sm">
              <HeroScoreWindow />
            </div>
          </div>

          {/* Desktop — 3-column tilted card grid.
              `display` must NOT be in the style prop — it would override
              the hidden / lg:grid Tailwind classes. Only layout props go here. */}
          <div
            className="hidden pb-6 lg:grid"
            style={{
              gridTemplateColumns: "252px 1fr 200px",
              gap: 20,
              alignItems: "start",
            }}
          >
            <div style={{ marginTop: 40, transform: "rotate(-3.5deg)", transformOrigin: "center top" }}>
              <HeroBeforeAfterCard />
            </div>
            <HeroScoreWindow />
            <div style={{ marginTop: 60, transform: "rotate(2.5deg)", transformOrigin: "center top" }}>
              <HeroRepairBadge />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ─────────────────────────────────────────────────────── */}
      <section style={{
        background: T.subtle,
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        padding: "32px 0",
      }}>
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-3">
            {[
              { stat: "0 LLM calls",   desc: "Scoring is deterministic. Same file, same result, every time." },
              { stat: "5 criteria",    desc: "Impact · Language · Depth · Structure · Job match" },
              { stat: "100% private",  desc: "Your files are never stored or used to train a model" },
            ].map(({ stat, desc }) => (
              <div key={stat} style={{ padding: "0 16px" }}>
                <p style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: T.text, margin: "0 0 4px" }}>{stat}</p>
                <p style={{ fontSize: 12, color: T.soft, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section id="features" style={{ background: "#FFF", padding: "80px 0" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div style={{ marginBottom: 48 }}>
            <p style={{ fontFamily: "monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: T.brand, margin: "0 0 10px" }}>
              How it works
            </p>
            <h2 style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: T.text,
              margin: 0,
              lineHeight: 1.2,
            }}>
              Five features, one product.
            </h2>
          </div>

          <FeatureTabs />
        </div>
      </section>

      {/* ── NO-FABRICATION PROMISE ───────────────────────────────────────────── */}
      <section style={{
        background: T.subtle,
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        padding: "80px 0",
      }}>
        <div className="mx-auto max-w-5xl px-6">
          <div style={{ marginBottom: 40 }}>
            <p style={{ fontFamily: "monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: T.red, margin: "0 0 10px" }}>
              No-fabrication contract
            </p>
            <h2 style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "clamp(26px, 3.5vw, 38px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: T.text,
              margin: 0,
            }}>
              What we promise
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              "Invent a metric, team size, or revenue figure you didn't provide",
              "Add an employer, role, or project not in your source material",
              "Generate a FINAL resume with any open placeholder gaps",
              "Call an LLM when deterministic logic is sufficient",
            ].map(item => (
              <div key={item} style={{
                display: "flex",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                background: "#FFF",
              }}>
                <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: T.red, marginTop: 2, flexShrink: 0 }}>✕</span>
                <p style={{ fontSize: 14, color: T.soft, margin: 0, lineHeight: 1.55 }}>{item}</p>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 24, fontSize: 13, color: T.muted, maxWidth: 520, lineHeight: 1.65 }}>
            Every claim in your resume is traced to either your uploaded file or a wizard answer you gave. There is no third source.
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section style={{ background: "#FFF", padding: "96px 0" }}>
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: "clamp(32px, 5vw, 56px)",
            fontWeight: 500,
            letterSpacing: "-0.025em",
            color: T.text,
            margin: "0 0 18px",
            lineHeight: 1.08,
          }}>
            A resume you can defend
            <br />in every interview.
          </h2>
          <p style={{
            fontSize: 16,
            color: T.soft,
            margin: "0 auto 44px",
            maxWidth: 420,
            lineHeight: 1.65,
          }}>
            Free to start. No card required. Your data is private and never shared.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link href="/login" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              borderRadius: 11,
              fontSize: 15, fontWeight: 600,
              color: "#FFF",
              background: T.btnGrad,
              textDecoration: "none",
              boxShadow: T.btnShadow,
            }}>
              <GoogleIcon />
              Continue with Google, free
            </Link>

            <Link href="/score" style={{
              padding: "14px 24px",
              borderRadius: 11,
              fontSize: 15, fontWeight: 500,
              color: T.soft,
              border: `1px solid ${T.border}`,
              background: T.subtle,
              textDecoration: "none",
            }}>
              Score my resume first
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{
        background: T.subtle,
        borderTop: `1px solid ${T.border}`,
        padding: "32px 0",
      }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
            <BrandMark size={18} />
            <span style={{ fontSize: 12, fontFamily: "monospace", color: T.muted }}>ResumeLab</span>
          </Link>

          <div style={{ display: "flex", gap: 20 }}>
            {[
              { label: "Score my resume", href: "/score" },
              { label: "Sign in",         href: "/login" },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ fontSize: 12, fontFamily: "monospace", color: T.muted, textDecoration: "none" }}>
                {l.label}
              </Link>
            ))}
          </div>

          <p style={{ fontSize: 12, fontFamily: "monospace", color: T.muted, margin: 0 }}>
            No fabrication. No data training.
          </p>
        </div>
      </footer>

      <BackToTop />
    </>
  );
}

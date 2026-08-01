"use client";

import { useState } from "react";
import type { ReactNode } from "react";

function barColor(pct: number): string {
  if (pct >= 0.85) return "#10B981";
  if (pct >= 0.55) return "#F59E0B";
  if (pct === 0) return "rgba(0,0,0,0.1)";
  return "#EF4444";
}

/* ── tab 1: ATS score breakdown ─────────────────────────────────────────── */
function ScoreMockup() {
  const SCORE = 59;
  const R = 18;
  const CIRC = 2 * Math.PI * R;
  const items = [
    { label: "Impact",    score: 14, max: 27 },
    { label: "Language",  score: 18, max: 22 },
    { label: "Depth",     score: 16, max: 19 },
    { label: "Structure", score: 11, max: 17 },
    { label: "Job match", score:  0, max: 15 },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ position: "relative", width: 54, height: 54, flexShrink: 0 }}>
          <svg viewBox="0 0 44 44" width="54" height="54">
            <circle cx="22" cy="22" r={R} fill="none" stroke="#F1F5F9" strokeWidth="4" />
            <g transform="rotate(-90 22 22)">
              <circle cx="22" cy="22" r={R} fill="none" stroke="#F59E0B" strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - SCORE / 100)} />
            </g>
          </svg>
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "#0F172A" }}>
            {SCORE}
          </span>
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#0F172A", margin: 0 }}>ATS Score · {SCORE}/100</p>
          <p style={{ fontSize: 12, color: "#F59E0B", margin: "3px 0 0" }}>Needs improvement</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map(c => {
          const pct = c.max > 0 ? c.score / c.max : 0;
          return (
            <div key={c.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                <span style={{ fontWeight: 500, color: "#334155" }}>{c.label}</span>
                <span style={{ fontFamily: "monospace", color: "#94A3B8" }}>{c.score}/{c.max}</span>
              </div>
              <div style={{ height: 5, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(0, pct * 100)}%`, background: barColor(pct), borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: "10px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.2)" }}>
        <p style={{ fontSize: 12, color: "#B45309", fontWeight: 500, margin: 0 }}>
          Fix: add team sizes, %, or latency numbers to 5 bullets → +8 pts
        </p>
      </div>
    </div>
  );
}

/* ── tab 2: wizard question ─────────────────────────────────────────────── */
function RewriteMockup() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= 3 ? "#0F766E" : "#F1F5F9" }} />
        ))}
        <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "monospace", whiteSpace: "nowrap", marginLeft: 6 }}>3 / 7</span>
      </div>

      <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "16px", border: "1px solid rgba(0,0,0,0.07)" }}>
        <p style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", margin: "0 0 8px" }}>Question 3 of 7</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", margin: "0 0 14px", lineHeight: 1.4 }}>
          How many engineers were on your team at TechCorp?
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
          {["1–3", "4–8", "9–20", "20+", "Solo", "Skip"].map(opt => (
            <button key={opt} style={{
              padding: "7px 8px",
              borderRadius: 7,
              border: `1px solid ${opt === "4–8" ? "#0F766E" : "rgba(0,0,0,0.09)"}`,
              background: opt === "4–8" ? "#F0FDFA" : "#FFFFFF",
              color: opt === "4–8" ? "#0F766E" : "#475569",
              fontSize: 12,
              fontWeight: opt === "4–8" ? 600 : 400,
              cursor: "pointer",
            }}>{opt}</button>
          ))}
        </div>
      </div>

      <div style={{ background: "rgba(240,253,250,0.8)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(15,118,110,0.18)" }}>
        <p style={{ fontSize: 11, color: "#94A3B8", margin: "0 0 5px" }}>Preview — will generate</p>
        <p style={{ fontSize: 13, color: "#0F172A", margin: 0, lineHeight: 1.55 }}>
          <span style={{ color: "#0F766E", fontWeight: 600 }}>Led 6-engineer team</span> shipping 3 microservices at 1.2M req/day, 99.9% uptime
        </p>
      </div>
    </div>
  );
}

/* ── tab 3: score repair ────────────────────────────────────────────────── */
function RepairMockup() {
  const findings = [
    { label: "Quantify impact", count: 6, color: "#EF4444" },
    { label: "Weak language",   count: 4, color: "#F59E0B" },
    { label: "Buzzwords",       count: 3, color: "#F59E0B" },
    { label: "Verb variety",    count: 2, color: "#F59E0B" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ overflow: "hidden", borderRadius: 10, border: "1px solid rgba(0,0,0,0.07)" }}>
        <div style={{ padding: "9px 14px", background: "#F8FAFC", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <p style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", margin: 0 }}>Findings extracted from screenshot</p>
        </div>
        {findings.map(f => (
          <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: 13, color: "#334155" }}>{f.label}</span>
            <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: f.color }}>{f.count}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "8px 0" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "monospace", fontSize: 30, fontWeight: 700, color: "#EF4444", margin: 0, lineHeight: 1 }}>47</p>
          <p style={{ fontSize: 11, color: "#94A3B8", margin: "4px 0 0" }}>Before</p>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "monospace", fontSize: 30, fontWeight: 700, color: "#10B981", margin: 0, lineHeight: 1 }}>83</p>
          <p style={{ fontSize: 11, color: "#94A3B8", margin: "4px 0 0" }}>After</p>
        </div>
      </div>
      <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", margin: 0 }}>4 targeted patches · 0 fabrications · no full rewrite</p>
    </div>
  );
}

/* ── tab 4: JD tailoring ────────────────────────────────────────────────── */
function TailorMockup() {
  const matched = ["Python", "API design", "Kubernetes", "distributed systems"];
  const addable = ["gRPC", "observability", "Go"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "14px", border: "1px solid rgba(0,0,0,0.07)" }}>
        <p style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", margin: "0 0 12px" }}>JD keyword coverage</p>

        <p style={{ fontSize: 11, fontWeight: 500, color: "#64748B", margin: "0 0 7px" }}>Matched ({matched.length})</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {matched.map(k => (
            <span key={k} style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 500, background: "#F0FDFA", color: "#0F766E", border: "1px solid rgba(15,118,110,0.2)" }}>
              ✓ {k}
            </span>
          ))}
        </div>

        <p style={{ fontSize: 11, fontWeight: 500, color: "#64748B", margin: "0 0 7px" }}>Can truthfully add ({addable.length})</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {addable.map(k => (
            <span key={k} style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 500, background: "#FEFCE8", color: "#854D0E", border: "1px solid rgba(234,179,8,0.25)" }}>
              + {k}
            </span>
          ))}
        </div>
      </div>

      <div style={{ background: "#F0FDFA", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(15,118,110,0.15)" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#0F766E", margin: "0 0 5px" }}>Summary rewritten for role</p>
        <p style={{ fontSize: 12, color: "#334155", margin: 0, lineHeight: 1.6 }}>Backend engineer with 4 yrs building distributed systems in Python, Kubernetes, and API design at TechCorp…</p>
      </div>
    </div>
  );
}

/* ── tab 5: outcomes tracking ───────────────────────────────────────────── */
function TrackMockup() {
  const apps = [
    { co: "Stripe",  role: "Backend Engineer",    date: "Jul 28", result: "call",    color: "#10B981" },
    { co: "Linear",  role: "Software Engineer",   date: "Jul 25", result: "pending", color: "#F59E0B" },
    { co: "Vercel",  role: "Infrastructure Eng",  date: "Jul 20", result: "no-call", color: "#EF4444" },
    { co: "Turso",   role: "Developer Advocate",  date: "Jul 15", result: "call",    color: "#10B981" },
  ];
  function rl(r: string) {
    if (r === "call") return "✓ Callback";
    if (r === "pending") return "… Pending";
    return "✗ No call";
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {apps.map((a, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.07)", background: "#FAFAFA" }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${a.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: a.color, flexShrink: 0 }}>
            {a.co[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#0F172A", margin: 0 }}>{a.co}</p>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.role}</p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: a.color, margin: 0 }}>{rl(a.result)}</p>
            <p style={{ fontSize: 11, color: "#CBD5E1", margin: 0 }}>{a.date}</p>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 28, justifyContent: "center", paddingTop: 8 }}>
        {[
          { val: "4", label: "Applied", color: "#0F172A" },
          { val: "2", label: "Callbacks", color: "#10B981" },
          { val: "50%", label: "Call rate", color: "#0F766E" },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: s.color, margin: 0 }}>{s.val}</p>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: "3px 0 0" }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── tabs config ─────────────────────────────────────────────────────────── */
type Tab = { id: string; label: string; desc: string; content: ReactNode };

const TABS: Tab[] = [
  {
    id: "score",
    label: "Score your resume",
    desc: "5-dimension ATS analysis. A specific, actionable fix for each finding.",
    content: <ScoreMockup />,
  },
  {
    id: "rewrite",
    label: "Rewrite from source",
    desc: "Answer a few focused questions. A one-page resume built from facts you give us. No invented numbers.",
    content: <RewriteMockup />,
  },
  {
    id: "repair",
    label: "Repair from feedback",
    desc: "Drop in a Resume Worded screenshot. Targeted patches only. No full rewrites, no invented numbers.",
    content: <RepairMockup />,
  },
  {
    id: "tailor",
    label: "Target the role",
    desc: "Paste a job description. Keywords mirrored, skills reordered, summary tailored. Only where it actually fits.",
    content: <TailorMockup />,
  },
  {
    id: "track",
    label: "Track your results",
    desc: "Log applications and outcomes. See which resume version gets callbacks. Compound your learnings.",
    content: <TrackMockup />,
  },
];

/* ── main export ─────────────────────────────────────────────────────────── */
export function FeatureTabs() {
  const [active, setActive] = useState(0);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
      {/* Tab list — attio-style vertical nav with progressive dimming */}
      <nav aria-label="Features">
        {TABS.map((tab, i) => {
          const isActive = i === active;
          const dist = Math.abs(i - active);
          const opacity = isActive ? 1 : Math.max(0.28, 1 - dist * 0.2);

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(i)}
              aria-selected={isActive}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                padding: "12px 16px 12px 13px",
                borderTop: "none",
                borderRight: "none",
                borderBottom: "none",
                borderLeft: `3px solid ${isActive ? "#0F766E" : "transparent"}`,
                borderRadius: 0,
                background: isActive ? "rgba(15,118,110,0.05)" : "transparent",
                opacity,
                transition: "opacity 0.2s ease, background 0.15s ease, border-left-color 0.15s ease",
              }}
            >
              <p style={{
                fontSize: 14,
                fontWeight: isActive ? 600 : 450,
                color: isActive ? "#0F766E" : "#334155",
                margin: 0,
                lineHeight: 1.4,
              }}>
                {tab.label}
              </p>
              {isActive && (
                <p style={{ fontSize: 12, color: "#64748B", margin: "5px 0 0", lineHeight: 1.55 }}>
                  {tab.desc}
                </p>
              )}
            </button>
          );
        })}
      </nav>

      {/* Content panel */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.07)",
          padding: "24px 26px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)",
          minHeight: 360,
        }}
      >
        <p style={{
          fontFamily: "monospace",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#94A3B8",
          margin: "0 0 18px",
        }}>
          {TABS[active].label}
        </p>
        {TABS[active].content}
      </div>
    </div>
  );
}

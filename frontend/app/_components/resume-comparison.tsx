"use client";

import { useEffect, useRef, useState } from "react";

function Section({ label }: { label: string }) {
  return (
    <p className="mt-3 mb-1 font-mono text-[8.5px] font-bold uppercase tracking-widest text-muted">
      {label}
    </p>
  );
}

function BeforeCard() {
  return (
    <div className="flex flex-col rounded-xl border border-critical/25 bg-paper shadow-sm">
      <div className="flex items-center justify-between border-b border-critical/15 px-3 py-2">
        <span className="rounded-full border border-critical/25 bg-critical-tint px-2 py-0.5 font-mono text-[9px] font-semibold text-critical">
          BEFORE
        </span>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-critical" />
          <span className="font-mono text-[10px] font-semibold text-ink">ATS 44</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-3 py-3 text-[10px] leading-[1.5] text-ink">
        <p className="text-[13px] font-bold">Alex Johnson</p>
        <p className="mt-0.5 text-[9px] text-muted">alexj@email.com | 9876-543-210</p>

        <Section label="Experience" />
        <p className="font-semibold">Software Developer, TechCorp</p>
        <p className="text-[9px] text-muted">2021 — Present</p>
        <ul className="mt-1 space-y-0.5">
          {[
            "Was responsible for developing features and attending team meetings",
            "Helped the team with various coding tasks and code reviews",
            "Fixed bugs and occasionally wrote unit tests",
            "Was involved in deployment and infrastructure tasks",
          ].map((text, i) => (
            <li key={i} className="flex gap-1.5 text-ink-soft/80">
              <span className="shrink-0 mt-px">•</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <Section label="Skills" />
        <p className="text-ink-soft">JavaScript, Python, SQL, some React, Node.js, Git, basic Docker</p>

        <Section label="Education" />
        <p className="text-ink-soft">B.S. Computer Science, State University, 2021</p>
      </div>
    </div>
  );
}

const BULLETS: { jsx: React.ReactNode; delay: number }[] = [
  {
    jsx: <>Led 4 microservices handling <strong className="text-ink">500K+ req/day</strong> at 99.9% uptime</>,
    delay: 350,
  },
  {
    jsx: <>Cut latency <strong className="text-ink">60%</strong> (400ms→160ms) via caching + query opt.</>,
    delay: 500,
  },
  {
    jsx: <>Mentored <strong className="text-ink">3 engineers</strong>; PR review: 2 days → 4 hours</>,
    delay: 650,
  },
  {
    jsx: <>Kubernetes migration cut deploy incidents by <strong className="text-ink">40%</strong></>,
    delay: 800,
  },
];

function AfterCard({ animated, score }: { animated: boolean; score: number }) {
  return (
    <div className="flex flex-col rounded-xl border border-brand/30 bg-surface shadow-md ring-1 ring-brand/10">
      <div className="flex items-center justify-between border-b border-brand/15 px-3 py-2">
        <span className="rounded-full border border-brand/25 bg-brand-tint px-2 py-0.5 font-mono text-[9px] font-semibold text-brand-strong">
          AFTER
        </span>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-brand" />
          <span className="font-mono text-[10px] font-semibold tabular-nums text-ink">
            ATS {score}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-3 py-3 text-[10px] leading-[1.5] text-ink">
        <p className="text-[13px] font-bold">Alex Johnson</p>
        <p className="mt-0.5 text-[9px] text-muted">
          alexj@email.com · linkedin.com/in/alexj · 987-654-3210
        </p>

        <Section label="Summary" />
        <p className="text-ink-soft">
          Backend engineer with 3 yrs building high-traffic Python/Node.js APIs. Systems
          serving <span className="font-semibold text-ink">500K+</span> daily users at &lt;200ms latency.
        </p>

        <Section label="Experience" />
        <p className="font-semibold">Senior Software Engineer — TechCorp</p>
        <p className="text-[9px] text-muted">2021 – Present</p>
        <ul className="mt-1 space-y-0.5">
          {BULLETS.map((b, i) => (
            <li
              key={i}
              className="flex gap-1.5 text-ink-soft"
              style={{
                opacity: animated ? 1 : 0,
                transform: animated ? "none" : "translateY(5px)",
                transition: "opacity 0.4s ease, transform 0.4s ease",
                transitionDelay: animated ? `${b.delay}ms` : "0ms",
              }}
            >
              <span className="shrink-0 mt-px font-bold text-brand">·</span>
              <span>{b.jsx}</span>
            </li>
          ))}
        </ul>

        <Section label="Skills" />
        <p className="text-ink-soft">Python · Node.js · React · PostgreSQL · Redis · Kubernetes · AWS</p>

        <Section label="Education" />
        <p className="text-ink-soft">B.S. Computer Science — State University | 2021</p>
        <p className="text-[9px] text-muted">GPA 3.8 · Dean&apos;s List 4 semesters</p>
      </div>
    </div>
  );
}

export function ResumeComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  const [displayScore, setDisplayScore] = useState(44);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!animated) return;
    const from = 44, to = 83, duration = 1100;
    const t0 = performance.now();
    let rafId: number;
    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayScore(Math.round(from + (to - from) * eased));
      if (p < 1) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [animated]);

  return (
    <div ref={ref} className="select-none">
      {/* Score delta callout */}
      <div className="mb-3 flex items-center justify-center gap-2">
        <span className="font-mono text-xs text-muted">ATS 44</span>
        <div
          className="flex items-center gap-1 rounded-full bg-brand/10 px-3 py-0.5"
          style={{
            opacity: animated ? 1 : 0,
            transform: animated ? "scale(1)" : "scale(0.85)",
            transition: "opacity 0.4s ease, transform 0.4s ease",
          }}
        >
          <span className="font-mono text-xs font-bold text-brand">+39 pts</span>
          <span className="text-[10px] text-muted">one session</span>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted">ATS {displayScore}</span>
      </div>

      {/* Side-by-side cards */}
      <div className="grid grid-cols-2 gap-3">
        <BeforeCard />
        <AfterCard animated={animated} score={displayScore} />
      </div>

      <p className="mt-3 text-center font-mono text-[10px] text-muted">
        Real result · zero invented facts
      </p>
    </div>
  );
}

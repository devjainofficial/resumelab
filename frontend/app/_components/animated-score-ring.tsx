"use client";

import { useEffect, useRef } from "react";

// r=60 viewBox=160×160, circumference = 2π×60 ≈ 376.99
const R = 60;
const CX = 80;
const CY = 80;
const CIRC = 2 * Math.PI * R;
const FROM = 44;
const TO = 83;
const OFFSET_FROM = CIRC * (1 - FROM / 100); // ≈ 211.1
const OFFSET_TO = CIRC * (1 - TO / 100);     // ≈ 64.1

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedScoreRing() {
  const arcRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const arc = arcRef.current;
    const num = numRef.current;
    if (!arc || !num) return;

    const svg = arc.closest("svg");
    if (!svg) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated.current) return;
        hasAnimated.current = true;

        const duration = 1400;
        const start = performance.now();

        function step(now: number) {
          const t = Math.min(1, (now - start) / duration);
          const eased = easeOutCubic(t);

          arc!.style.strokeDashoffset = String(
            OFFSET_FROM + (OFFSET_TO - OFFSET_FROM) * eased
          );
          num!.textContent = String(Math.round(FROM + (TO - FROM) * eased));

          if (t < 1) requestAnimationFrame(step);
        }

        // Brief pause so the viewer registers the starting number
        setTimeout(() => requestAnimationFrame(step), 350);
      },
      { threshold: 0.6 }
    );

    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Before label + small ring */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">
            Before
          </span>
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
              <circle
                cx="32" cy="32" r="26"
                fill="none"
                stroke="var(--line-strong)"
                strokeWidth="6"
              />
              <g transform="rotate(-90 32 32)">
                <circle
                  cx="32" cy="32" r="26"
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (1 - FROM / 100)}`}
                />
              </g>
            </svg>
            <span className="absolute font-mono text-sm font-semibold text-muted">
              {FROM}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-muted">
          <span className="font-mono text-lg">→</span>
        </div>

        {/* After — animated */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-xs uppercase tracking-widest text-brand">
            After
          </span>
          <div className="relative flex h-[140px] w-[140px] items-center justify-center">
            <svg
              viewBox="0 0 160 160"
              width="140"
              height="140"
              aria-label={`ATS score improved from ${FROM} to ${TO}`}
            >
              {/* Track */}
              <circle
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke="var(--line)"
                strokeWidth="12"
              />
              {/* Animated fill */}
              <g transform={`rotate(-90 ${CX} ${CY})`}>
                <circle
                  ref={arcRef}
                  cx={CX} cy={CY} r={R}
                  fill="none"
                  stroke="var(--brand)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${CIRC}`}
                  strokeDashoffset={`${OFFSET_FROM}`}
                />
              </g>
            </svg>
            {/* Number centred over SVG */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span
                ref={numRef}
                className="font-mono text-4xl font-bold tabular-nums text-ink"
              >
                {FROM}
              </span>
              <span className="font-mono text-xs text-muted">/100</span>
            </div>
          </div>
        </div>
      </div>

      <p className="font-mono text-xs text-muted">
        +{TO - FROM} pts · one session · zero invented facts
      </p>
    </div>
  );
}

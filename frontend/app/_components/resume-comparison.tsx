"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function BeforeResume() {
  return (
    <div className="text-[11px] leading-[1.55] text-ink">
      <p className="text-[15px] font-bold">Alex Johnson</p>
      <p className="mt-0.5 text-[10px] text-muted">alexj@email.com | 9876-543-210</p>

      <div className="mt-4">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted">Experience</p>
        <p className="mt-1 font-semibold">Software Developer, TechCorp</p>
        <p className="text-[10px] text-muted">2021 — Present</p>
        <ul className="mt-1.5 space-y-1 text-ink-soft">
          <li>• Was responsible for developing features for the main product and attended team meetings regularly</li>
          <li>• Helped the team with various coding tasks and participated in code reviews as needed</li>
          <li>• Fixed bugs and occasionally wrote unit tests when required by the team lead</li>
          <li>• Was involved in deployment and infrastructure tasks from time to time</li>
        </ul>
      </div>

      <div className="mt-4">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted">Skills</p>
        <p className="mt-1 text-ink-soft">JavaScript, Python, SQL, some React, Node.js, Git, basic Docker</p>
      </div>

      <div className="mt-4">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted">Education</p>
        <p className="mt-1 text-ink-soft">B.S. Computer Science, State University, 2021</p>
      </div>
    </div>
  );
}

function AfterResume() {
  return (
    <div className="text-[11px] leading-[1.55] text-ink">
      <p className="text-[15px] font-bold">Alex Johnson</p>
      <p className="mt-0.5 text-[10px] text-muted">
        alexj@email.com · linkedin.com/in/alexj · 987-654-3210
      </p>

      <div className="mt-3">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted">Summary</p>
        <p className="mt-1 text-ink-soft">
          Backend engineer with 3 yrs building high-traffic Python/Node.js APIs. Systems serving{" "}
          <span className="font-semibold text-ink">500K+</span> daily users at &lt;200ms latency.
        </p>
      </div>

      <div className="mt-3">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted">Experience</p>
        <p className="mt-1 font-semibold">Senior Software Engineer — TechCorp</p>
        <p className="text-[10px] text-muted">2021 – Present</p>
        <ul className="mt-1.5 space-y-1">
          <li className="flex gap-1.5 text-ink-soft">
            <span className="shrink-0 font-bold text-brand">·</span>
            Led 4 microservices handling{" "}
            <span className="font-semibold text-ink">500K+ req/day</span> at 99.9% uptime
          </li>
          <li className="flex gap-1.5 text-ink-soft">
            <span className="shrink-0 font-bold text-brand">·</span>
            Cut latency <span className="font-semibold text-ink">60%</span> (400ms→160ms) via
            caching + query opt.
          </li>
          <li className="flex gap-1.5 text-ink-soft">
            <span className="shrink-0 font-bold text-brand">·</span>
            Mentored <span className="font-semibold text-ink">3 engineers</span>; PR review: 2
            days → 4 hours
          </li>
          <li className="flex gap-1.5 text-ink-soft">
            <span className="shrink-0 font-bold text-brand">·</span>
            Kubernetes migration cut deploy incidents by{" "}
            <span className="font-semibold text-ink">40%</span>
          </li>
        </ul>
      </div>

      <div className="mt-3">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted">Skills</p>
        <p className="mt-1 text-ink-soft">
          Python · Node.js · React · PostgreSQL · Redis · Kubernetes · AWS
        </p>
      </div>

      <div className="mt-3">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted">Education</p>
        <p className="mt-1 text-ink-soft">B.S. Computer Science — State University | 2021</p>
        <p className="text-[10px] text-muted">GPA 3.8 · Dean&apos;s List 4 semesters</p>
      </div>
    </div>
  );
}

export function ResumeComparison() {
  const [pos, setPos] = useState(46);
  const [hint, setHint] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const clamp = (v: number) => Math.max(14, Math.min(86, v));

  const updateFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPos(clamp(((clientX - rect.left) / rect.width) * 100));
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return;
      updateFromClientX(e.clientX);
    }
    function onUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [updateFromClientX]);

  function onHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    isDragging.current = true;
    setHint(false);
    document.body.style.cursor = "col-resize";
  }

  function onTouchMove(e: React.TouchEvent) {
    updateFromClientX(e.touches[0].clientX);
    setHint(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden rounded-2xl border border-line shadow-lg"
      style={{ height: 460 }}
    >
      {/* AFTER — bottom layer, full size */}
      <div className="absolute inset-0 overflow-hidden bg-surface px-5 py-5">
        <AfterResume />
      </div>

      {/* BEFORE — top layer, clipped on right */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden bg-paper px-5 py-5"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <BeforeResume />
      </div>

      {/* Labels */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-critical/20 bg-critical-tint px-2.5 py-0.5 font-mono text-[10px] font-semibold text-critical">
        BEFORE
      </div>
      <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-brand/20 bg-brand-tint px-2.5 py-0.5 font-mono text-[10px] font-semibold text-brand-strong">
        AFTER
      </div>

      {/* Score badges */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg border border-critical/20 bg-surface/90 px-2.5 py-1 backdrop-blur-sm">
        <div className="h-1.5 w-1.5 rounded-full bg-critical" />
        <span className="font-mono text-[10px] font-semibold text-ink">ATS 44</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-brand/20 bg-surface/90 px-2.5 py-1 backdrop-blur-sm">
        <div className="h-1.5 w-1.5 rounded-full bg-brand" />
        <span className="font-mono text-[10px] font-semibold text-ink">ATS 83</span>
      </div>

      {/* Drag handle */}
      <div
        className="absolute bottom-0 top-0 z-10 cursor-col-resize"
        style={{ left: `calc(${pos}% - 16px)`, width: 32 }}
        onMouseDown={onHandleMouseDown}
        onTouchMove={onTouchMove}
        onTouchStart={() => setHint(false)}
      >
        {/* Divider line */}
        <div className="absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-brand/60" />
        {/* Knob */}
        <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand shadow-md">
          <svg
            className="h-3.5 w-3.5 text-brand-on"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-4 3 4 3M16 9l4 3-4 3" />
          </svg>
        </div>
      </div>

      {/* Drag hint pill */}
      {hint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center">
          <div className="animate-pulse rounded-full bg-ink/60 px-3 py-1 font-mono text-[10px] text-paper backdrop-blur-sm">
            ← drag to compare →
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type Stage = "parse" | "analyze" | "compose";

const STAGE_LINES: Record<Stage, string[]> = {
  parse: [
    "extract text blocks",
    "parse contact fields",
    "detect section boundaries",
    "map experience bullets",
    "validate parse fidelity",
  ],
  analyze: [
    "load resume graph",
    "run gap detector",
    "check quantification ratio",
    "order questions by impact",
    "build question set",
  ],
  compose: [
    "load structure spec",
    "map facts to template",
    "apply bullet lint rules",
    "compose prose",
    "render final document",
  ],
};

function inferStage(message: string): Stage {
  const m = message.toLowerCase();
  if (
    m.includes("build") ||
    m.includes("rebuild") ||
    m.includes("compos") ||
    m.includes("rewrite") ||
    m.includes("re-read") ||
    m.includes("template") ||
    m.includes("saving")
  )
    return "compose";
  if (m.includes("analyz") || m.includes("gap") || m.includes("prepar"))
    return "analyze";
  return "parse";
}

export function LabLoader({ message }: { message: string }) {
  const lines = STAGE_LINES[inferStage(message)];
  const [completedUpTo, setCompletedUpTo] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCompletedUpTo(-1);
    startRef.current = Date.now();
    let idx = 0;

    function advance() {
      if (idx >= lines.length) return;
      setCompletedUpTo(idx - 1);
      idx++;
      const delay = 900 + Math.random() * 800;
      timerRef.current = setTimeout(advance, delay);
    }

    timerRef.current = setTimeout(advance, 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lines]);

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.round((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const activeIdx = completedUpTo + 1;
  const progress = Math.min(92, (activeIdx / lines.length) * 80 + 8);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="w-full max-w-md">
        {/* Meta row */}
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-xs text-muted">
            <span className="text-brand">▸</span> resumelab
          </span>
          <span className="font-mono text-xs tabular-nums text-muted">
            {elapsed}s
          </span>
        </div>

        {/* Primary message */}
        <h2 className="mb-5 text-lg font-semibold tracking-tight text-ink">
          {message}
        </h2>

        {/* Terminal card */}
        <div className="rounded-xl border border-line bg-sunken px-5 py-4">
          <div className="space-y-2.5">
            {lines.map((line, i) => {
              const done = i <= completedUpTo;
              const active = i === activeIdx;
              return (
                <div
                  key={line}
                  className={`flex items-center gap-3 font-mono text-xs transition-opacity duration-300 ${
                    done ? "opacity-50" : active ? "opacity-100" : "opacity-20"
                  }`}
                >
                  <span
                    className={`shrink-0 ${
                      done
                        ? "text-brand"
                        : active
                          ? "animate-pulse text-brand"
                          : "text-muted"
                    }`}
                  >
                    {done ? "✓" : active ? "▸" : "·"}
                  </span>
                  <span
                    className={
                      done
                        ? "text-muted line-through decoration-muted/40"
                        : active
                          ? "text-ink"
                          : "text-muted"
                    }
                  >
                    {line}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {elapsed >= 10 && (
          <p className="mt-4 text-center font-mono text-xs text-muted">
            First visit? The backend takes up to 30s to wake.
          </p>
        )}
      </div>
    </div>
  );
}

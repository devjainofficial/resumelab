"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 5 * 1024 * 1024;

type Finding = {
  id: string;
  label: string;
  points: number;
  max_points: number;
  section: string;
  detail: string;
  criterion: string;
  tip?: string;
};

type Criterion = {
  id: string;
  label: string;
  score: number;
  max: number;
  findings: Finding[];
};

type ScoredFile = {
  key: string;
  filename: string;
  status: "scoring" | "done" | "error";
  score?: number;
  criteria?: Criterion[];
  error?: string;
};

// ── helpers ───────────────────────────────────────────────────────────────────

const CIRC = 2 * Math.PI * 20;

function scoreColor(pct: number) {
  if (pct >= 0.8) return "var(--brand)";
  if (pct >= 0.5) return "#d97706";
  return "#dc2626";
}

function MiniRing({ score }: { score: number }) {
  const pct = score / 100;
  const color = scoreColor(pct);
  const offset = CIRC * (1 - pct);
  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
      <svg viewBox="0 0 48 48" width="44" height="44">
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--line)" strokeWidth="5" />
        <g transform="rotate(-90 24 24)">
          <circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset} />
        </g>
      </svg>
      <span className="absolute font-mono text-xs font-bold tabular-nums text-ink">{score}</span>
    </div>
  );
}

function scoreLabel(v: number) {
  if (v >= 80) return { text: "ATS-ready", cls: "text-brand" };
  if (v >= 60) return { text: "Needs work", cls: "text-amber-600 dark:text-amber-400" };
  return { text: "High risk", cls: "text-red-600 dark:text-red-400" };
}

function FindingRow({ finding }: { finding: Finding }) {
  const full = finding.points / finding.max_points >= 0.99;
  const zero = finding.points <= 0;
  return (
    <li className="flex items-start gap-2.5 py-2 border-b border-line/20 last:border-0">
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold
        ${full ? "bg-brand/15 text-brand" : zero ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
        {full ? "✓" : zero ? "✗" : "~"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium text-ink">{finding.label}</span>
            <span className="shrink-0 rounded px-1 py-px text-[9px] font-medium uppercase tracking-wide
              bg-line/30 text-ink-soft">
              {finding.section}
            </span>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums">
            {Math.round(finding.points * 10) / 10}/{finding.max_points}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{finding.detail}</p>
        {finding.tip && !full && (
          <p className="mt-1 text-[11px] font-medium leading-relaxed text-brand/80">
            Fix: {finding.tip}
          </p>
        )}
      </div>
    </li>
  );
}

function CriterionRow({ criterion, fileKey }: { criterion: Criterion; fileKey: string }) {
  const [open, setOpen] = useState(false);
  const pct = criterion.max > 0 ? criterion.score / criterion.max : 0;
  const color = scoreColor(pct);
  const scoreInt = Math.round(criterion.score);

  return (
    <li className="border-b border-line/30 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-sunken/60"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-ink">{criterion.label}</span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums"
              style={{ color }}>
              {scoreInt}/{criterion.max}
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full rounded-full bg-line/40 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, pct * 100)}%`, background: color }}
            />
          </div>
        </div>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <ul className="px-4 pb-3 pt-1">
          {criterion.findings.map((f) => <FindingRow key={f.id} finding={f} />)}
        </ul>
      )}
    </li>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function QuickScorer() {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<ScoredFile[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<File[]>([]);
  const processingRef = useRef(false);

  const scoreOne = useCallback(async (file: File, key: string) => {
    setFiles((prev) =>
      prev.map((f) => f.key === key ? { ...f, status: "scoring" } : f)
    );
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`${API}/score`, { method: "POST", body: fd });
      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        throw new Error(body?.detail ?? `Failed (${resp.status})`);
      }
      const data = await resp.json();
      setFiles((prev) =>
        prev.map((f) =>
          f.key === key
            ? { ...f, status: "done", score: data.score, criteria: data.criteria }
            : f
        )
      );
      setExpanded((e) => e ?? key);
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.key === key
            ? { ...f, status: "error", error: (err as Error).message }
            : f
        )
      );
    }
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    while (queueRef.current.length > 0) {
      const file = queueRef.current.shift()!;
      const key = `${file.name}-${file.size}`;
      await scoreOne(file, key);
    }
    processingRef.current = false;
  }, [scoreOne]);

  const enqueue = useCallback((incoming: File[]) => {
    setUploadError(null);
    const bad = incoming.filter((f) => !f.name.toLowerCase().match(/\.(pdf|docx)$/));
    const big = incoming.filter((f) => f.size > MAX_BYTES);
    if (bad.length) {
      setUploadError(`${bad.map((f) => f.name).join(", ")}: only PDF and DOCX supported.`);
      return;
    }
    if (big.length) {
      setUploadError(`${big.map((f) => f.name).join(", ")}: file(s) exceed 5 MB.`);
      return;
    }

    const newEntries: ScoredFile[] = incoming.map((f) => ({
      key: `${f.name}-${f.size}`,
      filename: f.name,
      status: "scoring" as const,
    }));
    setFiles((prev) => [...prev, ...newEntries]);
    queueRef.current.push(...incoming);
    processQueue();
  }, [processQueue]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (list.length) enqueue(list);
    e.target.value = "";
  }, [enqueue]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    enqueue(Array.from(e.dataTransfer.files));
  }, [enqueue]);

  const scoringCount = files.filter((f) => f.status === "scoring").length;
  const hasResults = files.length > 0;

  return (
    <div className="space-y-4">
      {/* ── upload zone ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload resumes for scoring"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-10 text-center transition cursor-pointer select-none
          ${dragging ? "border-brand bg-brand/5" : "border-line bg-surface hover:border-brand/50 hover:bg-brand/[0.02]"}`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </span>
        <div>
          <p className="font-medium text-ink">
            {dragging ? "Drop here" : hasResults ? "Add more resumes" : "Drop resumes or click to upload"}
          </p>
          <p className="mt-0.5 text-sm text-muted">PDF or DOCX · up to 5 MB each · select multiple</p>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple className="sr-only"
          onChange={onInputChange} />
      </div>

      {uploadError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          {uploadError}
        </p>
      )}

      {/* ── results list ── */}
      {hasResults && (
        <div className="rounded-2xl border border-line bg-surface overflow-hidden">
          {scoringCount > 0 && (
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs text-muted">
              <svg className="h-3.5 w-3.5 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scoring {scoringCount} resume{scoringCount > 1 ? "s" : ""}…
            </div>
          )}

          <ul className="divide-y divide-line/50">
            {files.map((f) => (
              <li key={f.key}>
                {/* Summary row */}
                <button
                  type="button"
                  disabled={f.status !== "done"}
                  onClick={() => setExpanded((e) => e === f.key ? null : f.key)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sunken disabled:cursor-default"
                >
                  {f.status === "scoring" ? (
                    <div className="h-11 w-11 shrink-0 flex items-center justify-center">
                      <svg className="h-5 w-5 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  ) : f.status === "error" ? (
                    <div className="h-11 w-11 shrink-0 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
                      <span className="text-sm font-bold text-red-500">!</span>
                    </div>
                  ) : (
                    <MiniRing score={f.score!} />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{f.filename}</p>
                    {f.status === "done" && (
                      <p className={`text-xs font-medium ${scoreLabel(f.score!).cls}`}>
                        {scoreLabel(f.score!).text}
                      </p>
                    )}
                    {f.status === "error" && (
                      <p className="text-xs text-red-500">{f.error}</p>
                    )}
                    {f.status === "scoring" && (
                      <p className="text-xs text-muted">Scoring…</p>
                    )}
                  </div>

                  {f.status === "done" && (
                    <svg
                      className={`h-4 w-4 shrink-0 text-muted transition-transform ${expanded === f.key ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  )}
                </button>

                {/* Expanded breakdown — criteria + findings */}
                {expanded === f.key && f.criteria && (
                  <div className="border-t border-line/40 pb-1">
                    <ul>
                      {f.criteria.map((c) => (
                        <CriterionRow key={c.id} criterion={c} fileKey={f.key} />
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── CTA ── */}
      {files.some((f) => f.status === "done") && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="flex-1 rounded-xl bg-brand px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            Fix it with Resume Lab — free →
          </Link>
        </div>
      )}

      <p className="text-center text-xs text-muted">
        Your resumes are never shared. Scores are deterministic — same file, same score, no LLM.
      </p>
    </div>
  );
}

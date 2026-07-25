"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Check = {
  id: string;
  label: string;
  points: number;
  max_points: number;
  detail: string;
};

type Result = {
  score: number;
  checks: Check[];
  filename: string;
};

const R = 52;
const CX = 64;
const CY = 64;
const CIRC = 2 * Math.PI * R;

function scoreColor(v: number) {
  if (v >= 80) return "var(--brand)";
  if (v >= 60) return "#d97706"; // amber
  return "#dc2626"; // red
}

function scoreLabel(v: number) {
  if (v >= 80) return { text: "ATS-ready", cls: "text-brand" };
  if (v >= 60) return { text: "Needs work", cls: "text-amber-600 dark:text-amber-400" };
  return { text: "High risk", cls: "text-red-600 dark:text-red-400" };
}

function ScoreRing({ score }: { score: number }) {
  const offset = CIRC * (1 - score / 100);
  const { text, cls } = scoreLabel(score);
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <svg viewBox="0 0 128 128" width="128" height="128" aria-label={`ATS score: ${score}`}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
          <g transform={`rotate(-90 ${CX} ${CY})`}>
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${CIRC}`}
              strokeDashoffset={`${offset}`}
              style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-4xl font-bold tabular-nums text-ink">{score}</span>
          <span className="font-mono text-xs text-muted">/100</span>
        </div>
      </div>
      <span className={`font-mono text-sm font-semibold ${cls}`}>{text}</span>
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const ratio = check.points / check.max_points;
  const full = ratio >= 0.99;
  const zero = check.points <= 0;
  return (
    <li className="flex items-start gap-3 py-2.5 border-b border-line/40 last:border-0">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold
          ${full ? "bg-brand/15 text-brand" : zero ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
      >
        {full ? "✓" : zero ? "✗" : "~"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-ink">{check.label}</span>
          <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
            {Math.round(check.points * 10) / 10}/{check.max_points}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-soft">{check.detail}</p>
      </div>
    </li>
  );
}

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function QuickScorer() {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`${API}/score`, { method: "POST", body: fd });
      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        throw new Error(body?.detail ?? `Request failed (${resp.status})`);
      }
      const data: Result = await resp.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const f = files[0];
    if (!f.name.toLowerCase().match(/\.(pdf|docx)$/)) {
      setError("Only PDF and DOCX files are supported.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File is larger than 5 MB.");
      return;
    }
    run(f);
  }, [run]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFiles(e.dataTransfer.files);
  }, [onFiles]);

  const reset = () => { setResult(null); setError(null); };

  if (result) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="flex flex-col items-center gap-1 mb-6">
            <ScoreRing score={result.score} />
            <p className="mt-2 text-xs text-muted truncate max-w-xs text-center" title={result.filename}>
              {result.filename}{result.cached && " · cached"}
            </p>
          </div>

          <ul className="divide-y-0">
            {result.checks.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="flex-1 rounded-xl bg-brand px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            Fix it with Resume Lab — free →
          </Link>
          <button
            onClick={reset}
            className="flex-1 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-medium text-ink-soft transition hover:bg-sunken"
          >
            Score another resume
          </button>
        </div>

        <p className="text-center text-xs text-muted">
          Resume Lab rewrites your resume using only your own facts — no account needed to score, free to improve.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload resume for scoring"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-16 text-center transition cursor-pointer select-none
          ${dragging
            ? "border-brand bg-brand/5"
            : "border-line bg-surface hover:border-brand/50 hover:bg-brand/[0.02]"
          }`}
      >
        {busy ? (
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <svg className="h-5 w-5 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </span>
            <p className="text-sm font-medium text-ink-soft">Scoring your resume…</p>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </span>
            <div>
              <p className="font-medium text-ink">
                {dragging ? "Drop it here" : "Drop your resume or click to upload"}
              </p>
              <p className="mt-1 text-sm text-muted">PDF or DOCX · max 5 MB</p>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
          disabled={busy}
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      <p className="text-center text-xs text-muted">
        Your resume is never shared. Scores are deterministic — same file, same score, no LLM.
      </p>
    </div>
  );
}

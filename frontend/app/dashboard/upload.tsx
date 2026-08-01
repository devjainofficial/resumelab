"use client";

import { useRef, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const FACTS = [
  "Recruiters spend an average of 7.4 seconds scanning a resume.",
  "75% of resumes are filtered out by ATS before a human ever sees them.",
  "Resumes with quantified achievements get 40% more interviews.",
  "One-page resumes are preferred by 66% of employers.",
  "Adding a LinkedIn URL increases callback rates by 71%.",
  "Using action verbs increases readability by 33%.",
  "The average job posting receives 250 resumes.",
  "Customising your resume for each role boosts response rates by 50%.",
  "A typo on your resume can cost you the interview. 58% of hiring managers say so.",
];

type ParsedResume = {
  contact: { name: string | null; email: string | null };
  flags: { sections_found: string[] };
  stats: { bullet_count: number };
};

type UploadResult = {
  resume_id: string;
  parsed: ParsedResume;
  deduped: boolean;
};

type ScoreResult = {
  score: number;
  criteria: { id: string; label: string; score: number; max: number }[];
};

// ─── mini ring ────────────────────────────────────────────────────────────────

const CIRC = 2 * Math.PI * 20;

function scoreColor(v: number) {
  if (v >= 80) return "var(--brand)";
  if (v >= 60) return "#d97706";
  return "#dc2626";
}

function scoreLabel(v: number) {
  if (v >= 80) return { text: "ATS-ready", cls: "text-brand" };
  if (v >= 60) return { text: "Needs work", cls: "text-amber-600 dark:text-amber-400" };
  return { text: "High risk", cls: "text-red-600 dark:text-red-400" };
}

function ScoreRing({ score }: { score: number }) {
  const pct = score / 100;
  const offset = CIRC * (1 - pct);
  const color = scoreColor(score);
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <svg viewBox="0 0 48 48" width="52" height="52">
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--line)" strokeWidth="5" />
        <g transform="rotate(-90 24 24)">
          <circle
            cx="24" cy="24" r="20" fill="none"
            stroke={color} strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={offset}
          />
        </g>
      </svg>
      <span className="absolute font-mono text-sm font-bold tabular-nums text-ink">{score}</span>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function UploadZone() {
  const [busy, setBusy] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [factIdx, setFactIdx] = useState(0);
  const [fade, setFade] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!busy) return;
    setFactIdx(Math.floor(Math.random() * FACTS.length));
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setFactIdx((i) => (i + 1) % FACTS.length);
        setFade(true);
      }, 300);
    }, 3500);
    return () => clearInterval(interval);
  }, [busy]);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    setScoreResult(null);

    let uploadData: UploadResult | null = null;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again.");

      const form = new FormData();
      form.append("file", file);
      const resp = await fetch(`${API}/resumes/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      if (!resp.ok) {
        const detail = await resp.json().catch(() => null);
        throw new Error(detail?.detail ?? `Upload failed (${resp.status})`);
      }
      uploadData = await resp.json();

      // Empty resume guard
      if (
        uploadData!.parsed.stats.bullet_count === 0 &&
        uploadData!.parsed.flags.sections_found.length === 0
      ) {
        throw new Error(
          "No resume content found in this file. Please upload a resume that includes work experience, education, or skills."
        );
      }

      setResult(uploadData);
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Could not reach the ResumeLab API. If you are developing locally, start the backend."
          : (e as Error).message
      );
      uploadData = null;
    } finally {
      setBusy(false);
    }

    // Score in background — non-blocking, reuses the same file
    if (!uploadData) return;
    setScoring(true);
    try {
      const scoreForm = new FormData();
      scoreForm.append("file", file);
      const sResp = await fetch(`${API}/score`, { method: "POST", body: scoreForm });
      if (sResp.ok) setScoreResult(await sResp.json());
    } catch {
      // Scoring failure is non-fatal — CTA still works
    } finally {
      setScoring(false);
    }
  }

  // ── PARSING STATE ──
  if (busy) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-12 shadow-sm">
        <div className="mb-6 h-10 w-10 animate-spin rounded-full border-4 border-line border-t-brand" />
        <p className="font-medium text-ink">Parsing your resume…</p>
        <p
          className={`mt-3 max-w-sm text-center text-sm text-muted transition-opacity duration-300 ${
            fade ? "opacity-100" : "opacity-0"
          }`}
        >
          {FACTS[factIdx]}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">Start here</p>

      {/* ── ENTRY CARDS ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Upload card */}
        <div className="flex flex-col rounded-xl border border-brand/30 bg-brand-tint p-5">
          <p className="mb-1 text-sm font-semibold text-ink">Upload your resume</p>
          <p className="mb-4 text-xs leading-relaxed text-ink-soft">
            PDF or DOCX. We extract every fact, no hallucinations.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onFile(f);
            }}
            className={`flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
              dragOver ? "border-brand bg-brand/10" : "border-brand/40"
            }`}
          >
            <svg
              className="mb-2 h-7 w-7 text-brand/60"
              fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="mb-3 text-xs text-muted">
              {dragOver ? "Drop to upload" : "Drag & drop here, or"}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Browse files
            </button>
            <p className="mt-2 font-mono text-xs text-muted">PDF or DOCX · max 5 MB</p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Build from scratch card */}
        <div className="flex flex-col rounded-xl border border-violet/30 bg-violet-tint p-5">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-sm font-semibold text-ink">Build from scratch</p>
            <span className="font-mono text-xs text-violet">✦ AI</span>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-ink-soft">
            Answer a short brief per role. AI drafts bullets from your words. Nothing invented.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Role", "Contact", "Company", "Brief → Bullets", "Skills"].map((s) => (
              <span
                key={s}
                className="rounded-full border border-violet/30 bg-violet/10 px-2.5 py-0.5 font-mono text-xs text-violet"
              >
                {s}
              </span>
            ))}
          </div>
          <div className="mt-auto pt-5">
            <a
              href="/scratch"
              className="block w-full rounded-md bg-violet px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Start building →
            </a>
          </div>
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div className="mt-4 rounded-lg border border-critical/30 bg-critical-tint p-3 text-sm text-critical">
          {error}
        </div>
      )}

      {/* ── PARSE RESULT + SCORE ── */}
      {result && (
        <div className="mt-5 rounded-xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint">
              <svg
                className="h-4 w-4 text-brand" fill="none"
                viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink">
                {result.deduped
                  ? "Already uploaded. Reused existing parse (zero cost)"
                  : "Parsed successfully"}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {result.parsed.contact.name ?? "Unnamed"} ·{" "}
                {result.parsed.contact.email ?? "no email"} ·{" "}
                {result.parsed.flags.sections_found.join(", ") || "no sections"} ·{" "}
                {result.parsed.stats.bullet_count} bullets
              </p>
            </div>
          </div>

          {/* Inline score */}
          {(scoring || scoreResult) && (
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-line bg-sunken px-4 py-3">
              {scoring ? (
                <>
                  <div className="h-9 w-9 shrink-0 animate-spin rounded-full border-4 border-line border-t-brand" />
                  <div>
                    <p className="text-sm font-medium text-ink">Scoring your resume…</p>
                    <p className="text-xs text-muted">Deterministic ATS check, no LLM</p>
                  </div>
                </>
              ) : scoreResult ? (
                <>
                  <ScoreRing score={scoreResult.score} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      ATS Score: {scoreResult.score}/100
                    </p>
                    <p className={`text-xs font-medium ${scoreLabel(scoreResult.score).cls}`}>
                      {scoreLabel(scoreResult.score).text}
                    </p>
                  </div>
                  {scoreResult.score < 80 && (
                    <span className="hidden sm:inline rounded-full border border-brand/30 bg-brand-tint px-3 py-1 text-xs font-medium text-brand">
                      AI can fix this
                    </span>
                  )}
                </>
              ) : null}
            </div>
          )}

          <a
            href={`/resume/${result.resume_id}`}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong"
          >
            Optimize this resume
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

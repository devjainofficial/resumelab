"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const FACTS = [
  "Recruiters spend an average of 7.4 seconds scanning a resume.",
  "75% of resumes are filtered out by ATS before a human ever sees them.",
  "Resumes with quantified achievements get 40% more interviews.",
  "One-page resumes are preferred by 66% of employers.",
  "Adding a LinkedIn URL increases callback rates by 71%.",
  "Using action verbs increases readability by 33%.",
  "Customising your resume for each role boosts response rates by 50%.",
];

export function UploadZone() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [factIdx, setFactIdx] = useState(0);
  const [fade, setFade] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const factTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function startFacts() {
    setFactIdx(Math.floor(Math.random() * FACTS.length));
    factTimer.current = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setFactIdx((i) => (i + 1) % FACTS.length);
        setFade(true);
      }, 300);
    }, 3500);
  }

  function stopFacts() {
    if (factTimer.current) clearInterval(factTimer.current);
  }

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    startFacts();

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
      const data = await resp.json();

      if (
        data.parsed?.stats?.bullet_count === 0 &&
        data.parsed?.flags?.sections_found?.length === 0
      ) {
        throw new Error(
          "No resume content found. Please upload a file that includes work experience, education, or skills."
        );
      }

      stopFacts();
      router.push(`/resume/${data.resume_id}`);
    } catch (e) {
      stopFacts();
      setBusy(false);
      setError(
        e instanceof TypeError
          ? "Could not reach the API. If developing locally, start the backend."
          : (e as Error).message
      );
    }
  }

  return (
    <>
      {/* ── Full-page upload overlay ── */}
      {busy && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper/95 backdrop-blur-sm">
          <div className="mb-5 h-10 w-10 animate-spin rounded-full border-4 border-line border-t-brand" />
          <p className="text-sm font-semibold text-ink">Parsing your resume…</p>
          <p
            className={`mt-3 max-w-xs px-4 text-center text-sm text-muted transition-opacity duration-300 ${
              fade ? "opacity-100" : "opacity-0"
            }`}
          >
            {FACTS[factIdx]}
          </p>
        </div>
      )}

      <div>
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">Start here</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* ── Upload card ── */}
          <div className="flex flex-col rounded-xl border border-brand/25 bg-brand-tint/40 p-5">
            <p className="mb-1 text-sm font-semibold text-ink">Upload your resume</p>
            <p className="mb-4 text-xs leading-relaxed text-muted">
              PDF or DOCX. Every fact extracted, nothing invented.
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
                dragOver ? "border-brand bg-brand/10" : "border-brand/30"
              }`}
            >
              <svg
                className="mb-2 h-6 w-6 text-brand/50"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <p className="mb-3 text-xs text-muted">
                {dragOver ? "Drop to upload" : "Drag & drop here, or"}
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong"
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

          {/* ── Build from scratch card ── */}
          <div className="flex flex-col rounded-xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <p className="text-sm font-semibold text-ink">Build from scratch</p>
              <span className="ml-auto flex items-center gap-1 font-mono text-xs font-semibold text-brand">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                </svg>
                AI
              </span>
            </div>

            {/* 3-step flow */}
            <ol className="flex flex-col gap-3">
              {[
                { n: "1", label: "Your background", sub: "role, company, dates" },
                { n: "2", label: "Describe what you did", sub: "plain words, no formatting" },
                { n: "3", label: "AI writes your bullets", sub: "truthful, ATS-optimized" },
              ].map((s) => (
                <li key={s.n} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink">{s.label}</p>
                    <p className="font-mono text-[10px] text-muted">{s.sub}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Separator */}
            <div className="my-4 border-t border-line" />

            {/* Promise line */}
            <p className="text-xs text-muted">
              No facts invented. Every bullet comes from what you tell us.
            </p>

            <div className="mt-4">
              <a
                href="/scratch"
                className="block w-full rounded-md bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong"
              >
                Start building →
              </a>
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mt-4 rounded-lg border border-critical/30 bg-critical-tint p-3 text-sm text-critical">
            {error}
          </div>
        )}
      </div>
    </>
  );
}

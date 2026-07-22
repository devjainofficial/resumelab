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
  "Customizing your resume for each role boosts response rates by 50%.",
  "86% of professionals use their phone to search for jobs.",
  "A typo on your resume can cost you the interview — 58% of hiring managers say so.",
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

export function UploadZone() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
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
      setResult(await resp.json());
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Could not reach the ResumeLab API. If you are developing locally, start the backend."
          : (e as Error).message
      );
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
        <div className="mb-6 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        <p className="text-lg font-medium text-slate-900">
          Parsing your resume...
        </p>
        <p
          className={`mt-4 max-w-sm text-center text-sm text-slate-400 transition-opacity duration-300 ${
            fade ? "opacity-100" : "opacity-0"
          }`}
        >
          {FACTS[factIdx]}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed p-12 text-center transition ${
          dragOver
            ? "border-slate-900 bg-slate-50"
            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        <svg
          className="mb-4 h-10 w-10 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm font-medium text-slate-700">
          Drop your resume here, or click to browse
        </p>
        <p className="mt-1 text-xs text-slate-400">PDF or DOCX, max 5 MB</p>
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
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {result && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">
                {result.deduped
                  ? "Already uploaded — reused the existing parse (zero cost)"
                  : "Parsed successfully"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {result.parsed.contact.name ?? "Unnamed"} &middot;{" "}
                {result.parsed.contact.email ?? "no email"} &middot;{" "}
                {result.parsed.flags.sections_found.join(", ") || "no sections"}{" "}
                &middot; {result.parsed.stats.bullet_count} bullets
              </p>
            </div>
          </div>
          <a
            href={`/resume/${result.resume_id}`}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-slate-700"
          >
            Continue to the wizard &rarr;
          </a>
        </div>
      )}
    </div>
  );
}

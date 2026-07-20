"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ParsedResume = {
  contact: { name: string | null; email: string | null };
  flags: { sections_found: string[] };
  stats: { bullet_count: number };
};

type UploadResult = { resume_id: string; parsed: ParsedResume; deduped: boolean };

export function UploadZone() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="mt-8">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full rounded-lg border-2 border-dashed border-slate-300 p-10 text-center text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 disabled:opacity-60"
      >
        {busy ? "Parsing…" : "Upload your resume (PDF or DOCX, max 5 MB)"}
      </button>
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
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <p className="font-medium">
            {result.deduped ? "Already uploaded — reused the existing parse (zero cost)." : "Parsed successfully."}
          </p>
          <p className="mt-1 text-slate-600">
            {result.parsed.contact.name ?? "Unnamed"} · {result.parsed.contact.email ?? "no email found"} ·
            sections: {result.parsed.flags.sections_found.join(", ") || "none"} ·
            {" "}{result.parsed.stats.bullet_count} bullets
          </p>
          <a
            href={`/resume/${result.resume_id}`}
            className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
          >
            Continue to the wizard →
          </a>
        </div>
      )}
    </div>
  );
}

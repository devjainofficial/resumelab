"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type ResumeOption = {
  resumeId: string;
  filename: string;
  versionId: string;
};

type EnhanceResult = {
  actions: string[];
  coverage: { present: string[]; missing: string[] };
  variant_version_id?: string;
};

export function JdEnhancerPanel() {
  const [options, setOptions] = useState<ResumeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [jdText, setJdText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const resumes: { id: string; filename: string }[] = await api("/resumes");
        const hits = (
          await Promise.all(
            resumes.slice(0, 20).map(async (r) => {
              try {
                const versions: { id: string; status: string }[] = await api(
                  `/versions/by-resume/${r.id}`
                );
                const final = versions.find((v) => v.status === "final");
                if (final)
                  return { resumeId: r.id, filename: r.filename, versionId: final.id };
              } catch {
                /* skip */
              }
              return null;
            })
          )
        ).filter(Boolean) as ResumeOption[];
        setOptions(hits);
        if (hits.length) setSelected(hits[0].resumeId);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedOpt = options.find((o) => o.resumeId === selected);
  const ready = jdText.trim().length >= 30 && !!selectedOpt && !running;

  async function handleTailor() {
    if (!selectedOpt) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const r = await api(`/versions/${selectedOpt.versionId}/enhance`, {
        method: "POST",
        body: JSON.stringify({ jd_text: jdText }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRunning(false);
    }
  }

  /* ── skeleton while loading ── */
  if (loading)
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="mb-4 h-4 w-36 animate-pulse rounded bg-sunken" />
        <div className="space-y-3">
          <div className="h-9 animate-pulse rounded-lg bg-sunken" />
          <div className="h-28 animate-pulse rounded-lg bg-sunken" />
          <div className="h-10 animate-pulse rounded-lg bg-sunken" />
        </div>
      </div>
    );

  /* ── no finalized resumes yet ── */
  if (!options.length)
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-mono text-xs text-brand">✦</span>
          <h2 className="text-sm font-semibold text-ink">Tailor for a Job</h2>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Finish the Resume Lab flow to get a{" "}
          <span className="font-semibold text-brand-strong">Final</span> version, then come back to
          tailor it for any job description.
        </p>
        <div className="mt-4 rounded-lg border border-brand/20 bg-brand-tint px-4 py-3">
          <p className="font-mono text-xs text-brand">
            No finalized resumes yet. Upload a resume and complete the lab flow first.
          </p>
        </div>
      </div>
    );

  /* ── main panel ── */
  return (
    <div className="rounded-2xl border border-line bg-surface shadow-sm">
      {/* header */}
      <div className="border-b border-line px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-brand">✦</span>
          <h2 className="text-sm font-semibold text-ink">Tailor for a Job</h2>
          <span className="ml-auto rounded-full bg-brand-tint px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-brand">
            Free
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Mirror keywords from the JD. No new facts, only what is already in your resume.
        </p>
      </div>

      <div className="space-y-4 p-6">
        {/* Resume selector */}
        {options.length > 1 ? (
          <div>
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-muted">
              Resume
            </label>
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setResult(null);
              }}
              className="w-full rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {options.map((o) => (
                <option key={o.resumeId} value={o.resumeId}>
                  {o.filename}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg border border-line bg-sunken px-3 py-2.5">
            <svg
              className="h-4 w-4 shrink-0 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
              {options[0].filename}
            </span>
            <span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 font-mono text-xs font-semibold text-brand">
              Final
            </span>
          </div>
        )}

        {/* JD textarea */}
        <div>
          <label className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-muted">
            Job description
          </label>
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the full job description here…"
            rows={7}
            className="w-full resize-none rounded-lg border border-line bg-sunken px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        {/* CTA */}
        <button
          onClick={handleTailor}
          disabled={!ready}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-40"
        >
          {running ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Tailoring…
            </>
          ) : (
            "Create Tailored Variant →"
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-critical/20 bg-critical-tint px-4 py-3 text-xs text-critical">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-xl border border-brand/20 bg-brand-tint/40 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs text-white">
                ✓
              </span>
              <p className="text-sm font-semibold text-ink">Variant created</p>
            </div>

            {result.actions?.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {result.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-ink-soft">
                    <span className="mt-0.5 shrink-0 text-brand">·</span>
                    {a}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
              <div className="text-center">
                <p className="font-mono text-xl font-bold tabular-nums text-brand">
                  {result.coverage.present.length}
                </p>
                <p className="font-mono text-xs text-muted">matched</p>
              </div>
              <div className="h-8 w-px bg-line" />
              <div className="text-center">
                <p className="font-mono text-xl font-bold tabular-nums text-ink">
                  {result.coverage.missing.length}
                </p>
                <p className="font-mono text-xs text-muted">missing</p>
              </div>
              {result.coverage.missing.length > 0 && (
                <p className="min-w-0 flex-1 text-xs text-muted">
                  {result.coverage.missing.slice(0, 4).join(", ")}
                  {result.coverage.missing.length > 4 &&
                    ` +${result.coverage.missing.length - 4} more`}
                </p>
              )}
            </div>

            {selectedOpt && (
              <a
                href={`/resume/${selectedOpt.resumeId}`}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand/20 bg-white/60 px-4 py-2 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white dark:bg-black/20"
              >
                Open in Resume Lab →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

type Question = {
  id: string;
  kind: "mc" | "number" | "text";
  question: string;
  options?: string[];
};
type Check = { id: string; label: string; points: number; max_points: number; detail: string };

export function Flow({ resumeId }: { resumeId: string }) {
  const [step, setStep] = useState<"start" | "wizard" | "version">("start");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [versionId, setVersionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string>("draft");
  const [markdown, setMarkdown] = useState<string>("");
  const [score, setScore] = useState<{ value: number; checks: Check[] } | null>(null);
  const [repairText, setRepairText] = useState("");
  const [repairResult, setRepairResult] = useState<any>(null);
  const [jdText, setJdText] = useState("");
  const [enhanceResult, setEnhanceResult] = useState<any>(null);
  const [paywall, setPaywall] = useState<any>(null);
  const [outcomeSentTo, setOutcomeSentTo] = useState("");
  const [outcomeLogged, setOutcomeLogged] = useState(false);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && typeof e.detail === "object" && (e.detail as any)?.paywall) {
        setPaywall(e.detail);
      } else if (e instanceof TypeError) {
        setError("Could not reach the ResumeLab API. Start the backend, or try again shortly.");
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    } finally {
      setBusy(null);
    }
  }

  const startWizard = () =>
    run("wizard", async () => {
      const r = await api("/wizard/start", {
        method: "POST",
        body: JSON.stringify({ resume_id: resumeId }),
      });
      setVersionId(r.version_id);
      setQuestions(r.questions);
      setStep(r.questions.length ? "wizard" : "version");
      if (!r.questions.length) await compose(r.version_id);
    });

  const submitAnswers = () =>
    run("answers", async () => {
      await api("/wizard/answers", {
        method: "POST",
        body: JSON.stringify({
          version_id: versionId,
          answers: questions.map((q) => ({
            id: q.id,
            question: q.question,
            answer: answers[q.id] ?? "",
          })),
        }),
      });
      await compose(versionId!);
    });

  async function compose(vid: string) {
    const r = await api(`/versions/${vid}/compose`, { method: "POST" });
    setStatus(r.status);
    setMarkdown(r.markdown);
    setQuestions(r.open_questions ?? []);
    setStep(r.status === "final" || !(r.open_questions ?? []).length ? "version" : "wizard");
    setScore(null);
  }

  const getScore = () =>
    run("score", async () => {
      setScore(await api(`/versions/${versionId}/score`, { method: "POST", body: "{}" }));
    });

  const runRepair = () =>
    run("repair", async () => {
      const r = await api(`/versions/${versionId}/repair`, {
        method: "POST",
        body: JSON.stringify({ findings_text: repairText }),
      });
      setRepairResult(r);
      if (r.markdown) setMarkdown(r.markdown);
    });

  const runEnhance = () =>
    run("enhance", async () => {
      setPaywall(null);
      const r = await api(`/versions/${versionId}/enhance`, {
        method: "POST",
        body: JSON.stringify({ jd_text: jdText }),
      });
      setEnhanceResult(r);
    });

  const logOutcome = () =>
    run("outcome", async () => {
      await api("/outcomes", {
        method: "POST",
        body: JSON.stringify({
          version_id: enhanceResult?.variant_version_id ?? versionId,
          sent_to: outcomeSentTo,
          sent_date: new Date().toISOString().slice(0, 10),
        }),
      });
      setOutcomeLogged(true);
    });

  async function download(fmt: "pdf" | "docx") {
    await run(fmt, async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/versions/${versionId}/download/${fmt}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Resume Lab</h1>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
          ← Dashboard
        </Link>
      </div>
      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {step === "start" && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">
            The wizard asks up to 10 questions (ordered by score impact) so the
            rewrite uses only your real facts. Nothing is ever invented.
          </p>
          <button
            onClick={startWizard}
            disabled={!!busy}
            className="mt-4 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {busy ? "Analyzing gaps…" : "Start the wizard"}
          </button>
        </div>
      )}

      {step === "wizard" && (
        <div className="mt-8 space-y-5">
          {questions.map((q) => (
            <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <label className="block text-sm font-medium">{q.question}</label>
              {q.kind === "mc" && q.options ? (
                <select
                  className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                >
                  <option value="">Choose…</option>
                  {q.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
                  type={q.kind === "number" ? "text" : "text"}
                  placeholder={q.kind === "number" ? "A real number, or leave blank if none exists" : ""}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                />
              )}
            </div>
          ))}
          <button
            onClick={submitAnswers}
            disabled={!!busy}
            className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {busy ? "Composing…" : "Save answers & compose"}
          </button>
        </div>
      )}

      {step === "version" && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                status === "final" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {status.toUpperCase()}
            </span>
            <button onClick={() => download("pdf")} className="text-sm underline">PDF</button>
            <button onClick={() => download("docx")} className="text-sm underline">DOCX</button>
            <button
              onClick={getScore}
              disabled={status !== "final" || !!busy}
              title={status !== "final" ? "Drafts can't be scored" : ""}
              className="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy === "score" ? "Scoring…" : "ATS score"}
            </button>
          </div>

          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm">
            {markdown}
          </pre>

          {score && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-3xl font-bold">{score.value}<span className="text-base font-normal text-slate-500">/100</span></p>
              <ul className="mt-3 space-y-1 text-sm">
                {score.checks.map((c) => (
                  <li key={c.id} className="flex justify-between gap-4">
                    <span>{c.label} — <span className="text-slate-500">{c.detail}</span></span>
                    <span className="shrink-0 font-mono">{c.points}/{c.max_points}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-slate-600">
                Want a second opinion? Try{" "}
                <a href="https://resumeworded.com" target="_blank" className="underline">
                  Resume Worded
                </a>{" "}
                and paste its findings below — we've seen scores jump 65 → 83
                from targeted fixes alone.
              </p>
            </div>
          )}

          {status === "final" && (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-semibold">Score repair</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Paste findings from an external checker. Fixes are targeted —
                  never a blind rewrite; missing numbers become questions.
                </p>
                <textarea
                  className="mt-3 w-full rounded border border-slate-300 p-2 text-sm"
                  rows={3}
                  placeholder={"e.g.\nQuantify impact: 6\nBuzzwords: 8"}
                  value={repairText}
                  onChange={(e) => setRepairText(e.target.value)}
                />
                <button
                  onClick={runRepair}
                  disabled={!repairText.trim() || !!busy}
                  className="mt-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  {busy === "repair" ? "Repairing…" : "Apply targeted fixes"}
                </button>
                {repairResult && (
                  <div className="mt-3 text-sm">
                    <p className="font-medium">
                      {repairResult.before_score} → {repairResult.after_score}
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-slate-600">
                      {repairResult.actions?.map((a: string) => <li key={a}>{a}</li>)}
                    </ul>
                    {repairResult.note && <p className="mt-1 text-slate-500">{repairResult.note}</p>}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-semibold">Tailor to a job description</h2>
                <textarea
                  className="mt-3 w-full rounded border border-slate-300 p-2 text-sm"
                  rows={4}
                  placeholder="Paste the full job description…"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                />
                <button
                  onClick={runEnhance}
                  disabled={jdText.trim().length < 30 || !!busy}
                  className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {busy === "enhance" ? "Tailoring…" : "Create tailored variant"}
                </button>

                {paywall && (
                  <div className="mt-3 rounded-lg bg-amber-50 p-4 text-sm">
                    <p className="font-medium">{paywall.message}</p>
                    <p className="mt-1 text-slate-600">
                      ₹{paywall.price_inr} per tailoring run. Payment options are
                      on the dashboard.
                    </p>
                  </div>
                )}
                {enhanceResult && (
                  <div className="mt-3 text-sm">
                    <ul className="list-disc pl-5 text-slate-600">
                      {enhanceResult.actions?.map((a: string) => <li key={a}>{a}</li>)}
                    </ul>
                    <p className="mt-2">
                      Coverage: {enhanceResult.coverage.present.length} matched,{" "}
                      {enhanceResult.coverage.missing.length} missing
                      {enhanceResult.coverage.missing.length > 0 &&
                        ` (${enhanceResult.coverage.missing.slice(0, 6).join(", ")})`}
                    </p>
                    <p className="mt-1 text-slate-500">{enhanceResult.coverage.note}</p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-semibold">Track where this went</h2>
                <div className="mt-3 flex gap-2">
                  <input
                    className="flex-1 rounded border border-slate-300 p-2 text-sm"
                    placeholder="Company / job board"
                    value={outcomeSentTo}
                    onChange={(e) => setOutcomeSentTo(e.target.value)}
                  />
                  <button
                    onClick={logOutcome}
                    disabled={!outcomeSentTo.trim() || !!busy}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
                  >
                    Log it
                  </button>
                </div>
                {outcomeLogged && (
                  <p className="mt-2 text-sm text-green-700">
                    Logged. Update the result from the dashboard when you hear back.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

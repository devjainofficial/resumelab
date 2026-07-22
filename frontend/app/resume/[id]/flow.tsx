"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

type Question = {
  id: string;
  kind: "mc" | "number" | "text";
  question: string;
  options?: string[];
};
type Check = {
  id: string;
  label: string;
  points: number;
  max_points: number;
  detail: string;
};

const RESUME_FACTS = [
  "Recruiters spend an average of 7.4 seconds on a resume.",
  "75% of resumes are rejected by ATS before a human sees them.",
  "Resumes with quantified achievements get 40% more interviews.",
  "One-page resumes are preferred by 66% of employers.",
  "Action verbs at the start of bullets increase readability by 33%.",
  "Tailoring your resume to each job boosts response rates by 50%.",
  "Spelling errors eliminate 58% of candidates immediately.",
  "Keywords from the job description can double your ATS score.",
  "Consistent formatting makes resumes 3x easier to scan.",
  "Adding LinkedIn increases callback rates by 71%.",
];

const NUMBER_HINTS: Record<string, string> = {
  team: "e.g. 5, 12, 30+",
  user: "e.g. 1,000 — 500,000",
  revenue: "e.g. ₹50L, $2M",
  latency: "e.g. 200ms → 50ms",
  cost: "e.g. 30% reduction",
  request: "e.g. 10K/day, 1M/month",
  uptime: "e.g. 99.9%",
  deploy: "e.g. 50+ per month",
};

function getHint(question: string): string | null {
  const q = question.toLowerCase();
  for (const [key, hint] of Object.entries(NUMBER_HINTS)) {
    if (q.includes(key)) return hint;
  }
  return null;
}

function LoadingScreen({ message }: { message: string }) {
  const [factIdx, setFactIdx] = useState(
    Math.floor(Math.random() * RESUME_FACTS.length)
  );
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setFactIdx((i) => (i + 1) % RESUME_FACTS.length);
        setFade(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-8">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
      </div>
      <p className="text-lg font-medium text-slate-900">{message}</p>
      <p
        className={`mt-6 max-w-md text-sm text-slate-500 transition-opacity duration-300 ${
          fade ? "opacity-100" : "opacity-0"
        }`}
      >
        {RESUME_FACTS[factIdx]}
      </p>
    </div>
  );
}

function TypeformWizard({
  questions,
  onComplete,
}: {
  questions: Question[];
  onComplete: (answers: Record<string, string>) => void;
}) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const q = questions[current];
  const isLast = current === questions.length - 1;
  const progress = ((current + 1) / questions.length) * 100;

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete(answers);
    } else {
      setCurrent((c) => c + 1);
    }
  }, [isLast, answers, onComplete, current]);

  const handleSkip = useCallback(() => {
    if (isLast) {
      onComplete(answers);
    } else {
      setCurrent((c) => c + 1);
    }
  }, [isLast, answers, onComplete, current]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext]);

  if (!q) return null;
  const hint = q.kind === "number" ? getHint(q.question) : null;

  return (
    <div className="flex min-h-[80vh] flex-col">
      {/* Progress bar */}
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>
          {current + 1} of {questions.length}
        </span>
        <button
          onClick={handleSkip}
          className="rounded px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          Skip
        </button>
      </div>
      <div className="mb-12 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-lg">
          <p className="mb-1 text-sm font-medium text-slate-400">
            Question {current + 1}
          </p>
          <h2 className="text-2xl font-semibold leading-snug text-slate-900">
            {q.question}
          </h2>

          <div className="mt-8">
            {q.kind === "mc" && q.options ? (
              <div className="space-y-3">
                {q.options.map((o) => (
                  <button
                    key={o}
                    onClick={() => {
                      setAnswers({ ...answers, [q.id]: o });
                      setTimeout(handleNext, 200);
                    }}
                    className={`block w-full rounded-xl border-2 px-5 py-3.5 text-left text-sm font-medium transition ${
                      answers[q.id] === o
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <input
                  autoFocus
                  className="w-full border-b-2 border-slate-300 bg-transparent pb-2 text-lg outline-none transition focus:border-slate-900"
                  type="text"
                  placeholder={
                    q.kind === "number"
                      ? "Type a number, or skip if none exists"
                      : "Type your answer..."
                  }
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [q.id]: e.target.value })
                  }
                />
                {hint && (
                  <p className="mt-2 text-sm text-slate-400">{hint}</p>
                )}
              </>
            )}
          </div>

          {q.kind !== "mc" && (
            <div className="mt-8 flex gap-3">
              {current > 0 && (
                <button
                  onClick={() => setCurrent((c) => c - 1)}
                  className="rounded-xl border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                {isLast ? "Finish" : "Next"}
              </button>
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400">
            Press <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">Enter</kbd> to continue
          </p>
        </div>
      </div>
    </div>
  );
}

function ResumePreview({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  return (
    <div className="resume-preview mx-auto max-w-[680px] rounded-lg border border-slate-200 bg-white px-10 py-8 shadow-md">
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line) return null;
        if (line.startsWith("> "))
          return (
            <p
              key={i}
              className="mb-3 border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
            >
              {line.slice(2).replace(/\*\*/g, "")}
            </p>
          );
        if (line.startsWith("# "))
          return (
            <h1 key={i} className="mb-0.5 text-xl font-bold text-slate-900">
              {line.slice(2)}
            </h1>
          );
        if (line.startsWith("## "))
          return (
            <h2
              key={i}
              className="mb-1.5 mt-4 border-b border-slate-300 pb-0.5 text-xs font-bold uppercase tracking-widest text-slate-700"
            >
              {line.slice(3)}
            </h2>
          );
        if (line.startsWith("- ")) {
          const bullet = line
            .slice(2)
            .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
          return (
            <li
              key={i}
              className="ml-4 list-disc text-[11px] leading-relaxed text-slate-800"
              dangerouslySetInnerHTML={{ __html: bullet }}
            />
          );
        }
        const text = line.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
        if (line.includes("|")) {
          return (
            <p
              key={i}
              className="text-[10px] text-slate-600"
              dangerouslySetInnerHTML={{ __html: text }}
            />
          );
        }
        return (
          <p
            key={i}
            className="text-[11px] leading-relaxed text-slate-800"
            dangerouslySetInnerHTML={{ __html: text }}
          />
        );
      })}
    </div>
  );
}

export function Flow({ resumeId }: { resumeId: string }) {
  const [step, setStep] = useState<
    "start" | "loading" | "wizard" | "composing" | "version"
  >("start");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("Analyzing your resume...");

  const [versionId, setVersionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState<string>("draft");
  const [markdown, setMarkdown] = useState<string>("");
  const [score, setScore] = useState<{
    value: number;
    checks: Check[];
  } | null>(null);
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
      if (
        e instanceof ApiError &&
        typeof e.detail === "object" &&
        (e.detail as any)?.paywall
      ) {
        setPaywall(e.detail);
      } else if (e instanceof TypeError) {
        setError(
          "Could not reach the ResumeLab API. Start the backend, or try again shortly."
        );
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    } finally {
      setBusy(null);
    }
  }

  const startWizard = () =>
    run("wizard", async () => {
      setStep("loading");
      setLoadingMsg("Analyzing your resume for gaps...");
      const r = await api("/wizard/start", {
        method: "POST",
        body: JSON.stringify({ resume_id: resumeId }),
      });
      setVersionId(r.version_id);
      setQuestions(r.questions);
      if (r.questions.length) {
        setStep("wizard");
      } else {
        setStep("composing");
        setLoadingMsg("Building your resume...");
        await compose(r.version_id);
      }
    });

  const handleWizardComplete = (answers: Record<string, string>) => {
    run("answers", async () => {
      setStep("composing");
      setLoadingMsg("Crafting your resume with your answers...");
      const filtered = questions
        .filter((q) => answers[q.id]?.trim())
        .map((q) => ({
          id: q.id,
          question: q.question,
          answer: answers[q.id],
        }));
      if (filtered.length) {
        await api("/wizard/answers", {
          method: "POST",
          body: JSON.stringify({ version_id: versionId, answers: filtered }),
        });
      }
      await compose(versionId!);
    });
  };

  async function compose(vid: string) {
    const r = await api(`/versions/${vid}/compose`, { method: "POST" });
    setStatus(r.status);
    setMarkdown(r.markdown);
    setQuestions(r.open_questions ?? []);
    setStep("version");
    setScore(null);
  }

  const getScore = () =>
    run("score", async () => {
      setScore(
        await api(`/versions/${versionId}/score`, {
          method: "POST",
          body: "{}",
        })
      );
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
        `${
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
        }/versions/${versionId}/download/${fmt}`,
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
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <h1 className="text-lg font-bold text-slate-900">Resume Lab</h1>
        <Link
          href="/dashboard"
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          Dashboard
        </Link>
      </div>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Step: Start */}
      {step === "start" && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="max-w-md">
            <h2 className="text-3xl font-bold text-slate-900">
              Let&apos;s build your resume
            </h2>
            <p className="mt-3 text-slate-500">
              We&apos;ll ask a few quick questions to fill in the gaps. Nothing
              is ever invented — every fact comes from you.
            </p>
            <button
              onClick={startWizard}
              disabled={!!busy}
              className="mt-8 rounded-xl bg-slate-900 px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700 hover:shadow-xl disabled:opacity-60"
            >
              {busy ? "Analyzing..." : "Start"}
            </button>
          </div>
        </div>
      )}

      {/* Step: Loading */}
      {(step === "loading" || step === "composing") && (
        <LoadingScreen message={loadingMsg} />
      )}

      {/* Step: Wizard (Typeform style) */}
      {step === "wizard" && (
        <TypeformWizard
          questions={questions}
          onComplete={handleWizardComplete}
        />
      )}

      {/* Step: Version (resume result) */}
      {step === "version" && (
        <div className="space-y-6 pb-16">
          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                status === "final"
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {status.toUpperCase()}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => download("pdf")}
                disabled={!!busy}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                {busy === "pdf" ? "..." : "Download PDF"}
              </button>
              <button
                onClick={() => download("docx")}
                disabled={!!busy}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                {busy === "docx" ? "..." : "Download DOCX"}
              </button>
            </div>
            <button
              onClick={getScore}
              disabled={status !== "final" || !!busy}
              title={status !== "final" ? "Finalize to score" : ""}
              className="ml-auto rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-slate-700 disabled:opacity-40"
            >
              {busy === "score" ? "Scoring..." : "Get ATS Score"}
            </button>
          </div>

          {/* Resume preview */}
          <ResumePreview markdown={markdown} />

          {/* ATS Score */}
          {score && (
            <div className="mx-auto max-w-[680px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${
                    score.value >= 80
                      ? "border-green-500"
                      : score.value >= 60
                      ? "border-amber-500"
                      : "border-red-500"
                  }`}
                >
                  <span className="text-2xl font-bold">{score.value}</span>
                </div>
                <div>
                  <p className="text-lg font-semibold">ATS Score</p>
                  <p className="text-sm text-slate-500">
                    {score.value >= 80
                      ? "Strong — ready to send"
                      : score.value >= 60
                      ? "Good — a few improvements would help"
                      : "Needs work — see the breakdown below"}
                  </p>
                </div>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {score.checks.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span>
                      {c.label}{" "}
                      <span className="text-slate-400">— {c.detail}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs">
                      {c.points}/{c.max_points}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-slate-500">
                Want a second opinion? Try{" "}
                <a
                  href="https://resumeworded.com"
                  target="_blank"
                  rel="noopener"
                  className="font-medium text-slate-700 underline"
                >
                  Resume Worded
                </a>{" "}
                and paste its findings below.
              </p>
            </div>
          )}

          {/* Score Repair + JD Enhance + Outcomes */}
          {status === "final" && (
            <div className="mx-auto max-w-[680px] space-y-6">
              {/* Score repair */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold">Score Repair</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Paste findings from an external checker. Fixes are targeted
                  — never a blind rewrite. Missing numbers become questions.
                </p>
                <textarea
                  className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  rows={3}
                  placeholder={"e.g.\nQuantify impact: 6\nBuzzwords: 8"}
                  value={repairText}
                  onChange={(e) => setRepairText(e.target.value)}
                />
                <button
                  onClick={runRepair}
                  disabled={!repairText.trim() || !!busy}
                  className="mt-2 rounded-lg border border-slate-200 px-5 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-40"
                >
                  {busy === "repair" ? "Repairing..." : "Apply Targeted Fixes"}
                </button>
                {repairResult && (
                  <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm">
                    <p className="font-semibold text-green-800">
                      {repairResult.before_score} → {repairResult.after_score}
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-green-700">
                      {repairResult.actions?.map((a: string) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* JD Enhance */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold">
                  Tailor to a Job Description
                </h2>
                <textarea
                  className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  rows={4}
                  placeholder="Paste the full job description..."
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                />
                <button
                  onClick={runEnhance}
                  disabled={jdText.trim().length < 30 || !!busy}
                  className="mt-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
                >
                  {busy === "enhance" ? "Tailoring..." : "Create Tailored Variant"}
                </button>
                {paywall && (
                  <div className="mt-3 rounded-lg bg-amber-50 p-4 text-sm">
                    <p className="font-semibold">{paywall.message}</p>
                    <p className="mt-1 text-slate-600">
                      ₹{paywall.price_inr} per run. Payment options on the
                      dashboard.
                    </p>
                  </div>
                )}
                {enhanceResult && (
                  <div className="mt-3 text-sm">
                    <ul className="list-disc pl-5 text-slate-600">
                      {enhanceResult.actions?.map((a: string) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                    <p className="mt-2">
                      Coverage: {enhanceResult.coverage.present.length} matched,{" "}
                      {enhanceResult.coverage.missing.length} missing
                      {enhanceResult.coverage.missing.length > 0 &&
                        ` (${enhanceResult.coverage.missing
                          .slice(0, 6)
                          .join(", ")})`}
                    </p>
                  </div>
                )}
              </div>

              {/* Outcome tracking */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold">
                  Track Where This Went
                </h2>
                <div className="mt-3 flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="Company / job board"
                    value={outcomeSentTo}
                    onChange={(e) => setOutcomeSentTo(e.target.value)}
                  />
                  <button
                    onClick={logOutcome}
                    disabled={!outcomeSentTo.trim() || !!busy}
                    className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    Log it
                  </button>
                </div>
                {outcomeLogged && (
                  <p className="mt-2 text-sm text-green-700">
                    Logged. Update the result from the dashboard when you hear
                    back.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
type Structure = {
  id: string;
  name: string;
  audience: string;
  section_order: string[];
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

const SECTION_LABELS: Record<string, string> = {
  contact: "Contact",
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  core_skills_expanded: "Core Skills",
  projects_and_internships: "Projects & Internships",
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
      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span className="font-medium">
          {current + 1} of {questions.length}
        </span>
        <span>{Math.round(progress)}% complete</span>
      </div>
      <div className="mb-12 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

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
                      ? "Type a number — or Skip if none exists"
                      : "Type your answer — or Skip if you'd rather not"
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

          {/* Action row: Back | Skip (prominent) | Next/Finish */}
          <div className="mt-10 flex items-center gap-3">
            {current > 0 && (
              <button
                onClick={() => setCurrent((c) => c - 1)}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleSkip}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Skip this question
            </button>
            <button
              onClick={handleNext}
              disabled={q.kind === "mc" && !answers[q.id]}
              className="ml-auto rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLast ? "Finish →" : "Next →"}
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Press{" "}
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">
              Enter
            </kbd>{" "}
            to continue, or click Skip if you don't have this info.
          </p>
        </div>
      </div>
    </div>
  );
}

function TemplateSelector({
  structures,
  selected,
  onSelect,
  onContinue,
}: {
  structures: Structure[];
  selected: string;
  onSelect: (id: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="w-full max-w-2xl">
        <h2 className="text-2xl font-bold text-slate-900">
          Choose a resume template
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Each template uses the same clean, ATS-friendly format. They differ in
          section order and emphasis.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {structures.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`rounded-xl border-2 p-5 text-left transition ${
                selected === s.id
                  ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                  : "border-slate-200 bg-white hover:border-slate-400"
              }`}
            >
              <p className="font-semibold text-slate-900">{s.name}</p>
              <p className="mt-1 text-xs text-slate-500">{s.audience}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {s.section_order
                  .filter((sec) => sec !== "contact")
                  .map((sec) => (
                    <span
                      key={sec}
                      className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                    >
                      {SECTION_LABELS[sec] || sec}
                    </span>
                  ))}
              </div>
            </button>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <button
            onClick={onContinue}
            className="rounded-xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700"
          >
            Build with this template
          </button>
        </div>
      </div>
    </div>
  );
}

function ResumePreview({
  versionId,
  refreshKey,
}: {
  versionId: string;
  refreshKey: number;
}) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const resp = await fetch(
          `${
            process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
          }/versions/${versionId}/preview`,
          { headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
        if (!resp.ok) throw new Error("Preview failed");
        const text = await resp.text();
        if (!cancelled) setHtml(text);
      } catch {
        if (!cancelled) setHtml("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [versionId, refreshKey]);

  return (
    <div className="mx-auto max-w-[820px]">
      <div
        className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        style={{ aspectRatio: "1 / 1.414" /* A4 */ }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
          </div>
        ) : html ? (
          <iframe
            srcDoc={html}
            title="Resume preview"
            className="h-full w-full"
            sandbox=""
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Preview unavailable
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">
        This preview matches your downloaded PDF exactly.
      </p>
    </div>
  );
}

function OriginalResumeView({ parsed }: { parsed: any }) {
  if (!parsed) return null;
  const { contact, sections } = parsed;

  return (
    <div className="mx-auto max-w-[680px] rounded-lg border border-slate-200 bg-slate-50 px-8 py-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Your uploaded resume
      </p>
      {contact?.name && (
        <p className="text-lg font-bold text-slate-900">{contact.name}</p>
      )}
      <p className="text-xs text-slate-500">
        {[contact?.email, contact?.phone, contact?.linkedin]
          .filter(Boolean)
          .join(" | ")}
      </p>

      {sections?.summary && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Summary
          </p>
          <p className="text-xs text-slate-700">{sections.summary}</p>
        </div>
      )}

      {sections?.skills?.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Skills
          </p>
          <p className="text-xs text-slate-700">
            {sections.skills.join(", ")}
          </p>
        </div>
      )}

      {sections?.experience?.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Experience
          </p>
          {sections.experience.map((e: any, i: number) => (
            <div key={i} className="mt-1">
              <p className="text-xs font-semibold text-slate-800">
                {e.header?.join(" | ")}
              </p>
              {e.bullets?.map((b: string, j: number) => (
                <p key={j} className="ml-3 text-xs text-slate-600">
                  - {b}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {sections?.education?.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Education
          </p>
          {sections.education.map((e: any, i: number) => (
            <p key={i} className="text-xs text-slate-700">
              {e.header?.join(" | ")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function Flow({ resumeId }: { resumeId: string }) {
  const [step, setStep] = useState<
    | "init"
    | "start"
    | "loading"
    | "wizard"
    | "template"
    | "composing"
    | "version"
  >("init");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("Analyzing your resume...");

  const [versionId, setVersionId] = useState<string | null>(null);
  const [structureId, setStructureId] = useState<string>("S1");
  const [structures, setStructures] = useState<Structure[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState<string>("draft");
  const [markdown, setMarkdown] = useState<string>("");
  const [previewKey, setPreviewKey] = useState(0);
  const [parsedResume, setParsedResume] = useState<any>(null);
  const [showOriginal, setShowOriginal] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [existingVersions, structs] = await Promise.all([
          api(`/versions/by-resume/${resumeId}`),
          api("/versions/structures"),
        ]);
        if (cancelled) return;
        setStructures(structs);

        const latest = existingVersions?.[0];
        if (latest?.markdown) {
          setVersionId(latest.id);
          setStructureId(latest.structure_id);
          setStatus(latest.status);
          setMarkdown(latest.markdown);
          setStep("version");
        } else if (latest) {
          setVersionId(latest.id);
          setStructureId(latest.structure_id);
          setStep("start");
        } else {
          setStep("start");
        }

        const resumes = await api(`/resumes/${resumeId}`).catch(() => null);
        if (resumes?.parsed_json) {
          setParsedResume(resumes.parsed_json);
        }
      } catch {
        if (!cancelled) setStep("start");
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [resumeId]);

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
      setStructureId(r.structure_id);
      setQuestions(r.questions);
      if (r.questions.length) {
        setStep("wizard");
      } else {
        setStep("template");
      }
    });

  const handleWizardComplete = (answers: Record<string, string>) => {
    run("answers", async () => {
      setStep("loading");
      setLoadingMsg("Saving your answers...");
      const allAnswers = questions.map((q) => ({
        id: q.id,
        question: q.question,
        answer: answers[q.id]?.trim() || "",
      }));
      await api("/wizard/answers", {
        method: "POST",
        body: JSON.stringify({ version_id: versionId, answers: allAnswers }),
      });
      setStep("template");
    });
  };

  const handleTemplateSelect = () =>
    run("template", async () => {
      setStep("composing");
      setLoadingMsg("Building your resume...");
      await api(`/versions/${versionId}/structure`, {
        method: "PATCH",
        body: JSON.stringify({ structure_id: structureId }),
      });
      await compose(versionId!);
    });

  async function compose(vid: string) {
    const r = await api(`/versions/${vid}/compose`, { method: "POST" });
    setStatus(r.status);
    setMarkdown(r.markdown);
    setQuestions(r.open_questions ?? []);
    setStep("version");
    setScore(null);
    setPreviewKey((k) => k + 1);
  }

  const recompose = () =>
    run("recompose", async () => {
      setStep("composing");
      setLoadingMsg("Rebuilding with new template...");
      await compose(versionId!);
    });

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
      if (r.markdown) {
        setMarkdown(r.markdown);
        setPreviewKey((k) => k + 1);
      }
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

      {/* Init: loading state */}
      {step === "init" && <LoadingScreen message="Loading your resume..." />}

      {/* Start */}
      {step === "start" && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="max-w-md">
            <h2 className="text-3xl font-bold text-slate-900">
              Let&apos;s build your resume
            </h2>
            <p className="mt-3 text-slate-500">
              We&apos;ll ask a few quick questions to fill in the gaps, then you
              pick a template. Nothing is ever invented — every fact comes from
              you.
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

      {/* Loading / Composing */}
      {(step === "loading" || step === "composing") && (
        <LoadingScreen message={loadingMsg} />
      )}

      {/* Wizard */}
      {step === "wizard" && (
        <TypeformWizard
          questions={questions}
          onComplete={handleWizardComplete}
        />
      )}

      {/* Template selection */}
      {step === "template" && (
        <TemplateSelector
          structures={structures}
          selected={structureId}
          onSelect={setStructureId}
          onContinue={handleTemplateSelect}
        />
      )}

      {/* Version result */}
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
                {busy === "pdf" ? "..." : "PDF"}
              </button>
              <button
                onClick={() => download("docx")}
                disabled={!!busy}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                {busy === "docx" ? "..." : "DOCX"}
              </button>
            </div>

            {/* Template switcher */}
            <select
              value={structureId}
              onChange={async (e) => {
                const newId = e.target.value;
                setStructureId(newId);
                await run("template-switch", async () => {
                  await api(`/versions/${versionId}/structure`, {
                    method: "PATCH",
                    body: JSON.stringify({ structure_id: newId }),
                  });
                });
                recompose();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <button
              onClick={getScore}
              disabled={status !== "final" || !!busy}
              title={status !== "final" ? "Finalize to score" : ""}
              className="ml-auto rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-slate-700 disabled:opacity-40"
            >
              {busy === "score" ? "Scoring..." : "Get ATS Score"}
            </button>
          </div>

          {/* Original resume toggle */}
          {parsedResume && (
            <div className="flex justify-center">
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className="text-xs font-medium text-slate-500 underline transition hover:text-slate-700"
              >
                {showOriginal
                  ? "Hide original resume"
                  : "Show original uploaded resume"}
              </button>
            </div>
          )}

          {showOriginal && <OriginalResumeView parsed={parsedResume} />}

          {/* Resume preview */}
          {versionId && (
            <ResumePreview versionId={versionId} refreshKey={previewKey} />
          )}

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
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold">Score Repair</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Paste findings from an external checker. Fixes are targeted —
                  never a blind rewrite. Missing numbers become questions.
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
                  {busy === "enhance"
                    ? "Tailoring..."
                    : "Create Tailored Variant"}
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

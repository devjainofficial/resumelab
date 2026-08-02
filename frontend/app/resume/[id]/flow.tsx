"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { BuilderStep } from "./builder-step";
import { LabLoader } from "@/app/_components/lab-loader";

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

const NUMBER_HINTS: Record<string, string> = {
  team: "e.g. 5, 12, 30+",
  user: "e.g. 1,000 to 500,000",
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

function TypeformWizard({
  questions: initialQuestions,
  resumeId,
  onComplete,
}: {
  questions: Question[];
  resumeId: string;
  onComplete: (answers: Record<string, string>) => void;
}) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const q = questions[current];
  const isLast = current === questions.length - 1;
  const progress = ((current + 1) / questions.length) * 100;

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete(answers);
      return;
    }
    // After the preface question (additional_content), fetch follow-up questions
    if (q?.id === "additional_content") {
      const extra = answers["additional_content"]?.trim() ?? "";
      if (extra.length > 30) {
        api("/wizard/additional-questions", {
          method: "POST",
          body: JSON.stringify({ resume_id: resumeId, additional_content: extra }),
        })
          .then((r) => {
            const followUps: Question[] = (r?.questions ?? []).map((fq: Question) => ({
              ...fq,
              kind: fq.kind ?? "text",
            }));
            if (followUps.length > 0) {
              setQuestions((prev) => [
                ...prev.slice(0, current + 1),
                ...followUps,
                ...prev.slice(current + 1),
              ]);
            }
          })
          .catch(() => {});
      }
    }
    setCurrent((c) => c + 1);
  }, [isLast, answers, onComplete, q, current, resumeId]);

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

  useEffect(() => {
    setSuggestNote(null);
  }, [current]);

  const suggestForCurrent = async () => {
    if (!q || suggesting) return;
    setSuggesting(true);
    setSuggestNote(null);
    try {
      const r = await api("/wizard/suggest", {
        method: "POST",
        body: JSON.stringify({
          resume_id: resumeId,
          question: q.question,
          question_id: q.id,
        }),
      });
      const suggestion = (r?.suggestion ?? "").trim();
      if (suggestion) {
        setAnswers((a) => ({ ...a, [q.id]: suggestion }));
        setSuggestNote(
          r?.confidence === "high"
            ? "AI suggested this from your resume. Feel free to edit."
            : "Best-guess from your resume. Review before continuing."
        );
      } else {
        setSuggestNote(
          "No signal in your resume for this. Please type your own answer."
        );
      }
    } catch {
      setSuggestNote("AI suggest unavailable right now.");
    } finally {
      setSuggesting(false);
    }
  };

  if (!q) return null;
  const hint = q.kind === "number" ? getHint(q.question) : null;
  const isFreeText = q.kind === "number" || q.kind === "text";

  return (
    <div className="flex min-h-[80vh] flex-col">
      {/* Progress header */}
      <div className="mb-3 flex items-center justify-between font-mono text-xs text-muted">
        <span className="font-medium">
          {current + 1} of {questions.length}
        </span>
        <span>{Math.round(progress)}% complete</span>
      </div>
      <div className="mb-12 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-lg">
          <p className="mb-1 font-mono text-xs text-muted">
            Question {current + 1}
          </p>
          <h2 className="text-2xl font-semibold leading-snug text-ink">
            {q.question}
          </h2>

          <div className="mt-8">
            {q.kind === "mc" && q.options ? (
              <div className="space-y-3">
                {q.options.map((o) => (
                  <button
                    key={o}
                    onClick={() => setAnswers({ ...answers, [q.id]: o })}
                    className={`block w-full rounded-xl border-2 px-5 py-3.5 text-left text-sm font-medium transition ${
                      answers[q.id] === o
                        ? "border-brand bg-brand text-brand-on"
                        : "border-line bg-surface text-ink hover:border-line-strong"
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
                  className="w-full border-b-2 border-line-strong bg-transparent pb-2 text-lg text-ink outline-none transition focus:border-brand"
                  type="text"
                  placeholder={
                    q.kind === "number"
                      ? "Type a number, or Skip if none exists"
                      : "Type your answer, or Skip if you'd rather not"
                  }
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [q.id]: e.target.value })
                  }
                />
                {hint && (
                  <p className="mt-2 text-sm text-muted">{hint}</p>
                )}
                {isFreeText && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={suggestForCurrent}
                      disabled={suggesting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet/20 bg-violet-tint px-3 py-1.5 text-xs font-medium text-violet transition hover:bg-violet/10 disabled:opacity-50"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 3v3m0 12v3M3 12h3m12 0h3m-4.5-7.5L15 9m3.5 6l-1.5 1.5m-9 0L7 15m0-6L5.5 7.5"
                        />
                      </svg>
                      {suggesting ? "Suggesting…" : "AI suggest an answer"}
                    </button>
                    {suggestNote && (
                      <span className="text-xs text-muted">{suggestNote}</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action row */}
          <div className="mt-10 flex items-center gap-3">
            {current > 0 && (
              <button
                onClick={() => setCurrent((c) => c - 1)}
                className="rounded-xl border border-line px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-sunken"
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleSkip}
              className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-sunken"
            >
              Skip this question
            </button>
            <button
              onClick={handleNext}
              disabled={q.kind === "mc" && !answers[q.id]}
              className="ml-auto rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-brand-on transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLast ? "Finish →" : "Next →"}
            </button>
          </div>

          <p className="mt-4 text-xs text-muted">
            Press{" "}
            <kbd className="rounded bg-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
              Enter
            </kbd>{" "}
            to continue, or click Skip if you don&apos;t have this info.
          </p>
        </div>
      </div>
    </div>
  );
}

const TEMPLATE_SVGS: Record<string, string> = {
  S1: `
    <text x="47" y="10" text-anchor="middle" font-size="7.5" font-weight="700" letter-spacing="1" fill="#0a0a0a">FULL NAME</text>
    <text x="47" y="15.5" text-anchor="middle" font-size="3.5" fill="#555">email · phone · linkedin · github</text>
    <line x1="6" y1="18.5" x2="88" y2="18.5" stroke="#0a0a0a" stroke-width="0.6"/>
    <text x="6" y="25" font-size="4" font-weight="700" letter-spacing="0.9" fill="#0a0a0a">EDUCATION</text>
    <line x1="6" y1="26.5" x2="88" y2="26.5" stroke="#0a0a0a" stroke-width="0.4"/>
    <rect x="6" y="29" width="44" height="3" rx="1" fill="#374151" opacity="0.65"/>
    <rect x="64" y="29" width="24" height="3" rx="1" fill="#9ca3af" opacity="0.5"/>
    <rect x="8" y="35" width="55" height="2" rx="1" fill="#d1d5db"/>
    <text x="6" y="45" font-size="4" font-weight="700" letter-spacing="0.9" fill="#0a0a0a">EXPERIENCE</text>
    <line x1="6" y1="46.5" x2="88" y2="46.5" stroke="#0a0a0a" stroke-width="0.4"/>
    <rect x="6" y="49" width="48" height="3" rx="1" fill="#374151" opacity="0.65"/>
    <rect x="60" y="49" width="28" height="3" rx="1" fill="#9ca3af" opacity="0.5"/>
    <rect x="8" y="55" width="72" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="59" width="65" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="63" width="68" height="2" rx="1" fill="#d1d5db"/>
    <rect x="6" y="69" width="40" height="3" rx="1" fill="#374151" opacity="0.55"/>
    <rect x="64" y="69" width="24" height="3" rx="1" fill="#9ca3af" opacity="0.4"/>
    <rect x="8" y="75" width="70" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="79" width="58" height="2" rx="1" fill="#d1d5db"/>
    <text x="6" y="88" font-size="4" font-weight="700" letter-spacing="0.9" fill="#0a0a0a">PROJECTS</text>
    <line x1="6" y1="89.5" x2="88" y2="89.5" stroke="#0a0a0a" stroke-width="0.4"/>
    <rect x="6" y="92" width="36" height="3" rx="1" fill="#374151" opacity="0.6"/>
    <rect x="8" y="98" width="72" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="102" width="60" height="2" rx="1" fill="#d1d5db"/>
    <text x="6" y="110" font-size="4" font-weight="700" letter-spacing="0.9" fill="#0a0a0a">SKILLS</text>
    <line x1="6" y1="111.5" x2="88" y2="111.5" stroke="#0a0a0a" stroke-width="0.4"/>
    <rect x="6" y="114" width="80" height="2" rx="1" fill="#d1d5db"/>
    <rect x="6" y="119" width="58" height="2" rx="1" fill="#d1d5db"/>`,

  S2: `
    <text x="6" y="11" font-size="8" font-weight="700" fill="#0f172a">Full Name</text>
    <line x1="6" y1="14.5" x2="88" y2="14.5" stroke="#266df0" stroke-width="1.5"/>
    <text x="6" y="20" font-size="3.5" fill="#64748b">email · phone · linkedin · github</text>
    <rect x="6" y="24" width="80" height="2" rx="1" fill="#cbd5e1"/>
    <rect x="6" y="28" width="62" height="2" rx="1" fill="#cbd5e1"/>
    <text x="6" y="37" font-size="4" font-weight="700" letter-spacing="0.9" fill="#266df0">SKILLS</text>
    <line x1="6" y1="38.5" x2="88" y2="38.5" stroke="#266df0" stroke-width="0.4"/>
    <rect x="6" y="41" width="78" height="2" rx="1" fill="#d1d5db"/>
    <rect x="6" y="45" width="55" height="2" rx="1" fill="#d1d5db"/>
    <text x="6" y="53" font-size="4" font-weight="700" letter-spacing="0.9" fill="#266df0">EXPERIENCE</text>
    <line x1="6" y1="54.5" x2="88" y2="54.5" stroke="#266df0" stroke-width="0.4"/>
    <rect x="6" y="57" width="44" height="3" rx="1" fill="#374151" opacity="0.7"/>
    <rect x="60" y="57" width="28" height="3" rx="1" fill="#9ca3af" opacity="0.5"/>
    <rect x="8" y="63" width="72" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="67" width="65" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="71" width="70" height="2" rx="1" fill="#d1d5db"/>
    <text x="6" y="80" font-size="4" font-weight="700" letter-spacing="0.9" fill="#266df0">PROJECTS</text>
    <line x1="6" y1="81.5" x2="88" y2="81.5" stroke="#266df0" stroke-width="0.4"/>
    <rect x="6" y="84" width="36" height="3" rx="1" fill="#374151" opacity="0.6"/>
    <rect x="8" y="90" width="75" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="94" width="60" height="2" rx="1" fill="#d1d5db"/>
    <rect x="6" y="99" width="30" height="3" rx="1" fill="#374151" opacity="0.5"/>
    <rect x="8" y="105" width="68" height="2" rx="1" fill="#d1d5db"/>
    <text x="6" y="113" font-size="4" font-weight="700" letter-spacing="0.9" fill="#266df0">EDUCATION</text>
    <line x1="6" y1="114.5" x2="88" y2="114.5" stroke="#266df0" stroke-width="0.4"/>
    <rect x="6" y="117" width="46" height="2.5" rx="1" fill="#374151" opacity="0.6"/>
    <rect x="60" y="117" width="26" height="2.5" rx="1" fill="#9ca3af" opacity="0.4"/>
    <rect x="6" y="122" width="54" height="2" rx="1" fill="#d1d5db"/>`,

  S3: `
    <text x="6" y="11" font-size="7.5" font-weight="700" fill="#0a0a0a">Full Name</text>
    <text x="6" y="17" font-size="3.5" fill="#555">email · phone · linkedin</text>
    <line x1="6" y1="20" x2="88" y2="20" stroke="#245bc2" stroke-width="1"/>
    <rect x="6" y="24" width="80" height="2" rx="1" fill="#cbd5e1"/>
    <rect x="6" y="28" width="62" height="2" rx="1" fill="#cbd5e1"/>
    <text x="6" y="36" font-size="4" font-weight="700" letter-spacing="0.9" fill="#245bc2">EDUCATION</text>
    <line x1="6" y1="37.5" x2="88" y2="37.5" stroke="#245bc2" stroke-width="0.4"/>
    <rect x="6" y="40" width="48" height="3" rx="1" fill="#374151" opacity="0.7"/>
    <rect x="62" y="40" width="26" height="3" rx="1" fill="#9ca3af" opacity="0.5"/>
    <rect x="8" y="46" width="55" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="50" width="44" height="2" rx="1" fill="#d1d5db"/>
    <text x="6" y="58" font-size="3.8" font-weight="700" letter-spacing="0.7" fill="#245bc2">PROJECTS &amp; INTERNSHIPS</text>
    <line x1="6" y1="59.5" x2="88" y2="59.5" stroke="#245bc2" stroke-width="0.4"/>
    <rect x="6" y="62" width="36" height="3" rx="1" fill="#374151" opacity="0.65"/>
    <rect x="8" y="68" width="74" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="72" width="60" height="2" rx="1" fill="#d1d5db"/>
    <rect x="6" y="77" width="32" height="3" rx="1" fill="#374151" opacity="0.55"/>
    <rect x="8" y="83" width="68" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="87" width="55" height="2" rx="1" fill="#d1d5db"/>
    <text x="6" y="95" font-size="4" font-weight="700" letter-spacing="0.9" fill="#245bc2">SKILLS</text>
    <line x1="6" y1="96.5" x2="88" y2="96.5" stroke="#245bc2" stroke-width="0.4"/>
    <rect x="6" y="99" width="80" height="2" rx="1" fill="#d1d5db"/>
    <rect x="6" y="103" width="58" height="2" rx="1" fill="#d1d5db"/>`,

  S4: `
    <text x="6" y="11" font-size="7.5" font-weight="700" fill="#0a0a0a">Full Name</text>
    <text x="6" y="17" font-size="3.5" fill="#555">email · phone · linkedin</text>
    <line x1="6" y1="20" x2="88" y2="20" stroke="#333" stroke-width="0.8"/>
    <rect x="6" y="23" width="80" height="2" rx="1" fill="#cbd5e1"/>
    <rect x="6" y="27" width="65" height="2" rx="1" fill="#cbd5e1"/>
    <rect x="6" y="31" width="50" height="2" rx="1" fill="#cbd5e1"/>
    <text x="6" y="39" font-size="4" font-weight="700" letter-spacing="0.9" fill="#0a0a0a">CORE SKILLS</text>
    <line x1="6" y1="40.5" x2="88" y2="40.5" stroke="#333" stroke-width="0.4"/>
    <rect x="6" y="43" width="36" height="3.5" rx="1.75" fill="#e5e7eb"/>
    <rect x="6" y="48" width="32" height="3.5" rx="1.75" fill="#e5e7eb"/>
    <rect x="6" y="53" width="38" height="3.5" rx="1.75" fill="#e5e7eb"/>
    <rect x="47" y="43" width="30" height="3.5" rx="1.75" fill="#e5e7eb"/>
    <rect x="47" y="48" width="35" height="3.5" rx="1.75" fill="#e5e7eb"/>
    <rect x="47" y="53" width="28" height="3.5" rx="1.75" fill="#e5e7eb"/>
    <text x="6" y="64" font-size="4" font-weight="700" letter-spacing="0.9" fill="#0a0a0a">EXPERIENCE</text>
    <line x1="6" y1="65.5" x2="88" y2="65.5" stroke="#333" stroke-width="0.4"/>
    <rect x="6" y="68" width="44" height="3" rx="1" fill="#374151" opacity="0.7"/>
    <rect x="60" y="68" width="28" height="3" rx="1" fill="#9ca3af" opacity="0.5"/>
    <rect x="8" y="74" width="72" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="78" width="65" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="82" width="70" height="2" rx="1" fill="#d1d5db"/>
    <rect x="6" y="88" width="38" height="3" rx="1" fill="#374151" opacity="0.55"/>
    <rect x="56" y="88" width="32" height="3" rx="1" fill="#9ca3af" opacity="0.4"/>
    <rect x="8" y="94" width="70" height="2" rx="1" fill="#d1d5db"/>
    <rect x="8" y="98" width="58" height="2" rx="1" fill="#d1d5db"/>
    <text x="6" y="106" font-size="4" font-weight="700" letter-spacing="0.9" fill="#0a0a0a">EDUCATION</text>
    <line x1="6" y1="107.5" x2="88" y2="107.5" stroke="#333" stroke-width="0.4"/>
    <rect x="6" y="110" width="48" height="2.5" rx="1" fill="#374151" opacity="0.6"/>
    <rect x="62" y="110" width="26" height="2.5" rx="1" fill="#9ca3af" opacity="0.4"/>
    <rect x="6" y="115" width="55" height="2" rx="1" fill="#d1d5db"/>`,
};

function recommendStructure(parsed: any): string {
  if (!parsed) return "S1";
  const exp = parsed.sections?.experience ?? [];
  const proj = parsed.sections?.projects ?? [];
  const hasExp = exp.length > 0;
  const hasProj = proj.length > 0;
  // No dated experience at all + has projects → Fresher (S3)
  if (!hasExp && hasProj) return "S3";
  // Has both experience and notable projects → Jake's (S2)
  if (hasExp && hasProj) return "S2";
  return "S1";
}

function TemplateMiniSvg({ structureId }: { structureId: string; sections?: string[] }) {
  const inner = TEMPLATE_SVGS[structureId] ?? TEMPLATE_SVGS.S1;
  return (
    <svg viewBox="0 0 94 130" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <rect width="94" height="130" fill="white"/>
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </svg>
  );
}

function TemplateSelector({
  structures,
  selected,
  recommended,
  onSelect,
  onContinue,
}: {
  structures: Structure[];
  selected: string;
  recommended?: string;
  onSelect: (id: string) => void;
  onContinue: () => void;
}) {
  const [zoom, setZoom] = useState<string | null>(null);
  const zoomed = zoom ? structures.find((s) => s.id === zoom) : null;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="w-full max-w-3xl">
        <h2 className="font-serif text-2xl font-medium text-ink">
          Choose a resume layout
        </h2>
        <p className="mt-2 text-sm text-muted">
          All layouts are ATS-safe: single column, standard headings, text-selectable. Click any card to zoom.
        </p>
        {recommended && recommended !== selected && (
          <p className="mt-3 text-sm text-brand">
            Based on your resume we pre-selected{" "}
            <strong>{structures.find((s) => s.id === recommended)?.name ?? recommended}</strong>.
            You can change it below.
          </p>
        )}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {structures.map((s) => (
            <div key={s.id} className="group flex flex-col">
              <button
                onClick={() => setZoom(s.id)}
                className={`relative overflow-hidden rounded-lg border-2 transition ${
                  selected === s.id
                    ? "border-brand ring-1 ring-brand"
                    : "border-line hover:border-line-strong"
                }`}
              >
                {recommended === s.id && (
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-brand px-2 py-0.5 font-mono text-[9px] font-semibold text-brand-on shadow">
                    Best match
                  </span>
                )}
                <div className="p-1.5 shadow-sm" style={{ background: "#fff" }}>
                  <TemplateMiniSvg structureId={s.id} sections={s.section_order} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-ink/0 opacity-0 transition group-hover:bg-ink/10 group-hover:opacity-100">
                  <span className="rounded-full bg-ink/80 px-2 py-1 text-[10px] font-medium text-paper">
                    Zoom in
                  </span>
                </div>
              </button>
              <button
                onClick={() => onSelect(s.id)}
                className={`mt-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                  selected === s.id
                    ? "border-brand bg-brand-tint text-brand-strong"
                    : "border-line bg-surface text-ink hover:border-line-strong hover:bg-sunken"
                }`}
              >
                <span className="block font-semibold">{s.name}</span>
                <span className="mt-0.5 block text-muted">{s.audience}</span>
              </button>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-4">
          <p className="text-xs text-muted">
            Selected: <span className="font-medium text-ink">{structures.find((s) => s.id === selected)?.name ?? selected}</span>
          </p>
          <button
            onClick={onContinue}
            className="rounded-xl bg-brand px-8 py-3 text-sm font-semibold text-brand-on shadow-sm transition hover:bg-brand-strong"
          >
            Build with this layout →
          </button>
        </div>
      </div>

      {/* Zoom modal */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6 backdrop-blur-sm"
          onClick={() => setZoom(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="font-semibold text-ink">{zoomed.name}</p>
                <p className="text-xs text-muted">{zoomed.audience}</p>
              </div>
              <button onClick={() => setZoom(null)} className="text-muted transition hover:text-ink">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="p-4" style={{ background: "#fff" }}>
              <TemplateMiniSvg structureId={zoomed.id} sections={zoomed.section_order} />
            </div>
            <div className="flex gap-2 border-t border-line px-4 py-3">
              <button
                onClick={() => { onSelect(zoomed.id); setZoom(null); }}
                className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-brand-on transition hover:bg-brand-strong"
              >
                Use this layout
              </button>
              <button
                onClick={() => setZoom(null)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-sunken"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
    <div className="mx-auto max-w-[860px]">
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-line bg-surface">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" />
        </div>
      ) : html ? (
        <iframe
          srcDoc={html}
          title="Resume preview"
          className="w-full rounded-lg border border-line shadow-md"
          style={{ height: "1180px" }}
          sandbox=""
        />
      ) : (
        <div className="flex h-64 items-center justify-center rounded-xl border border-line bg-surface text-sm text-muted">
          Preview unavailable
        </div>
      )}
      <p className="mt-2 text-center font-mono text-xs text-muted">
        Preview · the downloaded PDF matches exactly.
      </p>
    </div>
  );
}

function OriginalResumeView({ parsed }: { parsed: any }) {
  if (!parsed) return null;
  const { contact, sections } = parsed;

  return (
    <div className="mx-auto max-w-[680px] rounded-lg border border-line bg-sunken px-8 py-6">
      <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-muted">
        Your uploaded resume
      </p>
      {contact?.name && (
        <p className="text-lg font-bold text-ink">{contact.name}</p>
      )}
      <p className="text-xs text-muted">
        {[contact?.email, contact?.phone, contact?.linkedin]
          .filter(Boolean)
          .join(" | ")}
      </p>

      {sections?.summary && (
        <div className="mt-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
            Summary
          </p>
          <p className="text-xs text-ink-soft">{sections.summary}</p>
        </div>
      )}

      {sections?.skills?.length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
            Skills
          </p>
          <p className="text-xs text-ink-soft">{sections.skills.join(", ")}</p>
        </div>
      )}

      {sections?.experience?.length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
            Experience
          </p>
          {sections.experience.map((e: any, i: number) => (
            <div key={i} className="mt-1">
              <p className="text-xs font-semibold text-ink">
                {e.header?.join(" | ")}
              </p>
              {e.bullets?.map((b: string, j: number) => (
                <p key={j} className="ml-3 text-xs text-ink-soft">
                  - {b}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {sections?.education?.length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
            Education
          </p>
          {sections.education.map((e: any, i: number) => (
            <p key={i} className="text-xs text-ink-soft">
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
    | "builder"
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
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [parsedResume, setParsedResume] = useState<any>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [score, setScore] = useState<{
    value: number;
    checks: Check[];
  } | null>(null);
  const [repairText, setRepairText] = useState("");
  const [repairResult, setRepairResult] = useState<any>(null);
  const [repairFile, setRepairFile] = useState<File | null>(null);
  const [repairDragOver, setRepairDragOver] = useState(false);
  const [showReadyBanner, setShowReadyBanner] = useState(false);
  const [jdText, setJdText] = useState("");
  const [enhanceResult, setEnhanceResult] = useState<any>(null);
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
          setStep("builder");
        } else {
          setStep("builder");
        }

        const resumes = await api(`/resumes/${resumeId}`).catch(() => null);
        if (resumes?.parsed_json) {
          setParsedResume(resumes.parsed_json);
        }
      } catch {
        if (!cancelled) setStep("builder");
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [resumeId]);

  async function run(label: string, fn: () => Promise<void>): Promise<boolean> {
    setBusy(label);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      if (e instanceof TypeError) {
        setError(
          "The backend took too long to respond. It may still be starting up — please refresh the page in 30 seconds."
        );
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
      return false;
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

      const preface: Question = {
        id: "additional_content",
        kind: "text",
        question:
          "Anything you'd like to add that isn't already in your resume? (Extra role, project, tools you've picked up recently, or nothing at all.)",
      };
      const finalQ: Question = {
        id: "target_role_focus",
        kind: "text",
        question:
          "In one line: what's the ONE role you're targeting next? (Used only to sharpen your summary. Never invented.)",
      };
      const augmented: Question[] = [preface, ...r.questions, finalQ];
      setQuestions(augmented);
      if (augmented.length) {
        setStep("wizard");
      } else {
        setStep("template");
      }
    });

  const handleBuilderContinue = (bulletAnswers: Record<string, string>) =>
    run("builder", async () => {
      setStep("loading");
      setLoadingMsg("Preparing your rewrite...");
      const r = await api("/wizard/start", {
        method: "POST",
        body: JSON.stringify({ resume_id: resumeId }),
      });
      setVersionId(r.version_id);
      // Use local recommendation from parsed resume; backend r.structure_id is fallback.
      const rec = recommendStructure(parsedResume);
      setStructureId(rec || r.structure_id);

      // Save any improve-popover answers as wizard answers for rewrite context
      if (Object.keys(bulletAnswers).length > 0) {
        await api("/wizard/answers", {
          method: "POST",
          body: JSON.stringify({
            version_id: r.version_id,
            answers: Object.entries(bulletAnswers).map(([id, answer]) => ({
              id,
              question: id,
              answer,
            })),
          }),
        });
      }

      setStep("template");
    });

  const handleWizardComplete = (answers: Record<string, string>) => {
    run("answers", async () => {
      setStep("loading");
      setLoadingMsg("Saving your answers...");
      // Apply fresher/non-fresher recommendation before showing template picker.
      const rec = recommendStructure(parsedResume);
      if (rec) setStructureId(rec);
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
      await compose(versionId!, true);
    });

  async function compose(vid: string, showBanner = false) {
    const r = await api(`/versions/${vid}/compose`, { method: "POST" });
    setStatus(r.status);
    setMarkdown(r.markdown);
    setQuestions(r.open_questions ?? []);
    setStep("version");
    setScore(null);
    setPreviewKey((k) => k + 1);
    if (showBanner) setShowReadyBanner(true);
  }

  const recompose = () =>
    run("recompose", async () => {
      setStep("composing");
      setLoadingMsg("Rebuilding with new template...");
      await compose(versionId!);
    });

  const stripWatermark = (md: string) =>
    md
      .split("\n")
      .filter((l) => !l.startsWith("> DRAFT"))
      .join("\n")
      .trim();

  const startEditing = () => {
    setEditText(stripWatermark(markdown));
    setEditing(true);
  };

  const saveEdit = (finalize: boolean, content?: string) =>
    run(finalize ? "finalize" : "save", async () => {
      const md = (content ?? editText).trim();
      const r = await api(`/versions/${versionId}/markdown`, {
        method: "PUT",
        body: JSON.stringify({ markdown: md, finalize }),
      });
      setMarkdown(r.markdown);
      setStatus(r.status);
      setEditing(false);
      setScore(null);
      setPreviewKey((k) => k + 1);
    });

  const reparseAndRebuild = () =>
    run("reparse", async () => {
      setStep("composing");
      setLoadingMsg("Re-reading your file with the latest engine...");
      const r = await api(`/resumes/${resumeId}/reparse`, { method: "POST" });
      setParsedResume(r.parsed);
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

  const runRepairScreenshot = () =>
    run("repair", async () => {
      if (!repairFile) return;
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData();
      form.append("file", repairFile);
      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/versions/${versionId}/repair/screenshot`,
        { method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` }, body: form }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail ?? `Upload failed (${resp.status})`);
      }
      const r = await resp.json();
      setRepairResult(r);
      setRepairFile(null);
      if (r.markdown) {
        setMarkdown(r.markdown);
        setPreviewKey((k) => k + 1);
      }
    });

  const runEnhance = () =>
    run("enhance", async () => {
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
    <div>
      {/* Error banner */}
      {error && (
        <p className="mb-6 rounded-lg border border-critical/30 bg-critical-tint px-4 py-3 text-sm text-critical">
          {error}
        </p>
      )}

      {/* Init */}
      {step === "init" && <LabLoader message="Loading your resume..." />}

      {/* Start (legacy fallback) */}
      {step === "start" && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="max-w-md">
            <h2 className="font-serif text-3xl font-medium text-ink">
              Let&apos;s build your resume
            </h2>
            <p className="mt-3 text-muted">
              We&apos;ll ask a few quick questions to fill in the gaps, then you
              pick a template. Nothing is ever invented. Every fact comes from
              you.
            </p>
            <button
              onClick={startWizard}
              disabled={!!busy}
              className="mt-8 rounded-xl bg-brand px-8 py-3.5 text-sm font-semibold text-brand-on shadow-sm transition hover:bg-brand-strong disabled:opacity-60"
            >
              {busy ? "Analyzing…" : "Start"}
            </button>
          </div>
        </div>
      )}

      {/* Builder */}
      {step === "builder" && (
        <BuilderStep
          parsedResume={parsedResume}
          onContinue={handleBuilderContinue}
        />
      )}

      {/* Loading / Composing */}
      {(step === "loading" || step === "composing") && (
        <LabLoader message={loadingMsg} />
      )}

      {/* Wizard */}
      {step === "wizard" && (
        <TypeformWizard
          questions={questions}
          resumeId={resumeId}
          onComplete={handleWizardComplete}
        />
      )}

      {/* Template selection */}
      {step === "template" && (
        <TemplateSelector
          structures={structures}
          selected={structureId}
          recommended={recommendStructure(parsedResume)}
          onSelect={setStructureId}
          onContinue={handleTemplateSelect}
        />
      )}

      {/* Version result */}
      {step === "version" && (
        <div className="space-y-6 pb-16">
          {/* Ready banner — shown only once after first compose */}
          {showReadyBanner && (
            <div className="flex items-start justify-between gap-4 rounded-xl border border-brand/30 bg-brand-tint px-5 py-4">
              <div>
                <p className="font-semibold text-brand-strong">Resume built!</p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  Review the preview below. Fix any parsing errors with "Edit &amp; fix", then hit{" "}
                  <strong>Finalize</strong> to unlock your ATS score.
                </p>
              </div>
              <button onClick={() => setShowReadyBanner(false)} className="shrink-0 text-muted hover:text-ink">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          )}

          {/* Action bar */}
          <div className="rounded-xl border border-line bg-sunken/60 p-3 space-y-2">
            {/* Row 1: status + primary CTAs */}
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded-full px-3 py-1 font-mono text-xs font-semibold ${
                  status === "final"
                    ? "bg-brand-tint text-brand-strong"
                    : "bg-caution-tint text-caution"
                }`}
              >
                {status.toUpperCase()}
              </span>
              <div className="flex-1" />
              <button
                onClick={startEditing}
                disabled={!!busy || editing}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-sunken disabled:opacity-40"
              >
                Edit &amp; fix
              </button>
              <button
                onClick={getScore}
                disabled={status !== "final" || !!busy}
                title={status !== "final" ? "Finalize to score" : ""}
                className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-brand-on shadow-sm transition hover:bg-brand-strong disabled:opacity-40"
              >
                {busy === "score" ? "Scoring…" : "Get ATS Score"}
              </button>
            </div>
            {/* Row 2: downloads + template switcher */}
            <div className="flex flex-wrap items-center gap-2 border-t border-line/50 pt-2">
              <button
                onClick={() => download("pdf")}
                disabled={!!busy}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft shadow-sm transition hover:bg-sunken disabled:opacity-40"
              >
                {busy === "pdf" ? "…" : "PDF"}
              </button>
              <button
                onClick={() => download("docx")}
                disabled={!!busy}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft shadow-sm transition hover:bg-sunken disabled:opacity-40"
              >
                {busy === "docx" ? "…" : "DOCX"}
              </button>
              <select
                value={structureId}
                onChange={async (e) => {
                  const prevId = structureId;
                  const newId = e.target.value;
                  setStructureId(newId);
                  const ok = await run("template-switch", async () => {
                    await api(`/versions/${versionId}/structure`, {
                      method: "PATCH",
                      body: JSON.stringify({ structure_id: newId }),
                    });
                  });
                  if (ok) {
                    recompose();
                  } else {
                    setStructureId(prevId);
                  }
                }}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-soft"
              >
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DRAFT explainer + finalize CTA */}
          {status === "draft" && !editing && (
            <div className="mx-auto flex max-w-[820px] flex-wrap items-center justify-between gap-3 rounded-xl border border-caution/20 bg-caution-tint px-5 py-4">
              <p className="text-sm text-caution">
                This is a <b>DRAFT</b>. Review it, fix anything the parser got
                wrong, then finalize to download a clean copy and unlock scoring.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={startEditing}
                  disabled={!!busy}
                  className="rounded-lg border border-caution/40 bg-surface px-4 py-2 text-sm font-semibold text-caution transition hover:bg-caution-tint disabled:opacity-40"
                >
                  Edit content
                </button>
                <button
                  onClick={() => saveEdit(true, stripWatermark(markdown))}
                  disabled={!!busy}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on transition hover:bg-brand-strong disabled:opacity-40"
                >
                  {busy === "finalize" ? "Finalizing…" : "Looks good. Finalize"}
                </button>
              </div>
            </div>
          )}

          {/* Secondary actions */}
          {!editing && (
            <div className="flex flex-wrap items-center justify-center gap-4">
              {parsedResume && (
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className="text-xs font-medium text-muted underline transition hover:text-ink"
                >
                  {showOriginal
                    ? "Hide original resume"
                    : "Show original uploaded resume"}
                </button>
              )}
              <button
                onClick={reparseAndRebuild}
                disabled={!!busy}
                className="text-xs font-medium text-muted underline transition hover:text-ink disabled:opacity-40"
                title="Re-read your uploaded file with the latest parsing engine"
              >
                {busy === "reparse"
                  ? "Re-parsing…"
                  : "Parsing looks off? Re-parse the original file"}
              </button>
            </div>
          )}

          {/* JD teaser — visible as soon as version exists, nudges toward finalize */}
          {status !== "final" && !editing && (
            <div className="mx-auto flex max-w-[820px] items-center gap-3 rounded-xl border border-brand/20 bg-brand-tint/50 px-5 py-3">
              <svg className="h-4 w-4 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p className="text-sm text-brand-strong">
                Got a job description? <strong>Finalize</strong> your resume to tailor it with one click.
              </p>
            </div>
          )}

          {showOriginal && !editing && (
            <OriginalResumeView parsed={parsedResume} />
          )}

          {/* Editor OR preview */}
          {editing ? (
            <div className="mx-auto max-w-[820px]">
              <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">
                    Edit your resume
                  </h3>
                  <button
                    onClick={() => setEditing(false)}
                    className="text-xs text-muted transition hover:text-ink-soft"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mb-3 text-xs text-muted">
                  Fix anything the parser got wrong. Format:{" "}
                  <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[11px]"># Name</code>{" "}
                  for your name,{" "}
                  <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[11px]">## Section</code>{" "}
                  for headings,{" "}
                  <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[11px]">**Job Title, Company | Dates**</code>{" "}
                  for entries,{" "}
                  <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[11px]">- bullet</code>{" "}
                  for bullet points.
                </p>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  spellCheck
                  className="h-[520px] w-full resize-y rounded-lg border border-line bg-sunken p-4 font-mono text-[13px] leading-relaxed text-ink outline-none transition focus:border-line-strong focus:bg-surface"
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => saveEdit(false)}
                    disabled={!!busy}
                    className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-sunken disabled:opacity-40"
                  >
                    {busy === "save" ? "Saving…" : "Save as draft"}
                  </button>
                  <button
                    onClick={() => saveEdit(true)}
                    disabled={!!busy}
                    className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-on transition hover:bg-brand-strong disabled:opacity-40"
                  >
                    {busy === "finalize" ? "Finalizing…" : "Save & Finalize"}
                  </button>
                  <span className="text-xs text-muted">
                    Finalize removes the DRAFT mark and unlocks a clean download +
                    ATS score.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            versionId && (
              <ResumePreview versionId={versionId} refreshKey={previewKey} />
            )
          )}

          {/* ATS Score */}
          {score && (
            <div className="mx-auto max-w-[680px] rounded-xl border border-line bg-surface p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${
                    score.value >= 80
                      ? "border-brand"
                      : score.value >= 60
                      ? "border-caution"
                      : "border-critical"
                  }`}
                >
                  <span className="text-2xl font-bold tabular-nums text-ink">
                    {score.value}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-semibold text-ink">ATS Score</p>
                  <p className="text-sm text-muted">
                    {score.value >= 80
                      ? "Strong. Ready to send."
                      : score.value >= 60
                      ? "Good. A few improvements would help."
                      : "Needs work. See the breakdown below."}
                  </p>
                </div>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {score.checks.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-4 rounded-lg bg-sunken px-3 py-2"
                  >
                    <span className="min-w-0 text-ink-soft">
                      {c.label}{" "}
                      <span className="text-muted">{c.detail ? `: ${c.detail}` : ""}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-ink">
                      {c.points}/{c.max_points}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-muted">
                Want a second opinion? Try{" "}
                <a
                  href="https://resumeworded.com"
                  target="_blank"
                  rel="noopener"
                  className="font-medium text-ink underline"
                >
                  Resume Worded
                </a>{" "}
                and paste its findings below.
              </p>
            </div>
          )}

          {/* Score Repair + JD Enhance + Outcomes */}
          {status === "final" && (
            <div className="mx-auto max-w-[680px] space-y-4">
              {/* JD Enhancer — shown first so it's the obvious next step */}
              <div className="rounded-xl border border-brand/30 bg-brand-tint p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-brand-strong">
                      Tailor to a Job Description
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      Paste a job description and we'll mirror keywords, reorder skills, and sharpen your summary — without adding facts.
                    </p>
                  </div>
                </div>
                <textarea
                  className="mt-4 w-full rounded-lg border border-brand/20 bg-surface p-3 text-sm text-ink outline-none transition focus:border-brand focus:bg-surface"
                  rows={4}
                  placeholder="Paste the full job description..."
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                />
                <button
                  onClick={runEnhance}
                  disabled={jdText.trim().length < 30 || !!busy}
                  className="mt-2 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-brand-on transition hover:bg-brand-strong disabled:opacity-40"
                >
                  {busy === "enhance" ? "Tailoring…" : "Create Tailored Variant →"}
                </button>
                {enhanceResult && (
                  <div className="mt-3 rounded-lg border border-brand/20 bg-surface p-4 text-sm">
                    <p className="font-semibold text-brand-strong">Tailored variant created.</p>
                    <ul className="mt-2 list-disc pl-5 text-ink-soft">
                      {enhanceResult.actions?.map((a: string) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-muted">
                      Coverage: {enhanceResult.coverage.present.length} keywords matched,{" "}
                      {enhanceResult.coverage.missing.length} missing
                      {enhanceResult.coverage.missing.length > 0 &&
                        ` (${enhanceResult.coverage.missing.slice(0, 6).join(", ")})`}
                    </p>
                  </div>
                )}
              </div>

              {/* Score Repair */}
              <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
                <h2 className="text-base font-semibold text-ink">Score Repair</h2>
                <p className="mt-1 text-sm text-muted">
                  Drop a Resume Worded screenshot or paste findings below. Fixes
                  are targeted. Never a blind rewrite.
                </p>

                {/* Screenshot drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setRepairDragOver(true); }}
                  onDragLeave={() => setRepairDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setRepairDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f && f.type.startsWith("image/")) setRepairFile(f);
                  }}
                  className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-7 transition ${
                    repairDragOver
                      ? "border-brand bg-brand-tint"
                      : repairFile
                      ? "border-brand/40 bg-brand-tint/40"
                      : "border-line hover:border-line-strong"
                  }`}
                  onClick={() => document.getElementById("repair-file-input")?.click()}
                >
                  <input
                    id="repair-file-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setRepairFile(f);
                    }}
                  />
                  <svg className="h-8 w-8 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path strokeLinecap="round" d="M21 15l-5-5L5 21"/>
                  </svg>
                  {repairFile ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-brand-strong">{repairFile.name}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setRepairFile(null); }}
                        className="mt-0.5 text-xs text-muted underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-medium text-ink">Drop Resume Worded screenshot here</p>
                      <p className="text-xs text-muted">or click to browse · PNG, JPG accepted</p>
                    </div>
                  )}
                </div>

                {repairFile && (
                  <button
                    onClick={runRepairScreenshot}
                    disabled={!!busy}
                    className="mt-3 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-on transition hover:bg-brand-strong disabled:opacity-40"
                  >
                    {busy === "repair" ? "Extracting & repairing…" : "Repair from screenshot →"}
                  </button>
                )}

                <div className="mt-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-line" />
                  <span className="text-xs text-muted">or paste text findings</span>
                  <div className="h-px flex-1 bg-line" />
                </div>

                <textarea
                  className="mt-3 w-full rounded-lg border border-line bg-sunken p-3 text-sm text-ink outline-none transition focus:border-line-strong focus:bg-surface"
                  rows={3}
                  placeholder={"e.g.\nQuantify impact: 6\nBuzzwords: 8"}
                  value={repairText}
                  onChange={(e) => setRepairText(e.target.value)}
                />
                <button
                  onClick={runRepair}
                  disabled={!repairText.trim() || !!busy}
                  className="mt-2 rounded-lg border border-line px-5 py-2 text-sm font-medium text-ink transition hover:bg-sunken disabled:opacity-40"
                >
                  {busy === "repair" ? "Repairing…" : "Apply Targeted Fixes"}
                </button>

                {repairResult && (
                  <div className="mt-4 rounded-xl border border-brand/20 bg-brand-tint p-4 text-sm">
                    <p className="font-semibold text-brand-strong">
                      Score: {repairResult.before_score} → {repairResult.after_score}
                    </p>
                    <ul className="mt-2 space-y-1 text-brand">
                      {repairResult.actions?.map((a: string) => (
                        <li key={a} className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0">✓</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                    {repairResult.new_questions?.length > 0 && (
                      <p className="mt-3 text-xs text-muted">
                        {repairResult.new_questions.length} question(s) need your input to complete the repair.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Outcomes */}
              <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
                <h2 className="text-base font-semibold text-ink">
                  Track Where This Went
                </h2>
                <div className="mt-3 flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-line bg-sunken p-2.5 text-sm text-ink outline-none transition focus:border-line-strong focus:bg-surface"
                    placeholder="Company / job board"
                    value={outcomeSentTo}
                    onChange={(e) => setOutcomeSentTo(e.target.value)}
                  />
                  <button
                    onClick={logOutcome}
                    disabled={!outcomeSentTo.trim() || !!busy}
                    className="rounded-lg border border-line px-5 py-2 text-sm font-medium text-ink transition hover:bg-sunken disabled:opacity-40"
                  >
                    Log it
                  </button>
                </div>
                {outcomeLogged && (
                  <p className="mt-2 text-sm text-brand">
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

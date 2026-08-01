"use client";

import { useState, useRef, useEffect, useMemo } from "react";

// ─── types ────────────────────────────────────────────────────────────────────

type RawExp = { header?: string[]; bullets?: string[] };
type RawEdu = { header?: string[]; gpa?: string | null };
type RawProject = { name?: string; description?: string; bullets?: string[] };

type ParsedResume = {
  contact?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedin?: string | null;
    github?: string | null;
  };
  sections?: {
    summary?: string | null;
    experience?: RawExp[];
    education?: RawEdu[];
    skills?: string[];
    projects?: RawProject[];
  };
};

type Question = {
  id: string;
  kind: "mc" | "number" | "text";
  question: string;
  options?: string[];
};

// ─── heuristics ───────────────────────────────────────────────────────────────

const WEAK_VERBS =
  /^(worked on|was|helped|assisted|involved in|participated in|contributed to|responsible for|supported|part of)/i;

const STRONG_VERB_OPTS = ["Led", "Built", "Reduced", "Launched", "Designed", "Scaled"];

function detectQuestion(bullet: string, expIdx: number, bulletIdx: number): Question | null {
  const id = `q_${expIdx}_${bulletIdx}`;
  if (WEAK_VERBS.test(bullet.trim())) {
    return {
      id,
      kind: "mc",
      question: "Replace the opening with a stronger verb:",
      options: STRONG_VERB_OPTS,
    };
  }
  if (!/\d/.test(bullet)) {
    return {
      id,
      kind: "text",
      question: "Add a number (team size, %, users affected, time saved, revenue):",
    };
  }
  return null;
}

// ─── improve popover ──────────────────────────────────────────────────────────

function ImproveBulletPopover({
  bullet,
  question,
  onApply,
  onSkip,
}: {
  bullet: string;
  question: Question;
  onApply: (answer: string) => void;
  onSkip: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onSkip();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onSkip]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onSkip();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const previewText =
    answer && question.kind === "mc"
      ? `${answer} ${bullet.replace(WEAK_VERBS, "").trim()}`
      : null;

  return (
    <div
      ref={ref}
      className="glass-card absolute left-0 right-0 z-50 mt-1 rounded-2xl p-5"
      style={{ top: "100%" }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/15 text-[11px] font-bold text-brand">
            AI
          </span>
          <span className="text-sm font-semibold text-ink">Improve this bullet</span>
        </div>
        <button
          onClick={onSkip}
          aria-label="Close"
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2.22 2.22a.75.75 0 0 1 1.06 0L6 4.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L7.06 6l2.72 2.72a.75.75 0 1 1-1.06 1.06L6 7.06 3.28 9.78a.75.75 0 0 1-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 0 1 0-1.06z" />
          </svg>
        </button>
      </div>

      {/* Current bullet */}
      <div className="mb-4 rounded-xl bg-sunken px-3 py-2.5">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">Current</p>
        <p className="text-sm leading-relaxed text-ink-soft">{bullet}</p>
      </div>

      {/* Question */}
      <p className="mb-3 text-sm font-semibold leading-snug text-ink">{question.question}</p>

      {/* Answer chips or text */}
      {question.kind === "mc" && question.options ? (
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setAnswer(opt)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                answer === opt
                  ? "border-brand bg-brand text-on-brand"
                  : "border-line bg-surface text-ink-soft hover:border-brand/50 hover:bg-brand-tint"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <input
          autoFocus
          type={question.kind === "number" ? "number" : "text"}
          placeholder="Your answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-brand"
          onKeyDown={(e) => {
            if (e.key === "Enter" && answer.trim()) onApply(answer.trim());
          }}
        />
      )}

      {/* Live preview */}
      {previewText && (
        <div className="mt-3 rounded-xl border border-brand/20 bg-brand-tint px-3 py-2.5">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-brand/70">Preview</p>
          <p className="text-sm leading-relaxed text-ink">
            <span className="font-semibold text-brand">{answer}</span>{" "}
            {previewText.slice(answer.length + 1, answer.length + 1 + 90)}
            {previewText.length > answer.length + 91 ? "…" : ""}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-xl border border-line px-4 py-2 text-xs font-medium text-ink-soft transition hover:bg-sunken"
        >
          Skip
        </button>
        <button
          type="button"
          disabled={!answer.trim()}
          onClick={() => answer.trim() && onApply(answer.trim())}
          className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-on-brand transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.485 1.929L5.5 9.914 2.515 6.929A1 1 0 001.1 8.343l3.693 3.693a1 1 0 001.414 0l8.692-8.693a1 1 0 00-1.414-1.414z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── bullet row ───────────────────────────────────────────────────────────────

function BulletRow({
  bullet,
  question,
  answered,
  onAnswer,
}: {
  bullet: string;
  question: Question | null;
  answered: boolean;
  onAnswer: (qId: string, answer: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-start gap-2.5 py-1.5">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
        <p className="flex-1 text-sm leading-relaxed text-ink-soft">{bullet}</p>
        {question && !answered && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded-full border border-brand/30 bg-brand-tint px-2.5 py-0.5 font-mono text-[10px] font-semibold text-brand transition hover:bg-brand/20"
          >
            Improve
          </button>
        )}
        {answered && (
          <span className="shrink-0 rounded-full bg-brand/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-brand">
            ✓ Added
          </span>
        )}
      </div>
      {open && question && (
        <ImproveBulletPopover
          bullet={bullet}
          question={question}
          onApply={(ans) => {
            onAnswer(question.id, ans);
            setOpen(false);
          }}
          onSkip={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ─── section card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</h3>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-caution-tint px-2 py-0.5 font-mono text-[10px] text-caution">
            {badge} to improve
          </span>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function BuilderStep({
  parsedResume,
  onContinue,
}: {
  parsedResume: any | null;
  onContinue: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function addAnswer(qId: string, value: string) {
    setAnswers((a) => ({ ...a, [qId]: value }));
  }

  // Generate heuristic questions for experience bullets (first 2 bullets of first 3 entries)
  const questionMap = useMemo<Record<string, Question>>(() => {
    const map: Record<string, Question> = {};
    const exp: RawExp[] = parsedResume?.sections?.experience ?? [];
    exp.slice(0, 3).forEach((entry, ei) => {
      (entry.bullets ?? []).slice(0, 2).forEach((bullet, bi) => {
        const q = detectQuestion(bullet, ei, bi);
        if (q) map[q.id] = q;
      });
    });
    return map;
  }, [parsedResume]);

  // Loading state while parsedResume is not yet fetched by Flow
  if (!parsedResume) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-line border-t-brand" />
        <p className="text-sm text-muted">Loading your resume…</p>
      </div>
    );
  }

  const sections = parsedResume.sections ?? {};
  const contact = parsedResume.contact ?? {};
  const experience: RawExp[] = sections.experience ?? [];
  const education: RawEdu[] = sections.education ?? [];
  const skills: string[] = sections.skills ?? [];
  const projects: RawProject[] = sections.projects ?? [];

  // Empty resume guard
  const isEmpty =
    experience.length === 0 &&
    !sections.summary &&
    skills.length === 0 &&
    projects.length === 0;

  if (isEmpty) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mx-auto max-w-sm rounded-2xl border border-critical/30 bg-critical-tint p-8">
          <p className="mb-3 text-2xl">⚠️</p>
          <p className="font-semibold text-ink">
            No resume content found in this file.
          </p>
          <p className="mt-2 text-sm text-muted">
            Please upload a resume that includes work experience, education, or skills.
          </p>
          <a
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition hover:bg-brand-strong"
          >
            Upload a different resume
          </a>
        </div>
      </div>
    );
  }

  const totalImprovable = Object.keys(questionMap).length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="flex min-h-[80vh] flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-serif text-2xl font-medium text-ink">Review your resume</h2>
        <p className="mt-1.5 text-sm text-muted">
          {totalImprovable > 0
            ? `${totalImprovable} bullet${totalImprovable > 1 ? "s" : ""} can be strengthened. Answer what you can, or skip straight to rewrite.`
            : "Your resume looks solid. Click below to generate the AI rewrite."}
        </p>
      </div>

      {/* Two-panel layout */}
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* LEFT: sections */}
        <div className="flex flex-col gap-5">

          {/* Contact */}
          {(contact.name || contact.email || contact.phone || contact.linkedin) && (
            <SectionCard title="Contact">
              <div className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                {[
                  { label: "Name", val: contact.name },
                  { label: "Email", val: contact.email },
                  { label: "Phone", val: contact.phone },
                  { label: "LinkedIn", val: contact.linkedin },
                ].map(
                  ({ label, val }) =>
                    val && (
                      <div key={label} className="flex items-baseline gap-2">
                        <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted">
                          {label}
                        </span>
                        <span className="min-w-0 truncate text-sm text-ink-soft">{val}</span>
                      </div>
                    )
                )}
              </div>
            </SectionCard>
          )}

          {/* Summary */}
          {sections.summary && (
            <SectionCard title="Summary">
              <p className="text-sm leading-relaxed text-ink-soft">{sections.summary}</p>
            </SectionCard>
          )}

          {/* Experience */}
          {experience.length > 0 && (
            <SectionCard
              title="Experience"
              badge={Object.values(questionMap).filter((q) => !answers[q.id]).length}
            >
              <div className="flex flex-col gap-6">
                {experience.map((exp, ei) => {
                  const header = exp.header ?? [];
                  return (
                    <div key={ei}>
                      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        {header[1] && (
                          <span className="text-sm font-semibold text-ink">{header[1]}</span>
                        )}
                        {header[0] && (
                          <>
                            <span className="text-xs text-muted">at</span>
                            <span className="text-sm font-medium text-ink-soft">{header[0]}</span>
                          </>
                        )}
                        {header[2] && (
                          <span className="ml-auto font-mono text-[11px] text-muted">{header[2]}</span>
                        )}
                        {header.length === 1 && (
                          <span className="text-sm font-semibold text-ink">{header[0]}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {(exp.bullets ?? []).map((bullet, bi) => {
                          const qId = `q_${ei}_${bi}`;
                          const q = bi < 2 && ei < 3 ? (questionMap[qId] ?? null) : null;
                          return (
                            <BulletRow
                              key={bi}
                              bullet={bullet}
                              question={q}
                              answered={!!(q && answers[q.id])}
                              onAnswer={addAnswer}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Projects */}
          {projects.length > 0 && (
            <SectionCard title="Projects">
              <div className="flex flex-col gap-4">
                {projects.map((p, pi) => (
                  <div key={pi}>
                    <p className="mb-1 text-sm font-semibold text-ink">{p.name}</p>
                    {p.description && (
                      <p className="mb-1.5 text-xs text-muted">{p.description}</p>
                    )}
                    {(p.bullets ?? []).map((b, bi) => (
                      <div key={bi} className="flex items-start gap-2 py-0.5">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-line-strong" />
                        <p className="text-xs leading-relaxed text-ink-soft">{b}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <SectionCard title="Skills">
              <div className="flex flex-wrap gap-2">
                {skills.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-line bg-sunken px-3 py-1 text-xs text-ink-soft"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Education */}
          {education.length > 0 && (
            <SectionCard title="Education">
              <div className="flex flex-col gap-3">
                {education.map((e, i) => {
                  const h = e.header ?? [];
                  return (
                    <div key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {h[0] && <span className="text-sm font-semibold text-ink">{h[0]}</span>}
                      {h[1] && <span className="text-xs text-muted">&middot;</span>}
                      {h[1] && <span className="text-sm text-ink-soft">{h[1]}</span>}
                      {h[2] && (
                        <span className="ml-auto font-mono text-[11px] text-muted">{h[2]}</span>
                      )}
                      {e.gpa && (
                        <span className="w-full font-mono text-[11px] text-muted">GPA {e.gpa}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>

        {/* RIGHT: sticky progress sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-20 flex flex-col gap-4">
            {totalImprovable > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
                  Improvements
                </p>
                <p className="mb-4 font-mono text-2xl font-bold tabular-nums text-ink">
                  {answeredCount}
                  <span className="text-base font-normal text-muted">/{totalImprovable}</span>
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${(answeredCount / totalImprovable) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {answeredCount === totalImprovable
                    ? "All improvements applied."
                    : `${totalImprovable - answeredCount} bullet${
                        totalImprovable - answeredCount > 1 ? "s" : ""
                      } left. Skip to rewrite.`}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-line/50 bg-sunken px-4 py-3.5">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                What happens next
              </p>
              <p className="text-xs leading-relaxed text-ink-soft">
                Choose a layout, then AI rewrites your resume using only the facts already in your file.
                No invented numbers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
        <a
          href="/dashboard"
          className="rounded-xl border border-line px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-sunken"
        >
          ← Dashboard
        </a>
        <button
          type="button"
          onClick={() => onContinue(answers)}
          className="flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-brand-strong"
        >
          Generate AI rewrite
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

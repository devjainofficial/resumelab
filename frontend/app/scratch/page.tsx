"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/app/_components/brand-mark";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── types ─────────────────────────────────────────────────────────────────────

type Contact = { name: string; email: string; phone: string; linkedin: string; github: string };
type ExpEntry = { company: string; title: string; dates: string; bullets: string[] };
type EduEntry = { school: string; degree: string; year: string };

const newExp = (): ExpEntry => ({ company: "", title: "", dates: "", bullets: [""] });
const newEdu = (): EduEntry => ({ school: "", degree: "", year: "" });

// ── helpers ────────────────────────────────────────────────────────────────────

function toParsedJson(
  contact: Contact,
  experience: ExpEntry[],
  education: EduEntry[],
  skillsRaw: string,
) {
  const skills = skillsRaw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const expRows = experience
    .filter((e) => e.company.trim() || e.title.trim())
    .map((e) => ({
      header: [e.company, e.title, e.dates].map((s) => s.trim()).filter(Boolean),
      bullets: e.bullets.map((b) => b.trim()).filter(Boolean),
    }));

  const eduRows = education
    .filter((e) => e.school.trim() || e.degree.trim())
    .map((e) => ({
      header: [e.school, e.degree, e.year].map((s) => s.trim()).filter(Boolean),
      gpa: null,
    }));

  const sections_found = [
    expRows.length > 0 ? "experience" : null,
    eduRows.length > 0 ? "education" : null,
    skills.length > 0 ? "skills" : null,
  ].filter(Boolean) as string[];

  return {
    contact: {
      name: contact.name.trim() || null,
      email: contact.email.trim() || null,
      phone: contact.phone.trim() || null,
      linkedin: contact.linkedin.trim() || null,
      github: contact.github.trim() || null,
    },
    sections: {
      summary: null,
      experience: expRows,
      education: eduRows,
      skills,
      projects: [],
    },
    stats: {
      bullet_count: expRows.reduce((n, e) => n + e.bullets.length, 0),
    },
    flags: { sections_found },
  };
}

// ── step labels ────────────────────────────────────────────────────────────────

const STEPS = ["About you", "Experience", "Education & Skills"];

// ── main page ─────────────────────────────────────────────────────────────────

export default function ScratchPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<Contact>({
    name: "", email: "", phone: "", linkedin: "", github: "",
  });
  const [experience, setExperience] = useState<ExpEntry[]>([newExp()]);
  const [education, setEducation] = useState<EduEntry[]>([newEdu()]);
  const [skillsRaw, setSkillsRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login");
      else setAuthReady(true);
    });
  }, [router]);

  if (!authReady) return null;

  // ── experience helpers ────────────────────────────────────────────────────

  function setExp(idx: number, patch: Partial<ExpEntry>) {
    setExperience((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function setBullet(expIdx: number, bulletIdx: number, val: string) {
    setExperience((prev) =>
      prev.map((e, i) => {
        if (i !== expIdx) return e;
        const bullets = [...e.bullets];
        bullets[bulletIdx] = val;
        return { ...e, bullets };
      }),
    );
  }

  function addBullet(expIdx: number) {
    setExperience((prev) =>
      prev.map((e, i) => (i === expIdx ? { ...e, bullets: [...e.bullets, ""] } : e)),
    );
  }

  function removeBullet(expIdx: number, bulletIdx: number) {
    setExperience((prev) =>
      prev.map((e, i) => {
        if (i !== expIdx) return e;
        const bullets = e.bullets.filter((_, j) => j !== bulletIdx);
        return { ...e, bullets: bullets.length ? bullets : [""] };
      }),
    );
  }

  // ── submit ────────────────────────────────────────────────────────────────

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const parsed_json = toParsedJson(contact, experience, education, skillsRaw);

      const resp = await fetch(`${API}/resumes/scratch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ parsed_json }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail ?? `Error ${resp.status}`);
      }

      const { resume_id } = await resp.json();
      router.push(`/resume/${resume_id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100;
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandMark size={26} />
            <span className="font-semibold tracking-tight text-ink">ResumeLab</span>
          </Link>
          <div className="flex-1" />
          <span className="font-mono text-xs text-muted">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 w-full bg-line">
          <div
            className="h-full bg-brand transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-20 pt-10">
        {/* Step heading */}
        <div className="mb-8">
          <p className="mb-1 font-mono text-xs text-muted">Step {step + 1} of {STEPS.length}</p>
          <h1 className="font-serif text-2xl font-medium text-ink">{STEPS[step]}</h1>
        </div>

        {/* ── Step 0: Contact ── */}
        {step === 0 && (
          <div className="space-y-5">
            <Field label="Full name *" required>
              <input
                autoFocus
                className={INPUT}
                placeholder="Dev Jain"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Email *" required>
                <input
                  className={INPUT}
                  type="email"
                  placeholder="dev@example.com"
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={INPUT}
                  placeholder="+91 98765 43210"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="LinkedIn URL">
                <input
                  className={INPUT}
                  placeholder="linkedin.com/in/username"
                  value={contact.linkedin}
                  onChange={(e) => setContact({ ...contact, linkedin: e.target.value })}
                />
              </Field>
              <Field label="GitHub URL">
                <input
                  className={INPUT}
                  placeholder="github.com/username"
                  value={contact.github}
                  onChange={(e) => setContact({ ...contact, github: e.target.value })}
                />
              </Field>
            </div>
          </div>
        )}

        {/* ── Step 1: Experience ── */}
        {step === 1 && (
          <div className="space-y-6">
            <p className="text-sm text-muted">
              Add each job. At least one bullet per role helps the AI write stronger content.
            </p>
            {experience.map((exp, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">Role {i + 1}</p>
                  {experience.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setExperience((prev) => prev.filter((_, j) => j !== i))}
                      className="text-xs text-muted transition hover:text-critical"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company">
                    <input
                      className={INPUT}
                      placeholder="Google"
                      value={exp.company}
                      onChange={(e) => setExp(i, { company: e.target.value })}
                    />
                  </Field>
                  <Field label="Title">
                    <input
                      className={INPUT}
                      placeholder="Software Engineer"
                      value={exp.title}
                      onChange={(e) => setExp(i, { title: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Dates" className="mt-4">
                  <input
                    className={INPUT}
                    placeholder="Jun 2021 – Present"
                    value={exp.dates}
                    onChange={(e) => setExp(i, { dates: e.target.value })}
                  />
                </Field>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-ink-soft">
                    What did you do? (One bullet per line. Lead with a strong verb.)
                  </p>
                  <div className="space-y-2">
                    {exp.bullets.map((b, bi) => (
                      <div key={bi} className="flex items-center gap-2">
                        <span className="shrink-0 text-xs text-muted">–</span>
                        <input
                          className={INPUT + " flex-1"}
                          placeholder={
                            bi === 0
                              ? "Built a real-time dashboard used by 5,000 engineers"
                              : "Led migration to microservices, cutting deploy time by 40%"
                          }
                          value={b}
                          onChange={(e) => setBullet(i, bi, e.target.value)}
                        />
                        {exp.bullets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBullet(i, bi)}
                            className="shrink-0 text-muted transition hover:text-critical"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {exp.bullets.length < 5 && (
                    <button
                      type="button"
                      onClick={() => addBullet(i)}
                      className="mt-2 text-xs font-medium text-brand transition hover:text-brand-strong"
                    >
                      + Add bullet
                    </button>
                  )}
                </div>
              </div>
            ))}
            {experience.length < 4 && (
              <button
                type="button"
                onClick={() => setExperience((prev) => [...prev, newExp()])}
                className="w-full rounded-xl border-2 border-dashed border-line py-3 text-sm font-medium text-muted transition hover:border-brand/50 hover:text-brand"
              >
                + Add another role
              </button>
            )}
          </div>
        )}

        {/* ── Step 2: Education + Skills ── */}
        {step === 2 && (
          <div className="space-y-8">
            <div>
              <h2 className="mb-4 text-sm font-semibold text-ink">Education</h2>
              <div className="space-y-4">
                {education.map((edu, i) => (
                  <div key={i} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium text-ink">Entry {i + 1}</p>
                      {education.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEducation((prev) => prev.filter((_, j) => j !== i))}
                          className="text-xs text-muted transition hover:text-critical"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="School / University">
                        <input
                          className={INPUT}
                          placeholder="IIT Bombay"
                          value={edu.school}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((r, j) => j === i ? { ...r, school: e.target.value } : r)
                            )
                          }
                        />
                      </Field>
                      <Field label="Degree">
                        <input
                          className={INPUT}
                          placeholder="B.Tech Computer Science"
                          value={edu.degree}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((r, j) => j === i ? { ...r, degree: e.target.value } : r)
                            )
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Graduation year" className="mt-4">
                      <input
                        className={INPUT}
                        placeholder="2023"
                        value={edu.year}
                        onChange={(e) =>
                          setEducation((prev) =>
                            prev.map((r, j) => j === i ? { ...r, year: e.target.value } : r)
                          )
                        }
                      />
                    </Field>
                  </div>
                ))}
                {education.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setEducation((prev) => [...prev, newEdu()])}
                    className="w-full rounded-xl border-2 border-dashed border-line py-3 text-sm font-medium text-muted transition hover:border-brand/50 hover:text-brand"
                  >
                    + Add education
                  </button>
                )}
              </div>
            </div>

            <div>
              <h2 className="mb-1 text-sm font-semibold text-ink">Skills</h2>
              <p className="mb-3 text-xs text-muted">
                Comma-separated. Include languages, frameworks, tools.
              </p>
              <textarea
                className="w-full rounded-lg border border-line bg-surface p-3 text-sm text-ink outline-none transition focus:border-line-strong focus:bg-paper"
                rows={3}
                placeholder="Python, React, TypeScript, PostgreSQL, Docker, AWS"
                value={skillsRaw}
                onChange={(e) => setSkillsRaw(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-lg border border-critical/30 bg-critical-tint px-4 py-3 text-sm text-critical">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-xl border border-line px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-sunken"
            >
              Back
            </button>
          )}
          <div className="flex-1" />
          {isLast ? (
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded-xl bg-brand px-8 py-2.5 text-sm font-semibold text-brand-on shadow-sm transition hover:bg-brand-strong disabled:opacity-60"
            >
              {busy ? "Creating your resume…" : "Create my resume →"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (step === 0 && !contact.name.trim()) return;
                setStep((s) => s + 1);
              }}
              disabled={step === 0 && !contact.name.trim()}
              className="rounded-xl bg-brand px-8 py-2.5 text-sm font-semibold text-brand-on shadow-sm transition hover:bg-brand-strong disabled:opacity-50"
            >
              Next →
            </button>
          )}
        </div>

        {step === 0 && (
          <p className="mt-3 text-center text-xs text-muted">
            Already have a resume?{" "}
            <Link href="/dashboard" className="font-medium text-ink underline">
              Upload it instead
            </Link>
          </p>
        )}
      </main>
    </>
  );
}

// ── small helpers ─────────────────────────────────────────────────────────────

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-line-strong focus:bg-paper placeholder:text-muted";

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-ink-soft">
        {label}
        {required && <span className="ml-0.5 text-critical">*</span>}
      </label>
      {children}
    </div>
  );
}

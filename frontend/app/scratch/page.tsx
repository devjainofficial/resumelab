"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/app/_components/brand-mark";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Profession config ──────────────────────────────────────────────────────────

type ProfessionId =
  | "technology"
  | "business"
  | "healthcare"
  | "education"
  | "legal"
  | "marketing"
  | "design"
  | "engineering"
  | "operations"
  | "hr"
  | "other";

const PROFESSIONS: { id: ProfessionId; label: string; icon: string }[] = [
  { id: "technology", label: "Technology", icon: "💻" },
  { id: "business", label: "Business & Finance", icon: "📊" },
  { id: "healthcare", label: "Healthcare", icon: "🏥" },
  { id: "education", label: "Education", icon: "🎓" },
  { id: "legal", label: "Legal", icon: "⚖️" },
  { id: "marketing", label: "Marketing & Sales", icon: "📢" },
  { id: "design", label: "Design & Creative", icon: "🎨" },
  { id: "engineering", label: "Engineering", icon: "⚙️" },
  { id: "operations", label: "Operations", icon: "🔧" },
  { id: "hr", label: "Human Resources", icon: "👥" },
  { id: "other", label: "Other", icon: "✦" },
];

const SKILL_CHIPS: Record<ProfessionId, string[]> = {
  technology: ["Python", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "AWS", "Docker", "Git", "REST APIs", "PostgreSQL", "Redis", "Kubernetes", "Go", "Java"],
  business: ["Excel", "PowerPoint", "Financial Modeling", "SQL", "Forecasting", "CRM", "Negotiation", "P&L Management", "Bloomberg", "Tableau", "GAAP", "SAP"],
  healthcare: ["Patient Care", "EMR/EHR", "CPR Certified", "Medical Coding", "HIPAA", "Clinical Documentation", "IV Administration", "Phlebotomy", "ACLS", "Infection Control"],
  education: ["Curriculum Design", "Classroom Management", "Google Classroom", "Assessment & Grading", "Differentiated Instruction", "Canvas LMS", "Special Education", "STEM"],
  legal: ["Legal Research", "Contract Drafting", "Westlaw", "Due Diligence", "Compliance", "Litigation Support", "LexisNexis", "Corporate Law", "Employment Law", "Data Privacy"],
  marketing: ["SEO/SEM", "Google Analytics", "Meta Ads", "Copywriting", "Email Marketing", "HubSpot", "Content Strategy", "A/B Testing", "Canva", "Salesforce", "Social Media"],
  design: ["Figma", "Adobe Creative Suite", "UI/UX Design", "Prototyping", "User Research", "Sketch", "Photoshop", "Illustrator", "InVision", "Design Systems"],
  engineering: ["AutoCAD", "SolidWorks", "Project Management", "MATLAB", "Safety Standards", "OSHA", "Lean Manufacturing", "Six Sigma", "ANSYS", "PLC Programming"],
  operations: ["Supply Chain", "Lean", "Six Sigma", "ERP Systems", "Logistics", "Process Improvement", "Vendor Management", "SAP", "Forecasting", "Inventory Management"],
  hr: ["Recruiting", "HRIS", "Onboarding", "Performance Management", "Labor Law", "Applicant Tracking", "Employee Relations", "Compensation & Benefits", "SHRM", "Workday"],
  other: ["Project Management", "Microsoft Office", "Communication", "Leadership", "Problem Solving", "Data Analysis", "Research", "Stakeholder Management"],
};

const WORK_PLACEHOLDERS: Record<ProfessionId, string> = {
  technology: "Built a REST API serving 50K daily requests\nLed migration from monolith to microservices\nMentored 3 junior engineers",
  business: "Managed relationships with 12 enterprise clients\nPrepared monthly financial reports for senior leadership\nCoordinated cross-functional planning sessions",
  healthcare: "Provided care for 15–20 patients daily in a 30-bed unit\nAdministered medications and documented vitals in EMR\nCoordinated discharge planning with social workers",
  education: "Taught 120 students across 4 sections of Algebra II\nDesigned curriculum aligned with state standards\nRan after-school tutoring program with 95% attendance",
  legal: "Drafted and reviewed commercial contracts for M&A transactions\nConducted legal research using Westlaw and LexisNexis\nPrepared briefs and motions for litigation support",
  marketing: "Managed Google Ads and Meta campaigns with $50K monthly spend\nCreated content calendar and social posts for 5 brands\nTracked performance metrics and compiled weekly reports",
  design: "Led end-to-end redesign of the mobile checkout experience\nConducted user interviews and usability testing with 20+ participants\nOwned design system across 3 product teams",
  engineering: "Designed HVAC systems for 3 commercial buildings totalling 200K sq ft\nManaged contractor teams of 8–12 on installation projects\nEnsured compliance with ASHRAE and local building codes",
  operations: "Coordinated logistics for 500+ weekly shipments across 3 warehouses\nManaged vendor relationships with 20+ suppliers\nTracked inventory and reduced shrinkage via cycle counts",
  hr: "Managed full-cycle recruiting for 30 roles annually across 5 departments\nOnboarded 50+ new hires including orientation and benefits enrollment\nHandled employee relations cases and performance reviews",
  other: "Describe your main responsibilities in plain language\nWhat were your main activities and deliverables?",
};

const ACHIEVEMENT_PLACEHOLDERS: Record<ProfessionId, string> = {
  technology: "Reduced page load time from 4s to 800ms\nCut infrastructure costs by 30%",
  business: "Grew managed portfolio from $2M to $3.5M in 18 months\nReduced reporting cycle time by 40%",
  healthcare: "Maintained 98% patient satisfaction score across 2 years\nZero medication errors over entire tenure",
  education: "Improved average class pass rate from 68% to 82%\nSelected as department head in 2023",
  legal: "Supported $50M acquisition deal from due diligence to close\nReduced contract turnaround time by 25%",
  marketing: "Grew email list from 5K to 20K subscribers in 6 months\nIncreased conversion rate by 18% through A/B testing",
  design: "Checkout redesign increased conversion by 18%\nDelivered projects 20% faster by standardizing design components",
  engineering: "Completed $5M project 3 weeks ahead of schedule\nAchieved 15% energy efficiency improvement across retrofit projects",
  operations: "Reduced average fulfillment time from 3 days to 1.5 days\nNegotiated vendor contracts saving $120K annually",
  hr: "Reduced time-to-hire from 45 to 28 days\nImproved 90-day retention from 80% to 92%",
  other: "Any numbers or results you're proud of?\nMetrics, % improvements, team sizes, budgets, timelines",
};

const PORTFOLIO_LABEL: Record<ProfessionId, string> = {
  technology: "GitHub or Portfolio URL",
  business: "Website or Portfolio URL",
  healthcare: "Professional Profile URL",
  education: "Portfolio or Website URL",
  legal: "LinkedIn or Firm Profile URL",
  marketing: "Portfolio or Website URL",
  design: "Portfolio URL (Behance, Dribbble, website)",
  engineering: "Portfolio or LinkedIn URL",
  operations: "LinkedIn or Website URL",
  hr: "LinkedIn URL",
  other: "Website or Portfolio URL",
};

// ── Types ──────────────────────────────────────────────────────────────────────

type Contact = {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  target_role: string;
  career_level: string;
};

type ExpEntry = {
  company: string;
  title: string;
  dates: string;
  responsibilities: string;
  achievements: string;
};

type EduEntry = { school: string; degree: string; year: string };

const newExp = (): ExpEntry => ({
  company: "",
  title: "",
  dates: "",
  responsibilities: "",
  achievements: "",
});
const newEdu = (): EduEntry => ({ school: "", degree: "", year: "" });

// ── toParsedJson ───────────────────────────────────────────────────────────────

function toParsedJson(
  profession: ProfessionId,
  contact: Contact,
  experience: ExpEntry[],
  education: EduEntry[],
  selectedSkills: string[],
  certsRaw: string,
) {
  const expRows = experience
    .filter((e) => e.company.trim() || e.title.trim())
    .map((e) => {
      const resp = e.responsibilities
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const ach = e.achievements
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        header: [e.company, e.title, e.dates].map((s) => s.trim()).filter(Boolean),
        bullets: [...resp, ...ach],
      };
    });

  const eduRows = education
    .filter((e) => e.school.trim() || e.degree.trim())
    .map((e) => ({
      header: [e.school, e.degree, e.year].map((s) => s.trim()).filter(Boolean),
      gpa: null,
    }));

  const certs = certsRaw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const sections_found = [
    expRows.length > 0 ? "experience" : null,
    eduRows.length > 0 ? "education" : null,
    selectedSkills.length > 0 ? "skills" : null,
    certs.length > 0 ? "certifications" : null,
  ].filter(Boolean) as string[];

  return {
    contact: {
      name: contact.name.trim() || null,
      email: contact.email.trim() || null,
      phone: contact.phone.trim() || null,
      linkedin: contact.linkedin.trim() || null,
      github: profession === "technology" ? contact.portfolio.trim() || null : null,
      portfolio: profession !== "technology" ? contact.portfolio.trim() || null : null,
    },
    sections: {
      summary: null,
      experience: expRows,
      education: eduRows,
      skills: selectedSkills,
      projects: [],
      certifications: certs,
    },
    stats: {
      bullet_count: expRows.reduce((n, e) => n + e.bullets.length, 0),
    },
    flags: { sections_found },
    meta: {
      profession,
      career_level: contact.career_level || null,
      target_role: contact.target_role.trim() || null,
    },
  };
}

// ── Step labels ────────────────────────────────────────────────────────────────

const STEPS = ["About you", "Experience", "Education & Skills"];

// ── Constants ──────────────────────────────────────────────────────────────────

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-muted";

const CAREER_LEVELS = [
  { value: "", label: "Select career level" },
  { value: "entry", label: "Entry level (0–2 years)" },
  { value: "mid", label: "Mid level (3–6 years)" },
  { value: "senior", label: "Senior (7–12 years)" },
  { value: "executive", label: "Executive / Leadership" },
];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ScratchPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [profession, setProfession] = useState<ProfessionId | null>(null);
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<Contact>({
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    portfolio: "",
    target_role: "",
    career_level: "",
  });
  const [experience, setExperience] = useState<ExpEntry[]>([newExp()]);
  const [education, setEducation] = useState<EduEntry[]>([newEdu()]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState("");
  const [certsRaw, setCertsRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login");
      else setAuthReady(true);
    });
  }, [router]);

  if (!authReady) return null;

  // ── Skill helpers ─────────────────────────────────────────────────────────

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  function addCustomSkill(raw: string) {
    const skills = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setSelectedSkills((prev) => {
      const next = [...prev];
      for (const s of skills) {
        if (!next.includes(s)) next.push(s);
      }
      return next;
    });
    setCustomSkillInput("");
  }

  // ── Experience helpers ────────────────────────────────────────────────────

  function setExp(idx: number, patch: Partial<ExpEntry>) {
    setExperience((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function submit() {
    if (!profession) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const parsed_json = toParsedJson(
        profession,
        contact,
        experience,
        education,
        selectedSkills,
        certsRaw,
      );

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
  const chips = profession ? SKILL_CHIPS[profession] : [];

  // ── Profession picker (pre-wizard) ────────────────────────────────────────

  if (!profession) {
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <BrandMark size={26} />
              <span className="font-semibold tracking-tight text-ink">ResumeLab</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16 pt-10">
          <div className="mb-8">
            <h1 className="font-serif text-2xl font-medium text-ink">
              What&apos;s your field?
            </h1>
            <p className="mt-2 text-sm text-muted">
              We&apos;ll tailor the questions, skill suggestions, and structure to what
              actually matters in your profession.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PROFESSIONS.map((p) => (
              <button
                key={p.id}
                onClick={() => setProfession(p.id)}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-4 text-left transition hover:border-brand/40 hover:bg-brand-tint/30"
              >
                <span className="text-2xl leading-none">{p.icon}</span>
                <span className="text-sm font-medium text-ink">{p.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted">
            Already have a resume?{" "}
            <Link href="/dashboard" className="font-medium text-ink underline">
              Upload it instead
            </Link>
          </p>
        </main>
      </div>
    );
  }

  // ── Step wizard ───────────────────────────────────────────────────────────

  const selectedProfLabel = PROFESSIONS.find((p) => p.id === profession)?.label ?? "";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandMark size={26} />
            <span className="font-semibold tracking-tight text-ink">ResumeLab</span>
          </Link>
          <div className="flex-1" />
          <button
            onClick={() => setProfession(null)}
            className="flex items-center gap-1.5 rounded-full border border-line bg-sunken px-3 py-1 text-xs text-muted transition hover:border-brand/40 hover:text-brand"
          >
            {PROFESSIONS.find((p) => p.id === profession)?.icon}{" "}
            {selectedProfLabel}
            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.354 5.354a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646a.5.5 0 0 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8z" />
            </svg>
          </button>
          <span className="font-mono text-xs text-muted">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        <div className="h-0.5 w-full bg-line">
          <div
            className="h-full bg-brand transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-20 pt-10">
        <div className="mb-8">
          <p className="mb-1 font-mono text-xs text-muted">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="font-serif text-2xl font-medium text-ink">{STEPS[step]}</h1>
        </div>

        {/* ── Step 0: About you ── */}
        {step === 0 && (
          <div className="space-y-5">
            <Field label="Full name *" required>
              <input
                autoFocus
                className={INPUT}
                placeholder="Your full name"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Email *" required>
                <input
                  className={INPUT}
                  type="email"
                  placeholder="you@example.com"
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
              <Field label={PORTFOLIO_LABEL[profession]}>
                <input
                  className={INPUT}
                  placeholder={
                    profession === "technology"
                      ? "github.com/username"
                      : "yourportfolio.com"
                  }
                  value={contact.portfolio}
                  onChange={(e) => setContact({ ...contact, portfolio: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Target role">
                <input
                  className={INPUT}
                  placeholder={
                    profession === "technology"
                      ? "Senior Software Engineer"
                      : profession === "business"
                        ? "Finance Manager"
                        : profession === "healthcare"
                          ? "Registered Nurse"
                          : "Your target job title"
                  }
                  value={contact.target_role}
                  onChange={(e) => setContact({ ...contact, target_role: e.target.value })}
                />
              </Field>
              <Field label="Career level">
                <select
                  className={INPUT}
                  value={contact.career_level}
                  onChange={(e) => setContact({ ...contact, career_level: e.target.value })}
                >
                  {CAREER_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}

        {/* ── Step 1: Experience ── */}
        {step === 1 && (
          <div className="space-y-5">
            <p className="text-sm text-muted">
              Describe what you did in plain language — no bullet formatting needed. The AI will
              structure it.
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
                  <Field label="Organisation / Company">
                    <input
                      className={INPUT}
                      placeholder={
                        profession === "education"
                          ? "Springfield High School"
                          : profession === "healthcare"
                            ? "Apollo Hospitals"
                            : profession === "legal"
                              ? "Cyril Amarchand Mangaldas"
                              : "Company name"
                      }
                      value={exp.company}
                      onChange={(e) => setExp(i, { company: e.target.value })}
                    />
                  </Field>
                  <Field label="Your title / role">
                    <input
                      className={INPUT}
                      placeholder={
                        profession === "education"
                          ? "Mathematics Teacher"
                          : profession === "healthcare"
                            ? "Staff Nurse"
                            : profession === "legal"
                              ? "Associate Advocate"
                              : "Your title"
                      }
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
                <Field label="Main responsibilities" className="mt-4">
                  <textarea
                    className={INPUT + " resize-none"}
                    rows={4}
                    placeholder={WORK_PLACEHOLDERS[profession]}
                    value={exp.responsibilities}
                    onChange={(e) => setExp(i, { responsibilities: e.target.value })}
                  />
                </Field>
                <Field label="Achievements & results (with numbers when you have them)" className="mt-4">
                  <textarea
                    className={INPUT + " resize-none"}
                    rows={3}
                    placeholder={ACHIEVEMENT_PLACEHOLDERS[profession]}
                    value={exp.achievements}
                    onChange={(e) => setExp(i, { achievements: e.target.value })}
                  />
                </Field>
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

        {/* ── Step 2: Education, Skills & Certs ── */}
        {step === 2 && (
          <div className="space-y-8">
            {/* Education */}
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
                              prev.map((r, j) => (j === i ? { ...r, school: e.target.value } : r)),
                            )
                          }
                        />
                      </Field>
                      <Field label="Degree / Certificate">
                        <input
                          className={INPUT}
                          placeholder={
                            profession === "business"
                              ? "MBA Finance"
                              : profession === "healthcare"
                                ? "B.Sc Nursing"
                                : profession === "legal"
                                  ? "LL.B."
                                  : "B.Tech Computer Science"
                          }
                          value={edu.degree}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((r, j) => (j === i ? { ...r, degree: e.target.value } : r)),
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
                            prev.map((r, j) => (j === i ? { ...r, year: e.target.value } : r)),
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

            {/* Skills */}
            <div>
              <h2 className="mb-1 text-sm font-semibold text-ink">Skills</h2>
              <p className="mb-3 text-xs text-muted">
                Click to add, or type your own below.
              </p>
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => {
                  const active = selectedSkills.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleSkill(chip)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        active
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-surface text-ink-soft hover:border-brand/40 hover:text-brand"
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
              {selectedSkills.filter((s) => !chips.includes(s)).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedSkills
                    .filter((s) => !chips.includes(s))
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSkill(s)}
                        className="flex items-center gap-1 rounded-full border border-brand bg-brand text-xs font-medium text-white px-3 py-1"
                      >
                        {s}
                        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M11.354 5.354a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646a.5.5 0 0 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8z" />
                        </svg>
                      </button>
                    ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  className={INPUT}
                  placeholder="Add a skill and press Enter"
                  value={customSkillInput}
                  onChange={(e) => setCustomSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === ",") && customSkillInput.trim()) {
                      e.preventDefault();
                      addCustomSkill(customSkillInput);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => customSkillInput.trim() && addCustomSkill(customSkillInput)}
                  className="shrink-0 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-sunken"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Certifications */}
            {(profession === "healthcare" ||
              profession === "legal" ||
              profession === "education" ||
              profession === "engineering" ||
              profession === "hr" ||
              profession === "other") && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-ink">
                  {profession === "healthcare"
                    ? "Licences & Certifications"
                    : profession === "legal"
                      ? "Bar Admissions & Certifications"
                      : profession === "education"
                        ? "Teaching Credentials"
                        : "Certifications & Licences"}
                </h2>
                <p className="mb-3 text-xs text-muted">
                  Comma-separated, e.g.{" "}
                  {profession === "healthcare"
                    ? "RN Licence (Karnataka), BLS, ACLS"
                    : profession === "legal"
                      ? "Bar Council of India, Delhi Bar"
                      : profession === "education"
                        ? "CTET, B.Ed."
                        : "PMP, AWS Solutions Architect"}
                </p>
                <textarea
                  className={INPUT + " resize-none"}
                  rows={2}
                  value={certsRaw}
                  onChange={(e) => setCertsRaw(e.target.value)}
                />
              </div>
            )}
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
              className="rounded-xl bg-brand px-8 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong disabled:opacity-60"
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
              className="rounded-xl bg-brand px-8 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong disabled:opacity-50"
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

// ── Field helper ───────────────────────────────────────────────────────────────

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

"use client";

function BadBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-1.5 text-ink-soft/80">
      <span className="shrink-0 mt-px">•</span>
      <span>{children}</span>
    </li>
  );
}

function GoodBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-1.5 text-ink-soft">
      <span className="shrink-0 mt-px font-bold text-brand">·</span>
      <span>{children}</span>
    </li>
  );
}

function Section({ label }: { label: string }) {
  return (
    <p className="mt-3 mb-1 font-mono text-[8.5px] font-bold uppercase tracking-widest text-muted">
      {label}
    </p>
  );
}

function BeforeCard() {
  return (
    <div className="flex flex-col rounded-xl border border-critical/25 bg-paper shadow-sm">
      {/* header */}
      <div className="flex items-center justify-between border-b border-critical/15 px-3 py-2">
        <span className="rounded-full border border-critical/25 bg-critical-tint px-2 py-0.5 font-mono text-[9px] font-semibold text-critical">
          BEFORE
        </span>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-critical" />
          <span className="font-mono text-[10px] font-semibold text-ink">ATS 44</span>
        </div>
      </div>

      {/* content */}
      <div className="flex-1 overflow-hidden px-3 py-3 text-[10px] leading-[1.5] text-ink">
        <p className="text-[13px] font-bold">Alex Johnson</p>
        <p className="mt-0.5 text-[9px] text-muted">alexj@email.com | 9876-543-210</p>

        <Section label="Experience" />
        <p className="font-semibold">Software Developer, TechCorp</p>
        <p className="text-[9px] text-muted">2021 — Present</p>
        <ul className="mt-1 space-y-0.5">
          <BadBullet>Was responsible for developing features and attending team meetings</BadBullet>
          <BadBullet>Helped the team with various coding tasks and code reviews</BadBullet>
          <BadBullet>Fixed bugs and occasionally wrote unit tests</BadBullet>
          <BadBullet>Was involved in deployment and infrastructure tasks</BadBullet>
        </ul>

        <Section label="Skills" />
        <p className="text-ink-soft">JavaScript, Python, SQL, some React, Node.js, Git, basic Docker</p>

        <Section label="Education" />
        <p className="text-ink-soft">B.S. Computer Science, State University, 2021</p>
      </div>
    </div>
  );
}

function AfterCard() {
  return (
    <div className="flex flex-col rounded-xl border border-brand/30 bg-surface shadow-md ring-1 ring-brand/10">
      {/* header */}
      <div className="flex items-center justify-between border-b border-brand/15 px-3 py-2">
        <span className="rounded-full border border-brand/25 bg-brand-tint px-2 py-0.5 font-mono text-[9px] font-semibold text-brand-strong">
          AFTER
        </span>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-brand" />
          <span className="font-mono text-[10px] font-semibold text-ink">ATS 83</span>
        </div>
      </div>

      {/* content */}
      <div className="flex-1 overflow-hidden px-3 py-3 text-[10px] leading-[1.5] text-ink">
        <p className="text-[13px] font-bold">Alex Johnson</p>
        <p className="mt-0.5 text-[9px] text-muted">alexj@email.com · linkedin.com/in/alexj · 987-654-3210</p>

        <Section label="Summary" />
        <p className="text-ink-soft">
          Backend engineer with 3 yrs building high-traffic Python/Node.js APIs. Systems
          serving <span className="font-semibold text-ink">500K+</span> daily users at &lt;200ms latency.
        </p>

        <Section label="Experience" />
        <p className="font-semibold">Senior Software Engineer — TechCorp</p>
        <p className="text-[9px] text-muted">2021 – Present</p>
        <ul className="mt-1 space-y-0.5">
          <GoodBullet>Led 4 microservices handling <strong className="text-ink">500K+ req/day</strong> at 99.9% uptime</GoodBullet>
          <GoodBullet>Cut latency <strong className="text-ink">60%</strong> (400ms→160ms) via caching + query opt.</GoodBullet>
          <GoodBullet>Mentored <strong className="text-ink">3 engineers</strong>; PR review: 2 days → 4 hours</GoodBullet>
          <GoodBullet>Kubernetes migration cut deploy incidents by <strong className="text-ink">40%</strong></GoodBullet>
        </ul>

        <Section label="Skills" />
        <p className="text-ink-soft">Python · Node.js · React · PostgreSQL · Redis · Kubernetes · AWS</p>

        <Section label="Education" />
        <p className="text-ink-soft">B.S. Computer Science — State University | 2021</p>
        <p className="text-[9px] text-muted">GPA 3.8 · Dean&apos;s List 4 semesters</p>
      </div>
    </div>
  );
}

export function ResumeComparison() {
  return (
    <div className="select-none">
      {/* Score delta callout */}
      <div className="mb-3 flex items-center justify-center gap-2">
        <span className="font-mono text-xs text-muted">ATS 44</span>
        <div className="flex items-center gap-1 rounded-full bg-brand/10 px-3 py-0.5">
          <span className="font-mono text-xs font-bold text-brand">+39 pts</span>
          <span className="text-[10px] text-muted">one session</span>
        </div>
        <span className="font-mono text-xs text-muted">ATS 83</span>
      </div>

      {/* Side-by-side cards */}
      <div className="grid grid-cols-2 gap-3">
        <BeforeCard />
        <AfterCard />
      </div>

      <p className="mt-3 text-center font-mono text-[10px] text-muted">
        Real result · zero invented facts
      </p>
    </div>
  );
}

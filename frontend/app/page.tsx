const modes = [
  {
    name: "Resume Lab",
    desc: "Upload your resume, answer a short wizard, and get a rewritten, ATS-scored PDF and DOCX. Every fact comes from you.",
  },
  {
    name: "Score Repair",
    desc: "Paste feedback from an external checker and get targeted fixes — never a blind full rewrite.",
  },
  {
    name: "JD Enhancer",
    desc: "Tailor a finished resume to a specific job description with truthful keyword coverage.",
  },
  {
    name: "Outcomes",
    desc: "Track where each version was sent and what happened, so your resume improves on evidence.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">ResumeLab</h1>
      <p className="mt-3 text-lg text-slate-600">
        A truthful, ATS-strong resume. We never invent facts, metrics,
        employers, or achievements — everything comes from your real
        experience.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {modes.map((m) => (
          <div
            key={m.name}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold">{m.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{m.desc}</p>
          </div>
        ))}
      </div>
      <a
        href="/login"
        className="mt-10 inline-block w-fit rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-700"
      >
        Sign in with Google to start
      </a>
    </main>
  );
}

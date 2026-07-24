"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Resume = {
  id: string;
  filename: string;
  created_at: string;
};

type Version = {
  id: string;
  status: "draft" | "final";
  created_at: string;
};

type ResumeWithVersion = Resume & { latest_version?: Version };

function StatusBadge({ status }: { status?: "draft" | "final" }) {
  if (status === "final") {
    return (
      <span className="rounded-full bg-brand-tint px-2.5 py-0.5 font-mono text-xs font-semibold text-brand-strong">
        Final
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="rounded-full bg-caution-tint px-2.5 py-0.5 font-mono text-xs font-semibold text-caution">
        Draft
      </span>
    );
  }
  return (
    <span className="rounded-full bg-sunken px-2.5 py-0.5 font-mono text-xs font-medium text-muted">
      Not started
    </span>
  );
}

export function ResumeHistory() {
  const [resumes, setResumes] = useState<ResumeWithVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const list: Resume[] = await api("/resumes");
        const withVersions = await Promise.all(
          list.slice(0, 20).map(async (r) => {
            try {
              const versions: Version[] = await api(`/versions/by-resume/${r.id}`);
              return { ...r, latest_version: versions[0] };
            } catch {
              return r;
            }
          })
        );
        setResumes(withVersions);
      } catch {
        // not signed in or API down — silently skip
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="mt-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
          Your resumes
        </p>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-sunken" />
          ))}
        </div>
      </div>
    );
  }

  if (!resumes.length) return null;

  return (
    <div className="mt-10">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
        Your resumes
      </p>
      <ul className="space-y-2">
        {resumes.map((r) => {
          const date = new Date(r.created_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          return (
            <li key={r.id}>
              <Link
                href={`/resume/${r.id}`}
                className="flex items-center justify-between rounded-xl border border-line bg-surface px-5 py-4 shadow-sm transition hover:border-line-strong hover:shadow"
              >
                {/* Left: icon + filename + date */}
                <div className="flex min-w-0 items-center gap-3">
                  <svg
                    className="h-5 w-5 shrink-0 text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{r.filename}</p>
                    <p className="font-mono text-xs text-muted">{date}</p>
                  </div>
                </div>

                {/* Right: badge + chevron */}
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  <StatusBadge status={r.latest_version?.status} />
                  <svg
                    className="h-4 w-4 text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

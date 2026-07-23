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

export function ResumeHistory() {
  const [resumes, setResumes] = useState<ResumeWithVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const list: Resume[] = await api("/resumes");
        // For each resume fetch its latest version in parallel (max 5)
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
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Your Resumes
        </h2>
        <div className="mt-3 space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!resumes.length) return null;

  return (
    <div className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        Your Resumes
      </h2>
      <ul className="mt-3 space-y-2">
        {resumes.map((r) => {
          const date = new Date(r.created_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          const status = r.latest_version?.status;
          return (
            <li key={r.id}>
              <Link
                href={`/resume/${r.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-slate-400 hover:shadow"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <svg
                    className="h-5 w-5 shrink-0 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {r.filename}
                    </p>
                    <p className="text-xs text-slate-400">{date}</p>
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-2 shrink-0">
                  {status ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        status === "final"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {status === "final" ? "Final" : "Draft"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                      Not started
                    </span>
                  )}
                  <svg
                    className="h-4 w-4 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
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

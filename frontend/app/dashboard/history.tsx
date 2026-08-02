"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

type Resume = {
  id: string;
  filename: string;
  created_at: string;
  quick_score?: number | null;
};

type Version = {
  id: string;
  status: "draft" | "final";
  created_at: string;
};

type ResumeWithVersion = Resume & { latest_version?: Version };

// ── Score chip ────────────────────────────────────────────────────────────────

function ScoreChip({ score }: { score?: number | null }) {
  if (score == null) return null;
  const cls =
    score >= 80
      ? "text-brand bg-brand-tint"
      : score >= 60
        ? "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40"
        : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/40";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${cls}`}
    >
      {score}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: "draft" | "final" }) {
  if (status === "final")
    return (
      <span className="rounded-full bg-brand-tint px-2.5 py-0.5 font-mono text-xs font-semibold text-brand-strong">
        Final
      </span>
    );
  if (status === "draft")
    return (
      <span className="rounded-full bg-caution-tint px-2.5 py-0.5 font-mono text-xs font-semibold text-caution">
        Draft
      </span>
    );
  return (
    <span className="rounded-full bg-sunken px-2.5 py-0.5 font-mono text-xs font-medium text-muted">
      Not started
    </span>
  );
}

// ── File icon ─────────────────────────────────────────────────────────────────

function FileIcon() {
  return (
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
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteModal({
  resume,
  onConfirm,
  onCancel,
  deleting,
}: {
  resume: ResumeWithVersion;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <h3 className="text-base font-semibold text-ink">Delete resume?</h3>
        <p className="mt-1.5 text-sm text-muted">
          <span className="font-medium text-ink-soft">{resume.filename}</span>{" "}
          and all its versions will be permanently removed. This cannot be
          undone.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-lg border border-line bg-surface py-2 text-sm font-medium text-ink transition hover:bg-sunken disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-lg bg-critical py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ResumeHistory() {
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeWithVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ResumeWithVersion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
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
      // not signed in or API down
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/resumes/${deleteTarget.id}`, { method: "DELETE" });
      setResumes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // keep modal open, let user retry
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <section>
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
          Your resumes
        </p>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-sunken" />
          ))}
        </div>
      </section>
    );
  }

  if (!resumes.length) return null;

  return (
    <>
      {deleteTarget && (
        <DeleteModal
          resume={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            Your resumes
          </p>
          <p className="font-mono text-xs text-muted">{resumes.length} file{resumes.length !== 1 ? "s" : ""}</p>
        </div>

        <ul className="space-y-3">
          {resumes.map((r) => {
            const date = new Date(r.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const isFinal = r.latest_version?.status === "final";

            return (
              <li key={r.id}>
                <div className="rounded-xl border border-line bg-surface shadow-sm transition-shadow hover:shadow">
                  {/* ── Main row (navigates to resume flow) ── */}
                  <button
                    type="button"
                    onClick={() => router.push(`/resume/${r.id}`)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left"
                  >
                    <FileIcon />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {r.filename}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-muted">{date}</p>
                    </div>

                    <div className="ml-2 flex shrink-0 items-center gap-2.5">
                      <ScoreChip score={r.quick_score} />
                      <StatusBadge status={r.latest_version?.status} />
                      <svg
                        className="h-4 w-4 text-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </div>
                  </button>

                  {/* ── Action bar ── */}
                  <div className="flex items-center gap-2 border-t border-line px-5 py-2.5">
                    {isFinal ? (
                      <Link
                        href={`/resume/${r.id}`}
                        className="flex items-center gap-1.5 rounded-md bg-brand-tint px-3 py-1.5 font-mono text-xs font-semibold text-brand transition hover:bg-brand hover:text-white"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.75 9h16.5m-16.5 6.75h16.5"
                          />
                        </svg>
                        Tailor for JD
                      </Link>
                    ) : (
                      <Link
                        href={`/resume/${r.id}`}
                        className="flex items-center gap-1.5 rounded-md bg-sunken px-3 py-1.5 font-mono text-xs font-medium text-muted transition hover:bg-line hover:text-ink"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                          />
                        </svg>
                        {r.latest_version?.status === "draft" ? "Continue editing" : "Start optimizing"}
                      </Link>
                    )}

                    <span className="flex-1" />

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(r)}
                      title="Delete resume"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-critical-tint hover:text-critical"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.75}
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                      <span className="sr-only">Delete</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

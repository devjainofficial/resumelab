"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/app/_components/brand-mark";
import { ThemeToggle } from "@/app/_components/theme-toggle";

type Overview = {
  total_users: number;
  total_resumes: number;
  total_versions: number;
  final_versions: number;
  llm_tokens_today: number;
  llm_tokens_7d: number;
  pending_payments: number;
  avg_ats_score: number;
};

type LlmTask = { task: string; calls: number; tokens_in: number; tokens_out: number };
type LlmDay = { day: string; calls: number; tokens: number };
type UserRow = { id: string; email: string; full_name: string | null; created_at: string; credits: number; is_free_user: boolean };
type Payment = { id: string; user_id: string; amount_inr: number; credits_granted: number; provider: string; provider_ref: string; created_at: string };

type Stats = {
  overview: Overview;
  llm_by_task: LlmTask[];
  llm_by_day: LlmDay[];
  recent_users: UserRow[];
  pending_payments: Payment[];
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function MiniBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-12 w-6 rounded-sm bg-sunken overflow-hidden">
        <div
          className="absolute bottom-0 w-full rounded-sm bg-accent transition-all"
          style={{ height: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] text-muted leading-tight text-center w-8 truncate">{label}</span>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    setLoading(true);
    api("/admin/stats")
      .then((d) => { setStats(d); setLoading(false); })
      .catch((e: ApiError) => { setError(String(e.detail)); setLoading(false); });
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  async function approvePayment(id: string) {
    try {
      await api(`/admin/payments/${id}/approve`, { method: "POST" });
      setActionMsg("Payment approved. Credits granted.");
      fetchStats();
    } catch (e) {
      setActionMsg("Failed to approve.");
    }
  }

  async function toggleFree(userId: string, current: boolean) {
    try {
      await api(`/admin/users/${userId}/toggle-free`, { method: "POST" });
      setActionMsg(current ? "Free access removed." : "Free access granted.");
      fetchStats();
    } catch (e) {
      setActionMsg("Failed to update.");
    }
  }

  const maxTokens = stats ? Math.max(...stats.llm_by_day.map((d) => d.tokens), 1) : 1;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandMark size={26} />
            <span className="font-semibold tracking-tight text-ink">ResumeLab</span>
          </Link>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Admin
          </span>
          <div className="flex-1" />
          <ThemeToggle />
          <Link href="/dashboard" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20 pt-8 space-y-10">
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted text-sm">Loading…</div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30">
            <p className="font-medium text-red-700 dark:text-red-400">Access denied</p>
            <p className="mt-1 text-sm text-red-600 dark:text-red-500">{error}</p>
          </div>
        )}

        {actionMsg && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
            {actionMsg}{" "}
            <button onClick={() => setActionMsg(null)} className="ml-2 text-green-600 hover:underline text-xs">dismiss</button>
          </div>
        )}

        {stats && (
          <>
            {/* ── OVERVIEW ── */}
            <section>
              <h2 className="mb-3 font-serif text-lg font-medium text-ink">Overview</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Users" value={fmt(stats.overview.total_users)} />
                <StatTile label="Resumes" value={fmt(stats.overview.total_resumes)} />
                <StatTile
                  label="Versions"
                  value={fmt(stats.overview.total_versions)}
                  sub={`${stats.overview.final_versions} final`}
                />
                <StatTile
                  label="Avg ATS Score"
                  value={stats.overview.avg_ats_score > 0 ? `${stats.overview.avg_ats_score}` : "N/A"}
                />
                <StatTile
                  label="Tokens Today"
                  value={fmt(stats.overview.llm_tokens_today)}
                  sub="Azure GPT-4.1"
                />
                <StatTile
                  label="Tokens 7-Day"
                  value={fmt(stats.overview.llm_tokens_7d)}
                />
                <StatTile
                  label="Pending Payments"
                  value={String(stats.overview.pending_payments)}
                  sub={stats.overview.pending_payments > 0 ? "needs approval" : "all clear"}
                />
              </div>
            </section>

            {/* ── LLM USAGE ── */}
            <section>
              <h2 className="mb-3 font-serif text-lg font-medium text-ink">LLM Usage</h2>
              <div className="rounded-xl border border-line bg-surface p-5">
                {/* 7-day sparkline */}
                <p className="mb-3 text-xs uppercase tracking-wide text-muted">Tokens, last 7 days</p>
                <div className="flex items-end gap-2 h-16 mb-5">
                  {stats.llm_by_day.map((d) => (
                    <MiniBar
                      key={d.day}
                      value={d.tokens}
                      max={maxTokens}
                      label={d.day.slice(5)}
                    />
                  ))}
                </div>

                {/* by-task table */}
                {stats.llm_by_task.length === 0 ? (
                  <p className="text-sm text-muted">No LLM calls in the last 7 days.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                          <th className="pb-2 pr-4 font-medium">Task</th>
                          <th className="pb-2 pr-4 font-medium text-right">Calls</th>
                          <th className="pb-2 pr-4 font-medium text-right">Tokens In</th>
                          <th className="pb-2 font-medium text-right">Tokens Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.llm_by_task.map((t) => (
                          <tr key={t.task} className="border-b border-line/50 last:border-0">
                            <td className="py-2 pr-4 font-mono text-xs text-ink">{t.task}</td>
                            <td className="py-2 pr-4 text-right tabular-nums text-ink-soft">{t.calls}</td>
                            <td className="py-2 pr-4 text-right tabular-nums text-ink-soft">{fmt(t.tokens_in)}</td>
                            <td className="py-2 text-right tabular-nums text-ink-soft">{fmt(t.tokens_out)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* ── PENDING PAYMENTS ── */}
            {stats.pending_payments.length > 0 && (
              <section>
                <h2 className="mb-3 font-serif text-lg font-medium text-ink">
                  Pending Payments
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    {stats.pending_payments.length}
                  </span>
                </h2>
                <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                        <th className="px-4 py-3 font-medium">Reference</th>
                        <th className="px-4 py-3 font-medium">Provider</th>
                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                        <th className="px-4 py-3 font-medium text-right">Credits</th>
                        <th className="px-4 py-3 font-medium">Submitted</th>
                        <th className="px-4 py-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {stats.pending_payments.map((p) => (
                        <tr key={p.id} className="border-b border-line/50 last:border-0 hover:bg-sunken/40">
                          <td className="px-4 py-3 font-mono text-xs text-ink">{p.provider_ref}</td>
                          <td className="px-4 py-3 text-ink-soft">{p.provider}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-ink">₹{p.amount_inr}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-ink">{p.credits_granted}</td>
                          <td className="px-4 py-3 text-muted text-xs">{fmtDate(p.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => approvePayment(p.id)}
                              className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 transition"
                            >
                              Approve
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── RECENT USERS ── */}
            <section>
              <h2 className="mb-3 font-serif text-lg font-medium text-ink">
                Recent Users
                <span className="ml-2 text-sm font-normal text-muted">last 25 signups</span>
              </h2>
              <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Joined</th>
                      <th className="px-4 py-3 font-medium text-right">Credits</th>
                      <th className="px-4 py-3 font-medium text-center">Free</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_users.map((u) => (
                      <tr key={u.id} className="border-b border-line/50 last:border-0 hover:bg-sunken/40">
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{u.full_name ?? "No name"}</p>
                          <p className="text-xs text-muted">{u.email}</p>
                        </td>
                        <td className="px-4 py-3 text-muted text-xs">{fmtDate(u.created_at)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{u.credits}</td>
                        <td className="px-4 py-3 text-center">
                          {u.is_free_user ? (
                            <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
                              yes
                            </span>
                          ) : (
                            <span className="text-muted text-xs">no</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => toggleFree(u.id, u.is_free_user)}
                            className="rounded-md border border-line px-3 py-1 text-xs text-ink-soft hover:bg-sunken transition"
                          >
                            {u.is_free_user ? "Remove free" : "Grant free"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

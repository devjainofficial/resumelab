import { createClient } from "@/lib/supabase/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : "Request failed");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function api(path: string, init?: RequestInit): Promise<any> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, "Please sign in again.");

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> ?? {}),
    Authorization: `Bearer ${session.access_token}`,
    ...(init?.body && typeof init.body === "string"
      ? { "Content-Type": "application/json" }
      : {}),
  };

  // Retry up to 3× on network errors (TypeError = no connection).
  // Render free tier cold-starts take 15–40 s; three 10 s gaps cover it.
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 10_000;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(`${API}${path}`, { ...init, headers });
      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        throw new ApiError(resp.status, body?.detail ?? `Request failed (${resp.status})`);
      }
      return resp.json();
    } catch (e) {
      if (e instanceof ApiError) throw e; // HTTP error — don't retry
      lastErr = e;
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

export function apiUrl(path: string): string {
  return `${API}${path}`;
}

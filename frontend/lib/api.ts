import { createClient } from "@/lib/supabase/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : "Request failed");
  }
}

export async function api(path: string, init?: RequestInit): Promise<any> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, "Please sign in again.");

  const resp = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.body && typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => null);
    throw new ApiError(resp.status, body?.detail ?? `Request failed (${resp.status})`);
  }
  return resp.json();
}

export function apiUrl(path: string): string {
  return `${API}${path}`;
}

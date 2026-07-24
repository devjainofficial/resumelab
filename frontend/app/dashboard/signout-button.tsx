"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-sunken hover:text-ink"
    >
      Sign out
    </button>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./signout-button";

export default async function Dashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: this query can only ever return the signed-in user's own row.
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, avatar_url, credits, is_free_user")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">ResumeLab</h1>
        <SignOutButton />
      </div>

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {profile?.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-12 w-12 rounded-full"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <p className="font-semibold">{profile?.full_name ?? "Welcome"}</p>
            <p className="text-sm text-slate-600">{profile?.email ?? user.email}</p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">JD Enhancer credits</dt>
            <dd className="mt-0.5 font-medium">{profile?.credits ?? 0}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Account</dt>
            <dd className="mt-0.5 font-medium">
              {profile?.is_free_user ? "Free access" : "Standard"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Resume upload arrives in the next build slice.
      </div>
    </main>
  );
}

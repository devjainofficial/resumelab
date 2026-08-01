"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ErrorContent() {
  const sp = useSearchParams();
  const error = sp.get("error");
  const detail = sp.get("detail");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Sign-in didn&apos;t complete</h1>
      <p className="mt-2 text-slate-600">
        Something interrupted the Google sign-in. No changes were made to your
        account. Please try again.
      </p>
      {(error || detail) && (
        <div className="mt-4 w-full rounded-lg bg-red-50 p-3 text-left text-sm text-red-700">
          {error && <p className="font-medium">{error}</p>}
          {detail && <p className="mt-1 text-red-600">{detail}</p>}
        </div>
      )}
      <Link
        href="/login"
        className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700"
      >
        Back to sign in
      </Link>
    </main>
  );
}

export default function AuthCodeError() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}

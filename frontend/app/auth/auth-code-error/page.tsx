import Link from "next/link";

export default function AuthCodeError() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Sign-in didn&apos;t complete</h1>
      <p className="mt-2 text-slate-600">
        Something interrupted the Google sign-in. No changes were made to your
        account — please try again.
      </p>
      <Link
        href="/login"
        className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700"
      >
        Back to sign in
      </Link>
    </main>
  );
}

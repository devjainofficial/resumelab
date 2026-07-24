import Link from "next/link";
import { Flow } from "./flow";

export default function ResumePage({ params }: { params: { id: string } }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-6">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand font-serif text-sm font-bold text-brand-on">
              R
            </div>
            <span className="font-semibold tracking-tight text-ink">ResumeLab</span>
          </div>
          <div className="flex-1" />
          <Link
            href="/dashboard"
            className="text-sm text-muted transition hover:text-ink"
          >
            ← Dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        <Flow resumeId={params.id} />
      </main>
    </>
  );
}

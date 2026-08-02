import Link from "next/link";
import { BrandMark } from "@/app/_components/brand-mark";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { Flow } from "./flow";

export default function ResumePage({ params }: { params: { id: string } }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-6">
          <div className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="font-semibold tracking-tight text-ink">Resume<span className="text-brand">Lab</span></span>
          </div>
          <div className="flex-1" />
          <ThemeToggle />
          <Link
            href="/dashboard"
            className="ml-3 text-sm text-muted transition hover:text-ink"
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

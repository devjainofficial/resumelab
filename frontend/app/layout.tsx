import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResumeLab",
  description: "A truthful, ATS-strong resume. No invented facts, ever.",
  other: {
    // Vercel injects the SHA at build time; lets us verify which commit is live.
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

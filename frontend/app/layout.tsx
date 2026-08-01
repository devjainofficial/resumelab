import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// GeistSans.variable → --font-geist-sans
// GeistMono.variable → --font-geist-mono
// We alias both to our design-system tokens (--font-sans / --font-mono) in globals.css.

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ResumeLab — ATS-ready resumes, no fabrication",
  description:
    "Build a truthful, ATS-strong resume in minutes. We never invent facts, metrics, or achievements.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  other: {
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${newsreader.variable} ${GeistSans.variable} ${GeistMono.variable} min-h-screen bg-paper font-sans text-ink antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}

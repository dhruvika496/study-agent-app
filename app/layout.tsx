import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Study Agent",
  description: "AI tutoring and concept dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-950 text-slate-100">
        <nav className="border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400/80">
                Study Agent
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link
                href="/"
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Chat
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

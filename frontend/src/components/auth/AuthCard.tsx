import React from 'react';
import Link from 'next/link';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
}

export function AuthCard({
  title,
  subtitle,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthCardProps) {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[700px] rounded-full bg-blue-600/10 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-1/4 bottom-1/4 h-[300px] w-[400px] rounded-full bg-cyan-500/10 blur-[110px]"
      />

      {/* Top Bar with Back Link */}
      <div className="relative mx-auto w-full max-w-md pt-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition-colors hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Marketplace
        </Link>
      </div>

      {/* Center Auth Card */}
      <main className="relative my-auto mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl shadow-blue-950/30 backdrop-blur-md">
          {/* Brand Header */}
          <div className="text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              aria-label="TubeX Homepage"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 shadow-sm shadow-cyan-500/20">
                <svg aria-hidden="true" className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">
                Tube<span className="text-cyan-400">X</span>
              </span>
            </Link>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {subtitle}
            </p>
          </div>

          {/* Form Content */}
          <div className="mt-6">
            {children}
          </div>

          {/* Switch link */}
          <div className="mt-6 border-t border-slate-800/80 pt-4 text-center text-xs text-slate-400">
            {footerText}{' '}
            <Link
              href={footerLinkHref}
              className="font-medium text-cyan-400 hover:text-cyan-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            >
              {footerLinkText}
            </Link>
          </div>
        </div>

        {/* Phase 1 Preview notice banner below card */}
        <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3.5 text-center text-[11px] leading-relaxed text-slate-500">
          <strong className="text-slate-400">Phase 1 Preview:</strong> Live authentication credentials and session tokens are not connected or stored yet.
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="relative mx-auto w-full max-w-md pb-2 text-center text-xs text-slate-600">
        &copy; 2026 TubeX Marketplace. All rights reserved.
      </footer>
    </div>
  );
}

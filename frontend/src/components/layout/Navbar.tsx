'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    router.push('/');
  };

  // Safe user display name that gracefully handles empty/whitespace strings
  const displayName = user?.name?.trim() || 'Creator';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="group flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            aria-label="TubeX Homepage"
          >
            {/* Logo Icon */}
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 shadow-sm shadow-cyan-500/20 transition-transform group-hover:scale-105">
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Tube<span className="text-cyan-400">X</span>
            </span>
          </Link>
          <span className="hidden rounded-full border border-cyan-500/20 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300 sm:inline-block">
            Marketplace
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Main Navigation">
          <Link
            href="#featured-channels"
            className="text-sm font-medium text-slate-300 transition-colors hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            Browse Channels
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm font-medium text-slate-300 transition-colors hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            How It Works
          </Link>
          <Link
            href="#trust-safety"
            className="text-sm font-medium text-slate-300 transition-colors hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            Trust &amp; Safety
          </Link>
        </nav>

        {/* Action Buttons (Desktop) */}
        <div className="hidden md:flex items-center gap-3">
          {isLoading ? (
            <div
              className="h-9 w-36 animate-pulse rounded-lg bg-slate-900/80 border border-slate-800"
              aria-label="Loading authentication status"
            />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200"
                aria-label={`Logged in as ${displayName}`}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-950 text-[10px] font-bold text-cyan-400 border border-cyan-500/30">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate font-medium text-slate-200" title={displayName}>
                  {displayName}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-750 px-3.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-900 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              >
                Log Out
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-cyan-500/20 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-md hover:shadow-cyan-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? 'Close main menu' : 'Open main menu'}
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="border-b border-slate-800 bg-slate-950 px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-3" aria-label="Mobile Navigation">
            <Link
              href="#featured-channels"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-cyan-300"
            >
              Browse Channels
            </Link>
            <Link
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-cyan-300"
            >
              How It Works
            </Link>
            <Link
              href="#trust-safety"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-cyan-300"
            >
              Trust &amp; Safety
            </Link>
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-800 pt-3">
              {isLoading ? (
                <div
                  className="h-10 w-full animate-pulse rounded-lg bg-slate-900/80 border border-slate-800"
                  aria-label="Loading authentication status"
                />
              ) : isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <div
                    className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                    aria-label={`Logged in as ${displayName}`}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-950 text-xs font-bold text-cyan-400 border border-cyan-500/30">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate font-medium text-slate-200">
                      {displayName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-lg border border-slate-750 px-3 py-2 text-center text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                  >
                    Log Out
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full rounded-lg border border-slate-700 px-3 py-2 text-center text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:from-blue-500 hover:to-cyan-400"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}


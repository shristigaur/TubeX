import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-slate-850 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:gap-12">
          {/* Brand Info */}
          <div className="md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              aria-label="TubeX Homepage"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-sm shadow-cyan-500/20">
                <svg aria-hidden="true" className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                Tube<span className="text-cyan-400">X</span>
              </span>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              The premier marketplace architecture for acquiring and transferring verified YouTube digital assets with transparency and escrow readiness.
            </p>
          </div>

          {/* Marketplace Navigation */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Marketplace</h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <a href="#featured-channels" className="hover:text-cyan-300 transition-colors">
                  Featured Channels
                </a>
              </li>
              <li>
                <a href="#marketplace-filters" className="hover:text-cyan-300 transition-colors">
                  Filter by Niche
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-cyan-300 transition-colors">
                  How Valuation Works
                </a>
              </li>
            </ul>
          </div>

          {/* Trust & Policy */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Trust &amp; Governance</h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <a href="#trust-safety" className="hover:text-cyan-300 transition-colors">
                  Safety Framework
                </a>
              </li>
              <li>
                <span className="text-slate-500 cursor-not-allowed" title="Documentation coming in future phase">
                  Escrow Protocols (Planned)
                </span>
              </li>
              <li>
                <span className="text-slate-500 cursor-not-allowed" title="Documentation coming in future phase">
                  Ownership Transfer Guide (Planned)
                </span>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance Notice */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Legal Notice</h3>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              TubeX is an independent digital asset marketplace. YouTube™ and its logos are trademarks of Google LLC. TubeX is not endorsed by or affiliated with Google LLC or YouTube.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 border-t border-slate-900 pt-6 text-center text-xs text-slate-500 sm:flex sm:justify-between sm:text-left">
          <p>&copy; 2026 TubeX Marketplace. All rights reserved.</p>
          <p className="mt-2 sm:mt-0">
            Phase 1 Preview &bull; Production Security &amp; Escrow Under Active Construction
          </p>
        </div>
      </div>
    </footer>
  );
}

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { MarketplaceSection } from '@/components/marketplace/MarketplaceSection';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <Navbar />

      <main className="flex-1">
        {/* 1. HERO SECTION */}
        <section
          className="relative overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28"
          aria-labelledby="hero-heading"
        >
          {/* Subtle Ambient Radial Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-blue-600/10 blur-[120px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-1/4 top-1/4 h-[350px] w-[450px] rounded-full bg-cyan-500/10 blur-[100px]"
          />

          <div className="relative mx-auto max-w-5xl text-center">
            {/* Pill Announcement */}
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-medium text-cyan-300 shadow-inner">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Phase 1 Architecture Preview</span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-slate-300">Monetized Channels Marketplace</span>
            </div>

            {/* Main Headline */}
            <h1
              id="hero-heading"
              className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              The Secure Marketplace to{' '}
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent">
                Buy &amp; Sell YouTube Channels
              </span>
            </h1>

            {/* Supporting Description */}
            <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg sm:leading-8">
              Discover established, monetized YouTube channels across technology, finance, gaming, and education.
              Evaluate audited traffic curves, negotiate confident valuations, and prepare for structured digital asset transfers.
            </p>

            {/* Two Primary Calls to Action */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
              <a
                href="#featured-channels"
                className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-cyan-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 sm:w-auto"
              >
                Browse Channels
              </a>
              <a
                href="#how-it-works"
                className="w-full inline-flex items-center justify-center rounded-xl border border-slate-750 bg-slate-900/80 px-6 py-3.5 text-base font-semibold text-slate-200 transition-colors hover:border-cyan-500/50 hover:bg-slate-850 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 sm:w-auto"
              >
                Sell Your Channel
              </a>
            </div>

            {/* Trust highlights under Hero */}
            <div className="mt-12 grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-8 text-left sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Target Audience</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">Global Buyers &amp; Creators</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Asset Verification</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">Analytics Review Process</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Payment Process</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">Escrow Transfer Protocol</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Listing Curation</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">Active Monetization Focus</p>
              </div>
            </div>
          </div>
        </section>

        {/* 2 & 3. MARKETPLACE SEARCH, FILTERS & CHANNELS SHOWCASE */}
        <MarketplaceSection />

        {/* 4. HOW IT WORKS SECTION */}
        <section
          id="how-it-works"
          className="border-t border-slate-850 bg-slate-900/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
          aria-labelledby="how-it-works-heading"
        >
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Transaction Lifecycle
              </span>
              <h2 id="how-it-works-heading" className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                How TubeX Works
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
                A structured, transparent three-stage workflow engineered to protect both creators and acquirers.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
              {/* Step 1 */}
              <div className="relative rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 text-xl font-bold text-cyan-400 ring-1 ring-cyan-500/20">
                  01
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">1. Discover &amp; Evaluate</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Buyers review transparent audience analytics, historical watch time, tier-1 demographics, and revenue metrics before initiating contact.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-xl font-bold text-indigo-400 ring-1 ring-indigo-500/20">
                  02
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">2. Agree on Terms &amp; Escrow</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Both parties establish valuation and transaction terms. Buyer funds are held in secure escrow holding until verified asset handover is confirmed.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600/10 text-xl font-bold text-teal-400 ring-1 ring-teal-500/20">
                  03
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">3. Verified Channel Handover</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Ownership is transferred through standard primary owner permissions on Google/YouTube. Once the buyer verifies control, seller payout is released.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. TRUST & SAFETY SECTION */}
        <section
          id="trust-safety"
          className="border-t border-slate-850 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
          aria-labelledby="trust-safety-heading"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300 ring-1 ring-inset ring-cyan-500/20">
                  Designed for Security
                </span>
                <h2 id="trust-safety-heading" className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Our Intended Safety Framework
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  Digital channel transfers carry unique operational considerations. TubeX is engineered with a strict safety-first roadmap to provide transparency throughout the exchange process:
                </p>

                <dl className="mt-6 space-y-4 text-sm">
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                      <svg
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2.5"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div>
                      <dt className="font-semibold text-white">Manual Analytics Verification Review</dt>
                      <dd className="text-slate-400">
                        Intended workflow requires sellers to provide verified Studio analytics snapshots or live screen walkthroughs before listing approval.
                      </dd>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                      <svg
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2.5"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div>
                      <dt className="font-semibold text-white">Escrow Payment Structure</dt>
                      <dd className="text-slate-400">
                        Funds will be held in designated neutral escrow holding. Sellers do not receive payout until the buyer verifies primary ownership takeover.
                      </dd>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                      <svg
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2.5"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div>
                      <dt className="font-semibold text-white">Cooling-Off &amp; Handover Window</dt>
                      <dd className="text-slate-400">
                        Transactions observe standard 7-day primary owner transfer procedures required by Google Brand Accounts to ensure clean asset migration.
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              {/* Disclaimer Card */}
              <div
                id="auth-notice"
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 text-cyan-400">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-wider">Marketplace Status &amp; Road map</span>
                </div>
                <h3 className="mt-3 text-lg font-bold text-white">
                  Phase 1 Architecture Status
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  This landing page serves as the foundation for the TubeX marketplace. The backend authentication API (`/api/auth/signup` and `/api/auth/login`) is fully implemented with fail-closed security.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  In the immediately upcoming development phase, dedicated interactive signup and login pages will be connected to the backend API, followed by live channel listing and escrow integrations.
                </p>
                <div className="mt-5 rounded-lg border border-slate-750 bg-slate-950/80 p-3.5 text-[11px] text-slate-400">
                  <strong className="text-slate-200">Honesty Commitment:</strong> TubeX does not claim instantaneous automated transfers or zero-risk guarantees. All transfers follow official Google Brand Account guidelines.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. FINAL CALL TO ACTION */}
        <section
          className="border-t border-slate-850 bg-gradient-to-b from-slate-950 via-slate-900/60 to-slate-950 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 text-center"
          aria-labelledby="cta-heading"
        >
          <div className="mx-auto max-w-4xl">
            <h2 id="cta-heading" className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Ready to Acquire or Monetize a Channel?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
              Join serious creators and digital portfolio acquirers building sustainable digital media businesses.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#featured-channels"
                className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-blue-500 hover:to-cyan-400 sm:w-auto"
              >
                Browse Sample Listings
              </a>
              <a
                href="#trust-safety"
                className="w-full inline-flex items-center justify-center rounded-xl border border-slate-750 bg-slate-900 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-850 hover:text-white sm:w-auto"
              >
                Read Safety Protocol
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

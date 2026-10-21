import React from 'react';

export interface SellerChannelsEmptyStateProps {
  onCreateListing?: () => void;
  className?: string;
}

/**
 * Empty state component rendered when an authenticated seller has no channel listings yet.
 * Never fabricates mock listings; provides clear next actions and trust signals.
 */
export function SellerChannelsEmptyState({
  onCreateListing,
  className = '',
}: SellerChannelsEmptyStateProps) {
  return (
    <section
      data-testid="seller-channels-empty-state"
      aria-label="No channel listings available"
      className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-8 sm:p-12 text-center backdrop-blur-md ${className}`}
    >
      {/* Background ambient decorative glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[500px] rounded-full bg-cyan-500/5 blur-[100px]"
      />

      <div className="relative mx-auto max-w-lg">
        {/* Custom Studio / Video Camera Icon Badge */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 shadow-lg shadow-cyan-950/40">
          <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* Heading & Value Proposition */}
        <h3 className="mt-5 text-xl font-bold tracking-tight text-white sm:text-2xl">
          You haven&apos;t listed any YouTube channels yet
        </h3>
        <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-400">
          Turn your YouTube channel into liquid capital. List your channel on TubeX to connect with
          thousands of verified buyers through our secure escrow workflow.
        </p>

        {/* Feature Highlights Pills */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Verified Escrow Protection</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Draft Before Publishing</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Zero Upfront Listing Fee</span>
          </div>
        </div>

        {/* Call to action button */}
        {onCreateListing && (
          <div className="mt-8">
            <button
              type="button"
              onClick={onCreateListing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-cyan-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Your First Listing</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

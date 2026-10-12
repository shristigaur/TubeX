'use client';

import React, { useState, useMemo } from 'react';
import { ChannelCard, SAMPLE_CHANNELS } from '@/components/marketplace/ChannelCard';
import {
  SearchFilterBar,
  FilterValues,
  DEFAULT_FILTERS,
  NICHE_LABEL_MAP,
} from '@/components/marketplace/SearchFilterBar';

export function MarketplaceSection() {
  const [pendingFilters, setPendingFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(DEFAULT_FILTERS);

  const isFiltered =
    appliedFilters.niche !== 'all' ||
    appliedFilters.subscribers !== 'all' ||
    appliedFilters.budget !== 'all';

  const handleFieldChange = (field: keyof FilterValues, value: string) => {
    setPendingFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters);
  };

  const handleResetFilters = () => {
    setPendingFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const filteredChannels = useMemo(() => {
    return SAMPLE_CHANNELS.filter((channel) => {
      // 1. Niche matching
      if (appliedFilters.niche !== 'all') {
        const expectedNiche = NICHE_LABEL_MAP[appliedFilters.niche];
        if (!expectedNiche || channel.niche !== expectedNiche) {
          return false;
        }
      }

      // 2. Subscriber count matching (strictly numeric comparisons)
      // Ranges: 10k-50k [10000..50000], 50k-100k [50000..100000], 100k-500k [100000..500000], 500k+ [>=500000]
      if (appliedFilters.subscribers !== 'all') {
        const subs = channel.subscribersCount;
        switch (appliedFilters.subscribers) {
          case '10k-50k':
            if (subs < 10000 || subs > 50000) return false;
            break;
          case '50k-100k':
            if (subs < 50000 || subs > 100000) return false;
            break;
          case '100k-500k':
            if (subs < 100000 || subs > 500000) return false;
            break;
          case '500k+':
            if (subs < 500000) return false;
            break;
          default:
            break;
        }
      }

      // 3. Budget matching (strictly numeric comparisons)
      // Ranges: under-5k [<5000], 5k-15k [5000..15000], 15k-30k (>15000..30000], 30k+ [>=30000]
      if (appliedFilters.budget !== 'all') {
        const price = channel.priceUsd;
        switch (appliedFilters.budget) {
          case 'under-5k':
            if (price >= 5000) return false;
            break;
          case '5k-15k':
            if (price < 5000 || price > 15000) return false;
            break;
          case '15k-30k':
            if (price <= 15000 || price > 30000) return false;
            break;
          case '30k+':
            if (price < 30000) return false;
            break;
          default:
            break;
        }
      }

      return true;
    });
  }, [appliedFilters]);

  return (
    <>
      {/* 2. SEARCH & FILTER UI */}
      <section className="relative -mt-8 px-4 sm:px-6 lg:px-8" aria-label="Marketplace Search and Filters">
        <div className="mx-auto max-w-5xl">
          <SearchFilterBar
            values={pendingFilters}
            onChange={handleFieldChange}
            onApplyFilters={handleApplyFilters}
            onResetFilters={handleResetFilters}
            resultCount={filteredChannels.length}
            totalCount={SAMPLE_CHANNELS.length}
            isFiltered={isFiltered}
          />
        </div>
      </section>

      {/* 3. FEATURED CHANNELS SECTION */}
      <section
        id="featured-channels"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
        aria-labelledby="featured-heading"
      >
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300 ring-1 ring-inset ring-cyan-500/20">
                Sample Showcase
              </span>
              <span className="inline-flex items-center rounded-md bg-cyan-950/80 px-2.5 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30">
                {filteredChannels.length} {filteredChannels.length === 1 ? 'channel' : 'channels'} found
              </span>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center text-xs font-medium text-slate-400 hover:text-cyan-300 underline underline-offset-2"
                >
                  Reset filters
                </button>
              )}
            </div>
            <h2 id="featured-heading" className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Featured YouTube Channels
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Explore representative channel profiles illustrating audience metrics, monetization status, and market valuations.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            * Displayed prices and stats are illustrative preview listings for Phase 1.
          </div>
        </div>

        {/* Cards Grid or Friendly Empty State */}
        {filteredChannels.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredChannels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 sm:p-12 text-center backdrop-blur-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-950/60 text-cyan-400 ring-1 ring-cyan-500/30">
              <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">No matching sample channels found</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              None of the 6 sample listings match all your selected filter criteria. Try broadening your parameters or reset to view all listings.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-500 hover:to-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

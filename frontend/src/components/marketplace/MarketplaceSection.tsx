'use client';

import React, { useState, useEffect } from 'react';
import { ChannelCard } from '@/components/marketplace/ChannelCard';
import {
  SearchFilterBar,
  FilterValues,
  DEFAULT_FILTERS,
} from '@/components/marketplace/SearchFilterBar';
import { fetchChannels, type ChannelListing, type PaginationMeta } from '@/lib/api';

export function MarketplaceSection() {
  const [pendingFilters, setPendingFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<string>('newest');
  const [page, setPage] = useState<number>(1);
  const [reloadToken, setReloadToken] = useState<number>(0);
  const [resetSignal, setResetSignal] = useState<number>(0);

  const [channels, setChannels] = useState<ChannelListing[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isFiltered =
    appliedFilters.niche !== 'all' ||
    appliedFilters.subscribers !== 'all' ||
    appliedFilters.budget !== 'all';

  // Load channels with cancellation to prevent stale requests from race conditions
  useEffect(() => {
    const controller = new AbortController();
    let isCancelled = false;

    async function loadChannels() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchChannels(
          {
            niche: appliedFilters.niche,
            subscribers: appliedFilters.subscribers,
            budget: appliedFilters.budget,
            page,
            limit: 12,
            sort: sort as any,
          },
          { signal: controller.signal }
        );

        if (!isCancelled) {
          setChannels(response.data.channels);
          setPagination(response.data.pagination);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted || isCancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load channels';
        setError(message);
        setChannels([]);
        setPagination(null);
        setIsLoading(false);
      }
    }

    loadChannels();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [appliedFilters, sort, page, reloadToken]);

  const handleFieldChange = (field: keyof FilterValues, value: string) => {
    setPendingFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters);
    setPage(1);
  };

  const handleResetFilters = () => {
    setPendingFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(1);
    setResetSignal((prev) => prev + 1);
  };

  const handleRetry = () => {
    setReloadToken((prev) => prev + 1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value);
    setPage(1);
  };

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
            resultCount={channels.length}
            totalCount={pagination?.total ?? 0}
            isFiltered={isFiltered}
            isLoading={isLoading}
            resetSignal={resetSignal}
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
              <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                Live Marketplace
              </span>
              <span className="inline-flex items-center rounded-md bg-cyan-950/80 px-2.5 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30">
                {pagination ? `${pagination.total} ${pagination.total === 1 ? 'channel' : 'channels'} found` : 'Searching...'}
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
              Verified YouTube Channels
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Browse authenticated channels available for acquisition with verified metrics, historical earnings, and transparent valuations.
            </p>
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-2">
            <label htmlFor="sort-channels" className="text-xs font-medium text-slate-400">
              Sort by:
            </label>
            <select
              id="sort-channels"
              value={sort}
              onChange={handleSortChange}
              className="rounded-lg border border-slate-750 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="subscribers_desc">Most Subscribers</option>
              <option value="subscribers_asc">Least Subscribers</option>
            </select>
          </div>
        </div>

        {/* LOADING SKELETON STATE */}
        {isLoading && (
          <div
            className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
            aria-label="Loading channels"
            role="status"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm"
              >
                <div>
                  <div className="flex justify-between gap-2">
                    <div className="h-5 w-24 rounded bg-slate-800" />
                    <div className="h-5 w-16 rounded bg-slate-800" />
                  </div>
                  <div className="mt-4 h-6 w-3/4 rounded bg-slate-800" />
                  <div className="mt-2 h-4 w-1/3 rounded bg-slate-800/60" />
                  <div className="mt-3 space-y-2">
                    <div className="h-3 w-full rounded bg-slate-800/40" />
                    <div className="h-3 w-4/5 rounded bg-slate-800/40" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-950/40 p-2.5">
                    <div className="h-7 rounded bg-slate-800/60" />
                    <div className="h-7 rounded bg-slate-800/60" />
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-800/80 pt-4">
                  <div className="h-6 w-20 rounded bg-slate-800" />
                  <div className="h-8 w-24 rounded bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ERROR STATE */}
        {!isLoading && error && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-rose-900/50 bg-rose-950/20 p-8 sm:p-12 text-center backdrop-blur-sm"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-950/60 text-rose-400 ring-1 ring-rose-500/30">
              <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">Unable to Load Channels</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-300">
              {error}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-blue-500 hover:to-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              >
                Retry Request
              </button>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* HONEST EMPTY STATE */}
        {!isLoading && !error && channels.length === 0 && (
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 sm:p-12 text-center backdrop-blur-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-950/60 text-cyan-400 ring-1 ring-cyan-500/30">
              <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">No Matching Channels Found</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              {isFiltered
                ? 'No channels match your active filter criteria. Try broadening your parameters or clear all filters.'
                : 'No channels are currently available in the public catalog. Please check back soon.'}
            </p>
            {isFiltered && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-500 hover:to-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* LIVE CHANNELS GRID */}
        {!isLoading && !error && channels.length > 0 && (
          <>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {channels.map((channel) => (
                <ChannelCard key={channel.id} channel={channel} />
              ))}
            </div>

            {/* PAGINATION CONTROLS */}
            {pagination && pagination.totalPages > 1 && (
              <nav
                aria-label="Marketplace pagination"
                className="mt-12 flex items-center justify-between border-t border-slate-800/80 pt-6"
              >
                <button
                  type="button"
                  disabled={!pagination.hasPrevPage || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-400">
                  Page <span className="font-semibold text-slate-200">{pagination.page}</span> of{' '}
                  <span className="font-semibold text-slate-200">{pagination.totalPages}</span>
                </span>
                <button
                  type="button"
                  disabled={!pagination.hasNextPage || isLoading}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </>
  );
}

'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { fetchChannelById, ApiError, type ChannelListing } from '@/lib/api';

/**
 * Accessible loading skeleton component for the channel detail page.
 */
function ChannelDetailSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading channel details"
      className="mx-auto max-w-7xl animate-pulse space-y-8"
    >
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-20 rounded bg-slate-800" />
        <span className="text-slate-700">/</span>
        <div className="h-4 w-16 rounded bg-slate-800" />
        <span className="text-slate-700">/</span>
        <div className="h-4 w-28 rounded bg-slate-800" />
      </div>

      {/* Header card skeleton */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-28 rounded-md bg-slate-800" />
              <div className="h-6 w-20 rounded-md bg-slate-800" />
            </div>
            <div className="h-9 w-64 rounded bg-slate-800 sm:w-96" />
            <div className="h-4 w-32 rounded bg-slate-800/70" />
          </div>
          <div className="h-14 w-44 rounded-xl bg-slate-800" />
        </div>
      </div>

      {/* Metrics grid skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-2.5"
          >
            <div className="h-3 w-20 rounded bg-slate-800/80" />
            <div className="h-7 w-28 rounded bg-slate-800" />
            <div className="h-3 w-36 rounded bg-slate-800/50" />
          </div>
        ))}
      </div>

      {/* Content & sidebar skeleton */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-4">
            <div className="h-5 w-40 rounded bg-slate-800" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-slate-800/60" />
              <div className="h-4 w-5/6 rounded bg-slate-800/60" />
              <div className="h-4 w-4/6 rounded bg-slate-800/60" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-3">
            <div className="h-5 w-48 rounded bg-slate-800" />
            <div className="h-10 w-full rounded bg-slate-800/40" />
            <div className="h-10 w-full rounded bg-slate-800/40" />
          </div>
        </div>
        <div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-4">
            <div className="h-4 w-28 rounded bg-slate-800" />
            <div className="h-8 w-44 rounded bg-slate-800" />
            <div className="h-12 w-full rounded-xl bg-slate-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inner component that consumes dynamic route parameters and fetches channel data.
 */
function ChannelDetailContent() {
  const routeParams = useParams();
  const rawId = typeof routeParams?.id === 'string' ? routeParams.id : '';

  const [channel, setChannel] = useState<ChannelListing | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(rawId && rawId.trim()));
  const [error, setError] = useState<string | null>(
    rawId && rawId.trim() ? null : 'A valid channel ID is required to view this listing.'
  );
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    const trimmedId = rawId ? rawId.trim() : '';

    if (!trimmedId) {
      return;
    }

    const controller = new AbortController();
    let isCancelled = false;

    async function loadChannel() {
      setIsLoading(true);
      setError(null);
      setIsNotFound(false);

      try {
        const response = await fetchChannelById(trimmedId, { signal: controller.signal });

        if (!isCancelled) {
          setChannel(response.data.channel);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted || isCancelled) {
          // Stale request or unmounted component; ignore cleanly without error state
          return;
        }

        if (err instanceof ApiError && err.statusCode === 404) {
          setIsNotFound(true);
          setChannel(null);
          setIsLoading(false);
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : 'Unable to load channel details. Please check your connection and try again.';
        setError(message);
        setChannel(null);
        setIsLoading(false);
      }
    }

    loadChannel();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [rawId, reloadToken]);

  const handleRetry = () => {
    if (isLoading) return;
    setReloadToken((prev) => prev + 1);
  };

  const sellerName = channel?.seller?.name?.trim() || null;
  const pageTitle = channel
    ? `${channel.name} — TubeX Marketplace`
    : isNotFound
    ? 'Channel Not Found — TubeX'
    : error
    ? 'Unable to Load Channel — TubeX'
    : 'Channel Details — TubeX';

  const metaDescription = channel?.description
    ? channel.description.slice(0, 155)
    : 'Review verified YouTube channel performance metrics, subscriber base, monthly views, and acquisition valuation on TubeX.';

  return (
    <>
      {/* Dynamic page metadata tags hoisted by React 19 */}
      <title>{pageTitle}</title>
      <meta name="description" content={metaDescription} />

      <div className="mx-auto max-w-7xl">
        {/* ACCESSIBLE BREADCRUMB */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-slate-400">
          <Link
            href="/"
            className="transition-colors hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            Marketplace
          </Link>
          <svg
            className="h-3 w-3 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          <Link
            href="/#featured-channels"
            className="transition-colors hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            Channels
          </Link>
          <svg
            className="h-3 w-3 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          <span
            className="max-w-[160px] truncate font-medium text-slate-200 sm:max-w-xs md:max-w-sm"
            aria-current="page"
          >
            {isLoading ? 'Loading...' : isNotFound ? 'Not Found' : channel?.name || 'Channel'}
          </span>
        </nav>

        {/* 1. LOADING SKELETON */}
        {isLoading && <ChannelDetailSkeleton />}

        {/* 2. NOT FOUND (HTTP 404) STATE */}
        {!isLoading && isNotFound && (
          <div
            role="alert"
            className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8 sm:p-12 text-center backdrop-blur-sm shadow-xl"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-slate-300 ring-1 ring-slate-700">
              <svg
                aria-hidden="true"
                className="h-8 w-8 text-cyan-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Channel Not Found
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              The channel listing you requested does not exist, has been removed, or is no longer
              available in the public catalog.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 transition-all hover:from-blue-500 hover:to-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 sm:w-auto"
              >
                Back to Marketplace
              </Link>
              <Link
                href="/#featured-channels"
                className="w-full inline-flex items-center justify-center rounded-xl border border-slate-750 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white sm:w-auto"
              >
                Browse Channels
              </Link>
            </div>
          </div>
        )}

        {/* 3. RECOVERABLE ERROR STATE */}
        {!isLoading && !isNotFound && error && (
          <div
            role="alert"
            className="mx-auto max-w-2xl rounded-2xl border border-rose-900/50 bg-rose-950/20 p-8 sm:p-12 text-center backdrop-blur-sm shadow-xl"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-950/60 text-rose-400 ring-1 ring-rose-500/30">
              <svg
                aria-hidden="true"
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Unable to Load Channel
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              {error}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleRetry}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 transition-all hover:from-blue-500 hover:to-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed sm:w-auto"
              >
                <svg
                  className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{isLoading ? 'Retrying...' : 'Retry Request'}</span>
              </button>
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center rounded-xl border border-slate-750 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white sm:w-auto"
              >
                Back to Marketplace
              </Link>
            </div>
          </div>
        )}

        {/* 4. SUCCESS CHANNEL DETAIL VIEW */}
        {!isLoading && !isNotFound && !error && channel && (
          <div className="space-y-8">
            {/* TOP HEADER CARD */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 backdrop-blur-sm shadow-xl shadow-slate-950/50">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/20">
                      {channel.niche}
                    </span>
                    {channel.featuredBadge && (
                      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                        {channel.featuredBadge}
                      </span>
                    )}
                    {channel.monetized ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/80 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Monetized (YPP Active)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-slate-700">
                        Monetization Inactive
                      </span>
                    )}
                    {channel.verifiedAnalytics ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-950/80 px-2.5 py-1 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/30">
                        <svg
                          aria-hidden="true"
                          className="h-3.5 w-3.5 text-cyan-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Analytics Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950/40 px-2.5 py-1 text-xs font-medium text-amber-400 ring-1 ring-amber-500/30">
                        Unverified Analytics
                      </span>
                    )}
                  </div>

                  {/* Single Meaningful Page-Level <h1> */}
                  <h1 className="mt-4 text-2xl font-bold tracking-tight text-white break-words sm:text-3xl lg:text-4xl">
                    {channel.name}
                  </h1>

                  {/* Handle and optional YouTube URL */}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                    <span className="font-mono text-cyan-400">{channel.handle}</span>
                    {channel.youtubeUrl ? (
                      <>
                        <span className="text-slate-600">&bull;</span>
                        <a
                          href={channel.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-cyan-300 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                          aria-label={`Visit YouTube channel for ${channel.name} (opens in new tab)`}
                        >
                          <svg
                            aria-hidden="true"
                            className="h-3.5 w-3.5 text-red-500"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                          </svg>
                          <span>View on YouTube</span>
                          <svg
                            className="h-3 w-3 text-slate-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Header Price pill */}
                <div className="rounded-xl border border-slate-750 bg-slate-950/80 p-4 lg:text-right shrink-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Acquisition Price
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5 lg:justify-end">
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                      ${channel.priceUsd.toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-cyan-400">USD</span>
                  </div>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Escrow Holding Protocol
                  </span>
                </div>
              </div>
            </div>

            {/* METRICS GRID */}
            <section aria-label="Channel Performance Metrics">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Subscribers */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Subscribers
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-white">
                      {channel.subscribers}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {channel.subscribersCount.toLocaleString()} lifetime subscribers
                  </p>
                </div>

                {/* Monthly Views */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Monthly Views
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-white">
                      {channel.monthlyViews ?? '—'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {channel.monthlyViewsCount != null
                      ? `${channel.monthlyViewsCount.toLocaleString()} 30-day views`
                      : 'Not reported'}
                  </p>
                </div>

                {/* Monetization Status */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Monetization
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className={`text-2xl font-bold tracking-tight ${
                        channel.monetized ? 'text-emerald-400' : 'text-slate-300'
                      }`}
                    >
                      {channel.monetized ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {channel.monetized
                      ? 'AdSense / YPP eligibility verified'
                      : 'Not currently monetized'}
                  </p>
                </div>

                {/* Analytics Verification */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Audit Status
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className={`text-2xl font-bold tracking-tight ${
                        channel.verifiedAnalytics ? 'text-cyan-300' : 'text-amber-400'
                      }`}
                    >
                      {channel.verifiedAnalytics ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {channel.verifiedAnalytics
                      ? 'Studio metrics authenticated'
                      : 'Self-reported by creator'}
                  </p>
                </div>
              </div>
            </section>

            {/* MAIN CONTENT: DETAILS + SIDEBAR */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Left 2 cols: Channel Description & Listing Details */}
              <div className="space-y-6 lg:col-span-2">
                {/* Channel Description */}
                <section
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 backdrop-blur-sm"
                  aria-labelledby="description-heading"
                >
                  <h2
                    id="description-heading"
                    className="text-lg font-semibold tracking-tight text-white"
                  >
                    Channel Overview
                  </h2>
                  <div className="mt-4 border-t border-slate-800/80 pt-4">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                      {channel.description || 'No description provided for this channel.'}
                    </p>
                  </div>
                </section>

                {/* Channel Specifications Table */}
                <section
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 backdrop-blur-sm"
                  aria-labelledby="specs-heading"
                >
                  <h2
                    id="specs-heading"
                    className="text-lg font-semibold tracking-tight text-white"
                  >
                    Listing Specifications
                  </h2>
                  <dl className="mt-4 divide-y divide-slate-800/80 border-t border-slate-800/80 text-sm">
                    <div className="flex justify-between py-3">
                      <dt className="text-slate-400">Category / Niche</dt>
                      <dd className="font-medium text-slate-200">{channel.niche}</dd>
                    </div>
                    <div className="flex justify-between py-3">
                      <dt className="text-slate-400">Channel Handle</dt>
                      <dd className="font-mono text-cyan-300">{channel.handle}</dd>
                    </div>
                    <div className="flex justify-between py-3">
                      <dt className="text-slate-400">Subscribers Count</dt>
                      <dd className="font-medium text-slate-200">
                        {channel.subscribersCount.toLocaleString()} ({channel.subscribers})
                      </dd>
                    </div>
                    <div className="flex justify-between py-3">
                      <dt className="text-slate-400">Monthly Views</dt>
                      <dd className="font-medium text-slate-200">
                        {channel.monthlyViews ?? '—'}
                        {channel.monthlyViewsCount != null && (
                          <span className="ml-1 text-xs text-slate-400">
                            ({channel.monthlyViewsCount.toLocaleString()} total)
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between py-3">
                      <dt className="text-slate-400">Monetization Active</dt>
                      <dd className="font-medium text-slate-200">
                        {channel.monetized ? 'Yes (YouTube Partner Program)' : 'No'}
                      </dd>
                    </div>
                    <div className="flex justify-between py-3">
                      <dt className="text-slate-400">Analytics Verification</dt>
                      <dd className="font-medium text-slate-200">
                        {channel.verifiedAnalytics
                          ? 'Verified via TubeX Review'
                          : 'Unverified / Self-reported'}
                      </dd>
                    </div>
                    <div className="flex justify-between py-3">
                      <dt className="text-slate-400">YouTube Channel URL</dt>
                      <dd className="font-medium text-slate-200">
                        {channel.youtubeUrl ? (
                          <a
                            href={channel.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                          >
                            External Link
                          </a>
                        ) : (
                          <span className="text-slate-500">Not provided</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* Seller & Trust Information */}
                <section
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 backdrop-blur-sm"
                  aria-labelledby="seller-heading"
                >
                  <h2
                    id="seller-heading"
                    className="text-lg font-semibold tracking-tight text-white"
                  >
                    Seller &amp; Transfer Integrity
                  </h2>
                  <div className="mt-4 border-t border-slate-800/80 pt-4 space-y-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Listed by</span>
                      <span className="font-medium text-slate-200">
                        {sellerName || 'Anonymous Seller'}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-750 bg-slate-950/70 p-3.5 text-xs leading-relaxed text-slate-400">
                      <strong className="text-slate-200">Privacy &amp; Escrow Guarantee:</strong>{' '}
                      Direct seller credentials and internal identifiers are protected. Seller
                      contact and primary owner transfer coordination occur exclusively within the
                      TubeX escrow workflow to ensure fair, safe handover.
                    </div>
                  </div>
                </section>
              </div>

              {/* Right 1 col: Acquisition Action & Escrow Details */}
              <div className="space-y-6">
                {/* Valuation & Action Card */}
                <div className="sticky top-24 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 backdrop-blur-md shadow-2xl shadow-blue-950/20">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Total Valuation
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                      ${channel.priceUsd.toLocaleString()}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">USD</span>
                  </div>

                  <div className="mt-6 space-y-3">
                    {/* Honest Phase 1 preview banner */}
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/40 p-3 text-xs text-cyan-200">
                      <span className="font-semibold text-cyan-300">Phase 1 Preview:</span> Direct
                      escrow checkout and buyer messaging are currently in development for Phase
                      2.
                    </div>

                    <button
                      type="button"
                      disabled
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white opacity-70 cursor-not-allowed shadow-md shadow-cyan-500/20"
                      title="Acquisition actions will be enabled in Phase 2"
                    >
                      <span>Initiate Acquisition (Phase 2)</span>
                    </button>

                    <Link
                      href="/"
                      className="w-full inline-flex items-center justify-center rounded-xl border border-slate-750 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                    >
                      Back to Marketplace
                    </Link>
                  </div>

                  {/* Escrow safeguards summary */}
                  <div className="mt-6 border-t border-slate-800/80 pt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                      Transfer Safeguards
                    </h3>
                    <ul className="mt-3 space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2">
                        <svg
                          aria-hidden="true"
                          className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="2.5"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>Escrow holds funds until ownership verification is complete</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg
                          aria-hidden="true"
                          className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="2.5"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>7-day cooling window via Google Brand Account primary owner transfer</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg
                          aria-hidden="true"
                          className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="2.5"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>Audited channel performance and clean asset history</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Dynamic public channel detail page at /channels/[id].
 */
export default function ChannelDetailPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <Navbar />
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Suspense fallback={<ChannelDetailSkeleton />}>
          <ChannelDetailContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

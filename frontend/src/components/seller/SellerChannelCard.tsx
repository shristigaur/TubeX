import React from 'react';
import Link from 'next/link';
import type { SellerChannelListing } from '@/lib/api';
import { centsToUsd } from '@/lib/api';
import { SellerChannelStatusBadge } from './SellerChannelStatusBadge';

export interface SellerChannelCardProps {
  channel: SellerChannelListing;
  onEdit?: (channel: SellerChannelListing) => void;
  onSubmitForReview?: (channel: SellerChannelListing) => void;
  onUnpublish?: (channel: SellerChannelListing) => void;
  onDelete?: (channel: SellerChannelListing) => void;
  isActionLoading?: boolean;
  loadingAction?: 'submit' | 'unpublish' | 'delete' | 'edit' | null;
}

/**
 * Formats a non-negative integer count into standard human-readable display strings (e.g. 245K, 1.2M).
 */
function formatNumberCompact(count: number | null | undefined): string {
  if (count === null || count === undefined || !Number.isFinite(count) || count < 0) {
    return 'Not provided';
  }
  if (count >= 1_000_000_000) {
    const val = count / 1_000_000_000;
    return `${parseFloat(val.toFixed(1))}B`;
  }
  if (count >= 1_000_000) {
    const val = count / 1_000_000;
    return `${parseFloat(val.toFixed(1))}M`;
  }
  if (count >= 1_000) {
    const val = count / 1_000;
    return `${parseFloat(val.toFixed(1))}K`;
  }
  return count.toLocaleString();
}

/**
 * Reusable card displaying an owned channel listing for the authenticated seller dashboard.
 * Encapsulates lifecycle status, publication state, metrics, and emits actions via callbacks.
 */
export function SellerChannelCard({
  channel,
  onEdit,
  onSubmitForReview,
  onUnpublish,
  onDelete,
  isActionLoading = false,
  loadingAction = null,
}: SellerChannelCardProps) {
  // Safe USD conversion
  let formattedPrice = '$0';
  try {
    const usd = centsToUsd(channel.priceCents);
    formattedPrice = `$${usd.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  } catch {
    formattedPrice = `$${(channel.priceCents / 100).toFixed(2)}`;
  }

  const isDraft = channel.status === 'DRAFT';
  const isPendingReview = channel.status === 'PENDING_REVIEW';
  const isAvailable = channel.status === 'AVAILABLE';
  const isDelisted = channel.status === 'DELISTED';
  const isUnderContract = channel.status === 'UNDER_CONTRACT';
  const isSold = channel.status === 'SOLD';

  return (
    <article
      data-testid={`seller-channel-card-${channel.id}`}
      className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/30 hover:bg-slate-900 hover:shadow-xl hover:shadow-cyan-950/20"
    >
      <div>
        {/* Top row: Niche badge & Lifecycle status badge */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300 ring-1 ring-inset ring-cyan-500/20">
            {channel.niche}
          </span>
          <SellerChannelStatusBadge
            status={channel.status}
            isPublished={channel.isPublished}
          />
        </div>

        {/* Channel Name, Handle, and Verification Pill */}
        <div className="mt-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white group-hover:text-cyan-300">
              {channel.name}
            </h3>
            {channel.monetized && (
              <span
                title="Monetization Active"
                className="inline-flex h-5 items-center rounded-full bg-emerald-950/80 px-2 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/30"
              >
                Monetized
              </span>
            )}
            {channel.verifiedAnalytics && (
              <span
                title="Analytics Verified by TubeX"
                className="inline-flex h-5 items-center rounded-full bg-cyan-950/80 px-2 text-[10px] font-medium text-cyan-400 ring-1 ring-cyan-500/30"
              >
                Verified
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
            <span>{channel.handle}</span>
            {channel.youtubeUrl && (
              <a
                href={channel.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                aria-label={`Open YouTube channel for ${channel.name} in new tab`}
              >
                <svg aria-hidden="true" className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
                <span>YouTube</span>
              </a>
            )}
          </div>
        </div>

        {/* Short Description */}
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-slate-300">
          {channel.description}
        </p>

        {/* Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5 text-center">
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-slate-400">
              Subscribers
            </span>
            <span className="font-semibold text-slate-100">
              {formatNumberCompact(channel.subscribersCount)}
            </span>
          </div>
          <div className="border-l border-slate-800">
            <span className="block text-[11px] uppercase tracking-wider text-slate-400">
              Monthly Views
            </span>
            <span className="font-semibold text-slate-100">
              {formatNumberCompact(channel.monthlyViewsCount)}
            </span>
          </div>
        </div>

        {/* In-Review Informational Callout */}
        {isPendingReview && (
          <div
            role="status"
            className="mt-3.5 rounded-lg border border-amber-500/20 bg-amber-950/30 p-2.5 text-xs text-amber-200/90"
          >
            <div className="flex items-center gap-1.5 font-medium text-amber-300">
              <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Moderation In Progress</span>
            </div>
            <p className="mt-1 text-[11px] text-amber-200/80">
              Submitted for admin review. Edits are locked until review completes.
            </p>
          </div>
        )}

        {/* Under Contract / Sold Callout */}
        {isUnderContract && (
          <div className="mt-3.5 rounded-lg border border-indigo-500/20 bg-indigo-950/30 p-2.5 text-xs text-indigo-200/90">
            <span className="font-medium text-indigo-300">Transaction In Progress:</span> Listing is locked under escrow.
          </div>
        )}
        {isSold && (
          <div className="mt-3.5 rounded-lg border border-cyan-500/20 bg-cyan-950/30 p-2.5 text-xs text-cyan-200/90">
            <span className="font-medium text-cyan-300">Listing Sold:</span> Ownership transfer has been completed.
          </div>
        )}
      </div>

      {/* Bottom row: Price & Contextual Action Buttons */}
      <div className="mt-5 border-t border-slate-800/80 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Asking Price
            </span>
            <span className="text-xl font-bold tracking-tight text-white">
              {formattedPrice}
            </span>
            <span className="ml-1 text-xs text-slate-400">USD</span>
          </div>

          {/* Contextual Action Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* DRAFT Actions: Edit, Submit for Review, Delete */}
            {isDraft && (
              <>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(channel)}
                    disabled={isActionLoading}
                    className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                    aria-label={`Edit ${channel.name}`}
                  >
                    Edit
                  </button>
                )}
                {onSubmitForReview && (
                  <button
                    type="button"
                    onClick={() => onSubmitForReview(channel)}
                    disabled={isActionLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/50 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                    aria-label={`Submit ${channel.name} for admin review`}
                  >
                    {isActionLoading && loadingAction === 'submit' ? (
                      <>
                        <svg className="h-3 w-3 animate-spin text-cyan-300" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <span>Submit for Review</span>
                    )}
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(channel)}
                    disabled={isActionLoading}
                    className="inline-flex items-center rounded-lg border border-rose-500/30 bg-rose-950/30 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition-colors hover:border-rose-400 hover:bg-rose-900/40 hover:text-rose-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                    aria-label={`Delete draft listing for ${channel.name}`}
                  >
                    Delete
                  </button>
                )}
              </>
            )}

            {/* AVAILABLE Actions: View Live, Unpublish */}
            {isAvailable && (
              <>
                {channel.isPublished && (
                  <Link
                    href={`/channels/${channel.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                    aria-label={`View live public listing for ${channel.name}`}
                  >
                    <span>View Live</span>
                    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                )}
                {onUnpublish && (
                  <button
                    type="button"
                    onClick={() => onUnpublish(channel)}
                    disabled={isActionLoading}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-950/40 px-2.5 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-900/40 hover:text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                    aria-label={`Unpublish ${channel.name} from public marketplace`}
                  >
                    {isActionLoading && loadingAction === 'unpublish' ? (
                      <>
                        <svg className="h-3 w-3 animate-spin text-amber-300" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        <span>Unpublishing...</span>
                      </>
                    ) : (
                      <span>Unpublish</span>
                    )}
                  </button>
                )}
              </>
            )}

            {/* DELISTED Actions: Delete */}
            {isDelisted && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(channel)}
                disabled={isActionLoading}
                className="inline-flex items-center rounded-lg border border-rose-500/30 bg-rose-950/30 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition-colors hover:border-rose-400 hover:bg-rose-900/40 hover:text-rose-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                aria-label={`Delete delisted listing for ${channel.name}`}
              >
                {isActionLoading && loadingAction === 'delete' ? (
                  <>
                    <svg className="h-3 w-3 animate-spin text-rose-300" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Listing</span>
                )}
              </button>
            )}

            {/* PENDING_REVIEW: Optional Delete */}
            {isPendingReview && onDelete && !channel.isPublished && (
              <button
                type="button"
                onClick={() => onDelete(channel)}
                disabled={isActionLoading}
                className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-rose-500/40 hover:bg-rose-950/30 hover:text-rose-300 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                aria-label={`Delete listing for ${channel.name}`}
              >
                {isActionLoading && loadingAction === 'delete' ? (
                  <>
                    <svg className="h-3 w-3 animate-spin text-rose-300" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Listing</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

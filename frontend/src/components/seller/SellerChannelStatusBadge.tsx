import React from 'react';
import type { ChannelStatus } from '@/lib/api';

export interface SellerChannelStatusBadgeProps {
  status: ChannelStatus;
  isPublished?: boolean;
  className?: string;
  showPublicationState?: boolean;
}

interface StatusConfig {
  label: string;
  description: string;
  badgeClasses: string;
  dotClasses: string;
  publicIndicatorClasses: string;
}

const STATUS_CONFIGS: Record<ChannelStatus, StatusConfig> = {
  DRAFT: {
    label: 'Draft',
    description: 'Private draft. Only visible to you. Not submitted for review.',
    badgeClasses: 'bg-slate-800/80 text-slate-300 border-slate-700/80 ring-slate-700/50',
    dotClasses: 'bg-slate-400',
    publicIndicatorClasses: 'bg-slate-900/80 text-slate-400 border-slate-800',
  },
  PENDING_REVIEW: {
    label: 'In Review',
    description: 'Submitted for admin review. Not yet approved or publicly visible.',
    badgeClasses: 'bg-amber-500/10 text-amber-300 border-amber-500/30 ring-amber-500/20',
    dotClasses: 'bg-amber-400 animate-pulse',
    publicIndicatorClasses: 'bg-amber-950/40 text-amber-300/90 border-amber-500/30',
  },
  AVAILABLE: {
    label: 'Available',
    description: 'Approved and actively listed on the public marketplace.',
    badgeClasses: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 ring-emerald-500/20',
    dotClasses: 'bg-emerald-400',
    publicIndicatorClasses: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30',
  },
  UNDER_CONTRACT: {
    label: 'Under Contract',
    description: 'Offer accepted or in escrow. Marketplace listing is locked.',
    badgeClasses: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 ring-indigo-500/20',
    dotClasses: 'bg-indigo-400',
    publicIndicatorClasses: 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30',
  },
  SOLD: {
    label: 'Sold',
    description: 'Channel ownership transfer successfully completed.',
    badgeClasses: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 ring-cyan-500/20',
    dotClasses: 'bg-cyan-400',
    publicIndicatorClasses: 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30',
  },
  DELISTED: {
    label: 'Delisted',
    description: 'Unpublished by seller or admin. Hidden from the marketplace.',
    badgeClasses: 'bg-rose-500/10 text-rose-300 border-rose-500/30 ring-rose-500/20',
    dotClasses: 'bg-rose-400',
    publicIndicatorClasses: 'bg-rose-950/40 text-rose-300 border-rose-500/30',
  },
};

/**
 * Reusable badge displaying a seller listing's lifecycle status.
 * Clearly communicates state without misleading the user that a pending
 * listing is publicly visible.
 */
export function SellerChannelStatusBadge({
  status,
  isPublished = false,
  className = '',
  showPublicationState = true,
}: SellerChannelStatusBadgeProps) {
  const config = STATUS_CONFIGS[status] ?? {
    label: status,
    description: `Listing status: ${status}`,
    badgeClasses: 'bg-slate-800 text-slate-300 border-slate-700 ring-slate-700/50',
    dotClasses: 'bg-slate-400',
    publicIndicatorClasses: 'bg-slate-900 text-slate-400 border-slate-800',
  };

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {/* Primary Status Pill */}
      <span
        title={config.description}
        aria-label={`Status: ${config.label}. ${config.description}`}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${config.badgeClasses}`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${config.dotClasses}`}
        />
        <span>{config.label}</span>
      </span>

      {/* Visibility Pill (prevents confusion between in-review and public) */}
      {showPublicationState && (
        <span
          title={isPublished ? 'Visible to public marketplace buyers' : 'Private to your seller account'}
          aria-label={isPublished ? 'Publicly listed' : 'Private'}
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${
            isPublished
              ? 'border-emerald-500/30 bg-emerald-950/50 text-emerald-300'
              : 'border-slate-800 bg-slate-950/70 text-slate-400'
          }`}
        >
          {isPublished ? 'Public' : 'Private'}
        </span>
      )}
    </div>
  );
}

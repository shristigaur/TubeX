'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import {
  fetchSellerChannels,
  createSellerChannel,
  updateSellerChannel,
  submitChannelForReview,
  unpublishSellerChannel,
  deleteSellerChannel,
  centsToUsd,
  ApiError,
  type SellerChannelListing,
  type CreateChannelPayload,
  type UpdateChannelPayload,
  type ChannelStatus,
} from '@/lib/api';
import {
  SellerChannelCard,
  SellerChannelForm,
  SellerChannelsEmptyState,
  SellerChannelActionConfirmation,
  type ConfirmationVariant,
} from '@/components/seller';

type StatusFilterTab = 'ALL' | ChannelStatus;

interface ConfirmationState {
  isOpen: boolean;
  type: 'submit' | 'unpublish' | 'delete';
  channel: SellerChannelListing | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();

  // Channel listings state
  const [channels, setChannels] = useState<SellerChannelListing[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [listingsError, setListingsError] = useState<string | null>(null);

  // Status filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilterTab>('ALL');

  // Form modal state (Create / Edit)
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingChannel, setEditingChannel] = useState<SellerChannelListing | null>(null);
  const [isFormLoading, setIsFormLoading] = useState<boolean>(false);
  const [formServerError, setFormServerError] = useState<string | null>(null);

  // Card action loading state (tracks which channel card has an active API request)
  const [activeActionChannelId, setActiveActionChannelId] = useState<string | null>(null);
  const [activeActionType, setActiveActionType] = useState<
    'submit' | 'unpublish' | 'delete' | 'edit' | null
  >(null);

  // Confirmation modal state
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    type: 'delete',
    channel: null,
  });
  const [isConfirmationLoading, setIsConfirmationLoading] = useState<boolean>(false);

  // Feedback notifications (success / error banners)
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Redirect unauthenticated users to /login
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch initial channels on mount when authenticated
  useEffect(() => {
    let isCancelled = false;

    if (!isAuthenticated || !token) {
      return;
    }

    const fetchInitialChannels = async () => {
      try {
        const response = await fetchSellerChannels(token);
        if (!isCancelled) {
          setChannels(response.data.channels);
          setListingsError(null);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const message =
            err instanceof ApiError
              ? err.message
              : 'Failed to load your channel listings. Please check your network connection.';
          setListingsError(message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingListings(false);
        }
      }
    };

    fetchInitialChannels();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, token]);

  // Refresh helper for user actions (button click, after create/update/delete)
  const refreshChannels = useCallback(async () => {
    if (!token) return;

    setIsRefreshing(true);
    setListingsError(null);

    try {
      const response = await fetchSellerChannels(token);
      setChannels(response.data.channels);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to refresh your channel listings. Please check your network connection.';
      setListingsError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [token]);

  // Retry handler for error state
  const handleRetryLoading = useCallback(async () => {
    if (!token) return;

    setIsLoadingListings(true);
    setListingsError(null);

    try {
      const response = await fetchSellerChannels(token);
      setChannels(response.data.channels);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to load your channel listings. Please check your network connection.';
      setListingsError(message);
    } finally {
      setIsLoadingListings(false);
    }
  }, [token]);

  // Auto-dismiss success notification after 6 seconds
  useEffect(() => {
    if (!feedbackSuccess) return;
    const timer = setTimeout(() => {
      setFeedbackSuccess(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [feedbackSuccess]);

  // Close form modal on Escape key press
  useEffect(() => {
    if (!formMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isFormLoading) {
        setFormMode(null);
        setEditingChannel(null);
        setFormServerError(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formMode, isFormLoading]);

  // Form open handlers
  const handleOpenCreate = () => {
    setEditingChannel(null);
    setFormServerError(null);
    setFormMode('create');
  };

  const handleOpenEdit = (channel: SellerChannelListing) => {
    // Only DRAFT channels can be edited per backend lifecycle rules
    if (channel.status !== 'DRAFT') {
      setFeedbackError(
        `Only DRAFT channels can be edited. "${channel.name}" is currently in ${channel.status} status.`
      );
      return;
    }
    setEditingChannel(channel);
    setFormServerError(null);
    setFormMode('edit');
  };

  const handleCloseForm = () => {
    if (isFormLoading) return;
    setFormMode(null);
    setEditingChannel(null);
    setFormServerError(null);
  };

  // Create or Update submission handler
  const handleFormSubmit = async (payload: CreateChannelPayload | UpdateChannelPayload) => {
    if (!token) {
      setFormServerError('Your session has expired. Please sign in again.');
      return;
    }

    setIsFormLoading(true);
    setFormServerError(null);

    try {
      if (formMode === 'create') {
        const createPayload = payload as CreateChannelPayload;
        await createSellerChannel(createPayload, token);
        setFeedbackSuccess(`Draft listing "${createPayload.name}" was created successfully.`);
      } else if (formMode === 'edit' && editingChannel) {
        const updatePayload = payload as UpdateChannelPayload;
        await updateSellerChannel(editingChannel.id, updatePayload, token);
        setFeedbackSuccess(`Listing "${editingChannel.name}" was updated successfully.`);
      }

      setFormMode(null);
      setEditingChannel(null);
      await refreshChannels();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to save channel listing. Please check your input and try again.';
      setFormServerError(message);
    } finally {
      setIsFormLoading(false);
    }
  };

  // Card action triggers (open confirmation dialogs)
  const handleRequestSubmitForReview = (channel: SellerChannelListing) => {
    setFeedbackError(null);
    setConfirmation({
      isOpen: true,
      type: 'submit',
      channel,
    });
  };

  const handleRequestUnpublish = (channel: SellerChannelListing) => {
    setFeedbackError(null);
    setConfirmation({
      isOpen: true,
      type: 'unpublish',
      channel,
    });
  };

  const handleRequestDelete = (channel: SellerChannelListing) => {
    setFeedbackError(null);
    setConfirmation({
      isOpen: true,
      type: 'delete',
      channel,
    });
  };

  const handleCancelConfirmation = () => {
    if (isConfirmationLoading) return;
    setConfirmation({
      isOpen: false,
      type: 'delete',
      channel: null,
    });
  };

  // Execute confirmed action
  const handleConfirmAction = async () => {
    const { type, channel } = confirmation;
    if (!channel || !token) return;

    setIsConfirmationLoading(true);
    setActiveActionChannelId(channel.id);
    setActiveActionType(type);

    try {
      if (type === 'submit') {
        await submitChannelForReview(channel.id, token);
        setFeedbackSuccess(
          `"${channel.name}" has been submitted for admin review. Our team will audit analytics shortly.`
        );
      } else if (type === 'unpublish') {
        await unpublishSellerChannel(channel.id, token);
        setFeedbackSuccess(
          `"${channel.name}" has been unpublished and moved to DELISTED status.`
        );
      } else if (type === 'delete') {
        await deleteSellerChannel(channel.id, token);
        setFeedbackSuccess(`Listing "${channel.name}" was permanently deleted.`);
      }

      setConfirmation({ isOpen: false, type: 'delete', channel: null });
      await refreshChannels();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : `Failed to ${type} listing. Please check your network and try again.`;
      setFeedbackError(message);
      setConfirmation({ isOpen: false, type: 'delete', channel: null });
    } finally {
      setIsConfirmationLoading(false);
      setActiveActionChannelId(null);
      setActiveActionType(null);
    }
  };

  // Compute portfolio metrics
  const stats = useMemo(() => {
    const total = channels.length;
    const available = channels.filter((c) => c.status === 'AVAILABLE').length;
    const inReview = channels.filter((c) => c.status === 'PENDING_REVIEW').length;
    const drafts = channels.filter((c) => c.status === 'DRAFT').length;
    const totalValueUsd = channels.reduce((sum, c) => {
      try {
        return sum + centsToUsd(c.priceCents);
      } catch {
        return sum + c.priceCents / 100;
      }
    }, 0);

    return { total, available, inReview, drafts, totalValueUsd };
  }, [channels]);

  // Filter channels based on status tab
  const filteredChannels = useMemo(() => {
    if (statusFilter === 'ALL') return channels;
    return channels.filter((c) => c.status === statusFilter);
  }, [channels, statusFilter]);

  // Derive confirmation dialog details
  const confirmationConfig = useMemo((): {
    title: string;
    description: string;
    confirmLabel: string;
    variant: ConfirmationVariant;
  } => {
    const channelName = confirmation.channel?.name || 'this channel';

    switch (confirmation.type) {
      case 'submit':
        return {
          title: 'Submit Channel for Review',
          description: `Are you ready to submit "${channelName}" for moderation review? Once submitted, the listing cannot be edited until reviewed by TubeX.`,
          confirmLabel: 'Submit for Review',
          variant: 'primary',
        };
      case 'unpublish':
        return {
          title: 'Unpublish Channel Listing',
          description: `Are you sure you want to unpublish "${channelName}"? The listing will be removed from the public marketplace and set to DELISTED status.`,
          confirmLabel: 'Unpublish Channel',
          variant: 'warning',
        };
      case 'delete':
      default:
        return {
          title: 'Permanently Delete Listing',
          description: `Are you sure you want to delete "${channelName}"? This operation cannot be undone and all draft data will be lost.`,
          confirmLabel: 'Delete Listing',
          variant: 'danger',
        };
    }
  }, [confirmation]);

  // Loading state while auth is hydrating
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4 py-24">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <svg
              className="h-10 w-10 animate-spin text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              role="status"
              aria-label="Verifying seller authorization"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm font-medium text-slate-300">Verifying seller authorization...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Fallback while redirecting unauthenticated visitor to /login
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4 py-24">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-slate-300">Redirecting to login...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const creatorName = user?.name?.trim() || 'Creator';

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <Navbar />

      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Dashboard Header Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-xl backdrop-blur-md">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 -translate-y-1/2 translate-x-1/4 h-[350px] w-[350px] rounded-full bg-cyan-500/10 blur-[90px]"
            />

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 text-xs font-medium text-cyan-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span>Seller Portal</span>
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                  Welcome back, {creatorName}
                </h1>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
                  Manage your YouTube channel listings, track moderation reviews, and configure asking prices.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={refreshChannels}
                  disabled={isRefreshing || isLoadingListings}
                  aria-label="Refresh listings"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-750 bg-slate-800/80 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                >
                  <svg
                    className={`h-4 w-4 text-slate-300 ${isRefreshing ? 'animate-spin' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-cyan-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>New Listing</span>
                </button>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="mt-8 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-6 sm:grid-cols-4 lg:gap-4">
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 sm:p-4">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Total Listings
                </span>
                <span className="mt-1 block text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {stats.total}
                </span>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 sm:p-4">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-emerald-400">
                  Live on Market
                </span>
                <span className="mt-1 block text-xl sm:text-2xl font-bold tracking-tight text-emerald-300">
                  {stats.available}
                </span>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3.5 sm:p-4">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-amber-400">
                  In Review
                </span>
                <span className="mt-1 block text-xl sm:text-2xl font-bold tracking-tight text-amber-300">
                  {stats.inReview}
                </span>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3.5 sm:p-4">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-cyan-400">
                  Portfolio Value
                </span>
                <span className="mt-1 block text-xl sm:text-2xl font-bold tracking-tight text-cyan-300">
                  ${stats.totalValueUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Feedback Success Alert */}
          {feedbackSuccess && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-200"
            >
              <div className="flex items-center gap-2.5">
                <svg className="h-5 w-5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{feedbackSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackSuccess(null)}
                aria-label="Dismiss message"
                className="rounded p-1 text-emerald-400 hover:bg-emerald-900/50 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Feedback Error Alert */}
          {feedbackError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-200"
            >
              <div className="flex items-center gap-2.5">
                <svg className="h-5 w-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{feedbackError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackError(null)}
                aria-label="Dismiss error"
                className="rounded p-1 text-rose-400 hover:bg-rose-900/50 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Listings Section */}
          <section aria-labelledby="seller-listings-heading">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="seller-listings-heading" className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Your Channel Listings
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {channels.length} {channels.length === 1 ? 'channel' : 'channels'} registered under your account.
                </p>
              </div>

              {/* Status Filter Tabs */}
              {channels.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-1 text-xs">
                  {(
                    [
                      { key: 'ALL', label: 'All' },
                      { key: 'DRAFT', label: 'Drafts' },
                      { key: 'PENDING_REVIEW', label: 'In Review' },
                      { key: 'AVAILABLE', label: 'Available' },
                      { key: 'DELISTED', label: 'Delisted' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key)}
                      className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                        statusFilter === tab.key
                          ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content states: Loading Skeleton, Error with Retry, Empty State, or Listing Cards Grid */}
            <div className="mt-6">
              {isLoadingListings ? (
                /* Skeleton Loader */
                <div
                  role="status"
                  aria-busy="true"
                  aria-label="Loading your channel listings"
                  className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                >
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="animate-pulse rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4"
                    >
                      <div className="flex justify-between items-center">
                        <div className="h-5 w-24 rounded bg-slate-800" />
                        <div className="h-5 w-16 rounded bg-slate-800" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-6 w-3/4 rounded bg-slate-800" />
                        <div className="h-4 w-1/2 rounded bg-slate-800/60" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="h-10 rounded bg-slate-800/50" />
                        <div className="h-10 rounded bg-slate-800/50" />
                      </div>
                      <div className="border-t border-slate-800 pt-3 flex justify-between items-center">
                        <div className="h-6 w-20 rounded bg-slate-800" />
                        <div className="h-8 w-24 rounded bg-slate-800" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : listingsError ? (
                /* Listings Fetch Error State with Retry Button */
                <div
                  role="alert"
                  className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 sm:p-12 text-center backdrop-blur-md"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-950/40 text-rose-400">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">Unable to Load Listings</h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-md mx-auto">{listingsError}</p>
                  <button
                    type="button"
                    onClick={handleRetryLoading}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-750 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Retry Loading</span>
                  </button>
                </div>
              ) : channels.length === 0 ? (
                /* Genuine Empty State Component */
                <SellerChannelsEmptyState onCreateListing={handleOpenCreate} />
              ) : filteredChannels.length === 0 ? (
                /* No channels match the selected status filter tab */
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center backdrop-blur-md">
                  <p className="text-sm text-slate-400">
                    No listings match the selected &quot;{statusFilter}&quot; filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className="mt-3 text-xs font-semibold text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Show all listings ({channels.length})
                  </button>
                </div>
              ) : (
                /* Channel Listing Cards Grid */
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredChannels.map((channel) => (
                    <SellerChannelCard
                      key={channel.id}
                      channel={channel}
                      onEdit={handleOpenEdit}
                      onSubmitForReview={handleRequestSubmitForReview}
                      onUnpublish={handleRequestUnpublish}
                      onDelete={handleRequestDelete}
                      isActionLoading={activeActionChannelId === channel.id}
                      loadingAction={activeActionChannelId === channel.id ? activeActionType : null}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Create / Edit Form Modal Dialog */}
      {formMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-dialog-title"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/85 p-4 sm:p-6 sm:py-12 backdrop-blur-sm"
        >
          {/* Backdrop click dismisses form when not submitting */}
          <div
            aria-hidden="true"
            onClick={!isFormLoading ? handleCloseForm : undefined}
            className="fixed inset-0 transition-opacity"
          />

          <div className="relative w-full max-w-2xl my-auto z-10">
            {/* Modal Header */}
            <div className="mb-3 flex items-center justify-between">
              <h2 id="form-dialog-title" className="text-xl font-bold tracking-tight text-white">
                {formMode === 'create'
                  ? 'Create New Channel Listing'
                  : `Edit Listing: ${editingChannel?.name || 'Channel'}`}
              </h2>
              <button
                type="button"
                onClick={handleCloseForm}
                disabled={isFormLoading}
                aria-label="Close form modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Controlled Form */}
            <SellerChannelForm
              mode={formMode}
              initialData={formMode === 'edit' && editingChannel ? editingChannel : undefined}
              onSubmit={handleFormSubmit}
              onCancel={handleCloseForm}
              isLoading={isFormLoading}
              serverError={formServerError}
            />
          </div>
        </div>
      )}

      {/* Confirmation Modal for Lifecycle & Destructive Operations */}
      <SellerChannelActionConfirmation
        isOpen={confirmation.isOpen}
        title={confirmationConfig.title}
        description={confirmationConfig.description}
        confirmLabel={confirmationConfig.confirmLabel}
        variant={confirmationConfig.variant}
        isLoading={isConfirmationLoading}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelConfirmation}
      />

      <Footer />
    </div>
  );
}

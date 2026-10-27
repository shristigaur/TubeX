import React, { useState } from 'react';
import type {
  CreateChannelPayload,
  UpdateChannelPayload,
  SellerChannelListing,
} from '@/lib/api';
import { centsToUsd } from '@/lib/api';
import {
  buildChannelFormPayload,
  normalizeHandle,
} from '@/lib/channelFormPayload.ts';

export const ALLOWED_NICHES = [
  'Technology & Gadgets',
  'Finance & Investing',
  'Gaming & Esports',
  'Lifestyle & Architecture',
  'Education & Science',
  'Health & Fitness',
] as const;

export type NicheCategory = (typeof ALLOWED_NICHES)[number];

export interface SellerChannelFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<SellerChannelListing>;
  onSubmit: (payload: CreateChannelPayload | UpdateChannelPayload) => Promise<void> | void;
  onCancel?: () => void;
  isLoading?: boolean;
  serverError?: string | null;
}

interface FormFieldErrors {
  name?: string;
  handle?: string;
  youtubeUrl?: string;
  niche?: string;
  subscribersCount?: string;
  monthlyViewsCount?: string;
  priceUsd?: string;
  description?: string;
  general?: string;
}

const YOUTUBE_HANDLE_REGEX = /^@[a-zA-Z0-9._-]{3,30}$/;
const USD_STRING_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Validates YouTube URL domain and protocol.
 */
function isValidYouTubeUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const validProtocol = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    const validHost =
      parsed.hostname === 'youtube.com' ||
      parsed.hostname === 'www.youtube.com' ||
      parsed.hostname === 'm.youtube.com' ||
      parsed.hostname === 'youtu.be';
    return validProtocol && validHost;
  } catch {
    return false;
  }
}


/**
 * Reusable controlled form for creating and editing channel listings.
 * Strictly enforces backend validation constraints (priceUsd, handle format,
 * niche selection, integer bounds, optional/null monthlyViewsCount) and handles loading/error states.
 */
export function SellerChannelForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  serverError = null,
}: SellerChannelFormProps) {
  // Controlled field states initialized from initialData or defaults
  const [name, setName] = useState(() => initialData?.name ?? '');
  const [handle, setHandle] = useState(() => initialData?.handle ?? '');
  const [youtubeUrl, setYoutubeUrl] = useState(() => initialData?.youtubeUrl ?? '');
  const [niche, setNiche] = useState<string>(() => initialData?.niche ?? ALLOWED_NICHES[0]);
  const [subscribersCount, setSubscribersCount] = useState(() =>
    initialData?.subscribersCount !== undefined ? String(initialData.subscribersCount) : ''
  );
  const [monthlyViewsCount, setMonthlyViewsCount] = useState(() =>
    initialData?.monthlyViewsCount !== null && initialData?.monthlyViewsCount !== undefined
      ? String(initialData.monthlyViewsCount)
      : ''
  );
  const [monetized, setMonetized] = useState(() => Boolean(initialData?.monetized));
  const [priceUsd, setPriceUsd] = useState(() => {
    if (initialData?.priceCents !== undefined) {
      try {
        return centsToUsd(initialData.priceCents).toString();
      } catch {
        return (initialData.priceCents / 100).toString();
      }
    }
    return '';
  });
  const [description, setDescription] = useState(() => initialData?.description ?? '');

  // Synchronize state when initialData changes to a different listing without useEffect
  const [prevInitialId, setPrevInitialId] = useState(initialData?.id);
  if (initialData?.id !== prevInitialId) {
    setPrevInitialId(initialData?.id);
    setName(initialData?.name ?? '');
    setHandle(initialData?.handle ?? '');
    setYoutubeUrl(initialData?.youtubeUrl ?? '');
    setNiche(initialData?.niche ?? ALLOWED_NICHES[0]);
    setSubscribersCount(
      initialData?.subscribersCount !== undefined ? String(initialData.subscribersCount) : ''
    );
    setMonthlyViewsCount(
      initialData?.monthlyViewsCount !== null && initialData?.monthlyViewsCount !== undefined
        ? String(initialData.monthlyViewsCount)
        : ''
    );
    setMonetized(Boolean(initialData?.monetized));
    if (initialData?.priceCents !== undefined) {
      try {
        setPriceUsd(centsToUsd(initialData.priceCents).toString());
      } catch {
        setPriceUsd((initialData.priceCents / 100).toString());
      }
    } else {
      setPriceUsd('');
    }
    setDescription(initialData?.description ?? '');
  }

  // Local field errors
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
  // Double submission lock
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate all form fields strictly against backend Zod contract.
   */
  const validateForm = (): boolean => {
    const errors: FormFieldErrors = {};

    // 1. Name: 1-100 characters
    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = 'Channel name is required.';
    } else if (trimmedName.length > 100) {
      errors.name = 'Channel name cannot exceed 100 characters.';
    }

    // 2. Handle: @ prefix + 3-30 letters, numbers, periods, dashes, underscores
    const normalizedH = normalizeHandle(handle);
    if (!normalizedH || normalizedH === '@') {
      errors.handle = 'YouTube handle is required.';
    } else if (!YOUTUBE_HANDLE_REGEX.test(normalizedH)) {
      errors.handle =
        'Invalid handle format. Must be @ followed by 3-30 letters, numbers, periods, dashes, or underscores.';
    }

    // 3. YouTube URL: optional, but must be valid if provided
    const trimmedUrl = youtubeUrl.trim();
    if (trimmedUrl && !isValidYouTubeUrl(trimmedUrl)) {
      errors.youtubeUrl =
        'Must be a valid YouTube URL (e.g., https://www.youtube.com/@channel or https://youtu.be/...).';
    }

    // 4. Niche: must match allowed category
    if (!niche || !ALLOWED_NICHES.includes(niche as NicheCategory)) {
      errors.niche = 'Please select a valid channel niche category.';
    }

    // 5. Subscribers Count: integer >= 0, <= 1,000,000,000
    const subsNum = Number(subscribersCount.trim());
    if (subscribersCount.trim() === '') {
      errors.subscribersCount = 'Subscriber count is required.';
    } else if (!Number.isInteger(subsNum) || subsNum < 0) {
      errors.subscribersCount = 'Subscriber count must be a non-negative whole integer.';
    } else if (subsNum > 1_000_000_000) {
      errors.subscribersCount = 'Subscriber count cannot exceed 1,000,000,000.';
    }

    // 6. Monthly Views Count: optional, integer >= 0, <= 10,000,000,000
    const trimmedViews = monthlyViewsCount.trim();
    if (trimmedViews !== '') {
      const viewsNum = Number(trimmedViews);
      if (!Number.isInteger(viewsNum) || viewsNum < 0) {
        errors.monthlyViewsCount = 'Monthly views count must be a non-negative whole integer.';
      } else if (viewsNum > 10_000_000_000) {
        errors.monthlyViewsCount = 'Monthly views count cannot exceed 10,000,000,000.';
      }
    }

    // 7. Price USD: finite number >= 0, <= 20,000,000, max 2 decimals
    const trimmedPrice = priceUsd.trim();
    if (!trimmedPrice) {
      errors.priceUsd = 'Price in USD is required.';
    } else if (!USD_STRING_REGEX.test(trimmedPrice)) {
      errors.priceUsd = 'Price must be a valid non-negative number with at most 2 decimal places.';
    } else {
      const priceNum = Number(trimmedPrice);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        errors.priceUsd = 'Price cannot be negative.';
      } else if (priceNum > 20_000_000) {
        errors.priceUsd = 'Price cannot exceed $20,000,000.';
      }
    }

    // 8. Description: 1-5000 characters
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      errors.description = 'Description is required.';
    } else if (trimmedDesc.length > 5000) {
      errors.description = 'Description cannot exceed 5,000 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLoading) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = buildChannelFormPayload({
        mode,
        initialData,
        name,
        handle,
        youtubeUrl,
        niche,
        subscribersCount,
        monthlyViewsCount,
        monetized,
        priceUsd,
        description,
      });

      await onSubmit(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isLoading || isSubmitting;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl shadow-blue-950/30 backdrop-blur-md"
      aria-label={mode === 'create' ? 'Create channel listing form' : 'Edit channel listing form'}
    >
      {/* Server Error Alert Banner */}
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-200"
        >
          <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <strong className="font-semibold text-rose-300">Action Failed:</strong>
            <p className="mt-0.5">{serverError}</p>
          </div>
        </div>
      )}

      {/* Grid: Name & Handle */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Channel Name */}
        <div>
          <label htmlFor="channel-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Channel Name <span className="text-cyan-400">*</span>
          </label>
          <input
            id="channel-name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="e.g. Apex Tech Reviews"
            disabled={isBusy}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'channel-name-error' : undefined}
            className={`mt-1.5 block w-full rounded-lg border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors focus:outline-none focus:ring-1 ${
              fieldErrors.name
                ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400'
                : 'border-slate-750 focus:border-cyan-400 focus:ring-cyan-400'
            }`}
          />
          {fieldErrors.name && (
            <p id="channel-name-error" className="mt-1.5 text-xs text-rose-400" role="alert">
              {fieldErrors.name}
            </p>
          )}
        </div>

        {/* YouTube Handle */}
        <div>
          <label htmlFor="channel-handle" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            YouTube Handle <span className="text-cyan-400">*</span>
          </label>
          <div className="relative mt-1.5">
            <input
              id="channel-handle"
              type="text"
              required
              maxLength={31}
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                if (fieldErrors.handle) setFieldErrors((prev) => ({ ...prev, handle: undefined }));
              }}
              placeholder="@handle"
              disabled={isBusy}
              aria-invalid={Boolean(fieldErrors.handle)}
              aria-describedby={fieldErrors.handle ? 'channel-handle-error' : undefined}
              className={`block w-full rounded-lg border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors focus:outline-none focus:ring-1 ${
                fieldErrors.handle
                  ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400'
                  : 'border-slate-750 focus:border-cyan-400 focus:ring-cyan-400'
              }`}
            />
          </div>
          {fieldErrors.handle ? (
            <p id="channel-handle-error" className="mt-1.5 text-xs text-rose-400" role="alert">
              {fieldErrors.handle}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">
              Format: @name (3–30 letters, numbers, dots, dashes)
            </p>
          )}
        </div>
      </div>

      {/* Grid: Niche & YouTube URL */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Niche Category */}
        <div>
          <label htmlFor="channel-niche" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Niche Category <span className="text-cyan-400">*</span>
          </label>
          <select
            id="channel-niche"
            value={niche}
            onChange={(e) => {
              setNiche(e.target.value);
              if (fieldErrors.niche) setFieldErrors((prev) => ({ ...prev, niche: undefined }));
            }}
            disabled={isBusy}
            aria-invalid={Boolean(fieldErrors.niche)}
            aria-describedby={fieldErrors.niche ? 'channel-niche-error' : undefined}
            className="mt-1.5 block w-full rounded-lg border border-slate-750 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 shadow-sm transition-colors focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            {ALLOWED_NICHES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {fieldErrors.niche && (
            <p id="channel-niche-error" className="mt-1.5 text-xs text-rose-400" role="alert">
              {fieldErrors.niche}
            </p>
          )}
        </div>

        {/* Optional YouTube URL */}
        <div>
          <label htmlFor="channel-url" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            YouTube Channel Link <span className="text-slate-500 font-normal">(Optional)</span>
          </label>
          <input
            id="channel-url"
            type="url"
            value={youtubeUrl}
            onChange={(e) => {
              setYoutubeUrl(e.target.value);
              if (fieldErrors.youtubeUrl) setFieldErrors((prev) => ({ ...prev, youtubeUrl: undefined }));
            }}
            placeholder="https://www.youtube.com/@channel"
            disabled={isBusy}
            aria-invalid={Boolean(fieldErrors.youtubeUrl)}
            aria-describedby={fieldErrors.youtubeUrl ? 'channel-url-error' : undefined}
            className={`mt-1.5 block w-full rounded-lg border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors focus:outline-none focus:ring-1 ${
              fieldErrors.youtubeUrl
                ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400'
                : 'border-slate-750 focus:border-cyan-400 focus:ring-cyan-400'
            }`}
          />
          {fieldErrors.youtubeUrl && (
            <p id="channel-url-error" className="mt-1.5 text-xs text-rose-400" role="alert">
              {fieldErrors.youtubeUrl}
            </p>
          )}
        </div>
      </div>

      {/* Grid: Subscribers, Monthly Views, Price */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* Subscribers Count */}
        <div>
          <label htmlFor="channel-subscribers" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Subscribers <span className="text-cyan-400">*</span>
          </label>
          <input
            id="channel-subscribers"
            type="number"
            min="0"
            max="1000000000"
            step="1"
            required
            value={subscribersCount}
            onChange={(e) => {
              setSubscribersCount(e.target.value);
              if (fieldErrors.subscribersCount) setFieldErrors((prev) => ({ ...prev, subscribersCount: undefined }));
            }}
            placeholder="e.g. 245000"
            disabled={isBusy}
            aria-invalid={Boolean(fieldErrors.subscribersCount)}
            aria-describedby={fieldErrors.subscribersCount ? 'channel-subscribers-error' : undefined}
            className={`mt-1.5 block w-full rounded-lg border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors focus:outline-none focus:ring-1 ${
              fieldErrors.subscribersCount
                ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400'
                : 'border-slate-750 focus:border-cyan-400 focus:ring-cyan-400'
            }`}
          />
          {fieldErrors.subscribersCount && (
            <p id="channel-subscribers-error" className="mt-1.5 text-xs text-rose-400" role="alert">
              {fieldErrors.subscribersCount}
            </p>
          )}
        </div>

        {/* Monthly Views Count (Optional) */}
        <div>
          <label htmlFor="channel-views" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Monthly Views <span className="text-slate-500 font-normal">(Optional)</span>
          </label>
          <input
            id="channel-views"
            type="number"
            min="0"
            max="10000000000"
            step="1"
            value={monthlyViewsCount}
            onChange={(e) => {
              setMonthlyViewsCount(e.target.value);
              if (fieldErrors.monthlyViewsCount) setFieldErrors((prev) => ({ ...prev, monthlyViewsCount: undefined }));
            }}
            placeholder="e.g. 1200000"
            disabled={isBusy}
            aria-invalid={Boolean(fieldErrors.monthlyViewsCount)}
            aria-describedby={fieldErrors.monthlyViewsCount ? 'channel-views-error' : undefined}
            className={`mt-1.5 block w-full rounded-lg border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors focus:outline-none focus:ring-1 ${
              fieldErrors.monthlyViewsCount
                ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400'
                : 'border-slate-750 focus:border-cyan-400 focus:ring-cyan-400'
            }`}
          />
          {fieldErrors.monthlyViewsCount ? (
            <p id="channel-views-error" className="mt-1.5 text-xs text-rose-400" role="alert">
              {fieldErrors.monthlyViewsCount}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">
              Leave blank if analytics not yet calculated
            </p>
          )}
        </div>

        {/* Asking Price USD */}
        <div>
          <label htmlFor="channel-price" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Asking Price ($ USD) <span className="text-cyan-400">*</span>
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm text-slate-400">
              $
            </span>
            <input
              id="channel-price"
              type="number"
              min="0"
              max="20000000"
              step="0.01"
              required
              value={priceUsd}
              onChange={(e) => {
                setPriceUsd(e.target.value);
                if (fieldErrors.priceUsd) setFieldErrors((prev) => ({ ...prev, priceUsd: undefined }));
              }}
              placeholder="14500.00"
              disabled={isBusy}
              aria-invalid={Boolean(fieldErrors.priceUsd)}
              aria-describedby={fieldErrors.priceUsd ? 'channel-price-error' : undefined}
              className={`block w-full rounded-lg border bg-slate-950 pl-8 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors focus:outline-none focus:ring-1 ${
                fieldErrors.priceUsd
                  ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400'
                  : 'border-slate-750 focus:border-cyan-400 focus:ring-cyan-400'
              }`}
            />
          </div>
          {fieldErrors.priceUsd && (
            <p id="channel-price-error" className="mt-1.5 text-xs text-rose-400" role="alert">
              {fieldErrors.priceUsd}
            </p>
          )}
        </div>
      </div>

      {/* Monetization Checkbox */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            id="channel-monetized"
            type="checkbox"
            checked={monetized}
            onChange={(e) => setMonetized(e.target.checked)}
            disabled={isBusy}
            className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-400 focus:ring-offset-slate-950"
          />
          <div>
            <span className="text-sm font-medium text-slate-200">
              YouTube Partner Program (YPP) Monetization Active
            </span>
            <p className="mt-0.5 text-xs text-slate-400">
              Check this box if the channel currently earns AdSense revenue and has no active strikes.
            </p>
          </div>
        </label>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="channel-description" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Channel Description <span className="text-cyan-400">*</span>
          </label>
          <span className="text-[11px] text-slate-500">
            {description.length} / 5,000 chars
          </span>
        </div>
        <textarea
          id="channel-description"
          rows={4}
          required
          maxLength={5000}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (fieldErrors.description) setFieldErrors((prev) => ({ ...prev, description: undefined }));
          }}
          placeholder="Describe audience demographics, upload schedule, revenue sources, and any digital assets included in the sale..."
          disabled={isBusy}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={fieldErrors.description ? 'channel-desc-error' : undefined}
          className={`mt-1.5 block w-full rounded-lg border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors focus:outline-none focus:ring-1 ${
            fieldErrors.description
              ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400'
              : 'border-slate-750 focus:border-cyan-400 focus:ring-cyan-400'
          }`}
        />
        {fieldErrors.description && (
          <p id="channel-desc-error" className="mt-1.5 text-xs text-rose-400" role="alert">
            {fieldErrors.description}
          </p>
        )}
      </div>

      {/* Form Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800/80 pt-5">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-cyan-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isBusy ? (
            <>
              <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span>{mode === 'create' ? 'Saving Draft...' : 'Updating Listing...'}</span>
            </>
          ) : (
            <span>{mode === 'create' ? 'Save as Draft' : 'Save Changes'}</span>
          )}
        </button>
      </div>
    </form>
  );
}

import type {
  CreateChannelPayload,
  UpdateChannelPayload,
  SellerChannelListing,
} from './api.ts';

/**
 * Normalizes YouTube handle: trims whitespace, prepends '@' if omitted, and converts to lowercase.
 */
export function normalizeHandle(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed.toLowerCase() : `@${trimmed}`.toLowerCase();
}

export interface BuildChannelPayloadInput {
  mode: 'create' | 'edit';
  initialData?: Partial<SellerChannelListing>;
  name: string;
  handle: string;
  youtubeUrl: string;
  niche: string;
  subscribersCount: string;
  monthlyViewsCount: string;
  monetized: boolean;
  priceUsd: string;
  description: string;
}

/**
 * Pure helper function to construct create and edit payloads from SellerChannelForm state.
 *
 * Safe Update Semantics:
 * - In create mode:
 *   - Blank youtubeUrl becomes undefined.
 *   - Blank monthlyViewsCount is omitted.
 * - In edit mode:
 *   - Explicit null is sent for youtubeUrl ONLY if it was previously populated and is now blank.
 *   - Explicit null is sent for monthlyViewsCount ONLY if it was previously populated and is now blank.
 *   - If not previously populated and remains blank, the field is omitted (preserving undefined).
 *   - Non-empty values are parsed and sent normally.
 */
export function buildChannelFormPayload(
  input: BuildChannelPayloadInput
): CreateChannelPayload | UpdateChannelPayload {
  const trimmedName = input.name.trim();
  const normalizedH = normalizeHandle(input.handle);
  const trimmedNiche = input.niche.trim();
  const parsedSubs = Number(input.subscribersCount.trim());
  const parsedPrice = Number(input.priceUsd.trim());
  const trimmedDesc = input.description.trim();

  const trimmedUrl = input.youtubeUrl.trim();
  const trimmedViews = input.monthlyViewsCount.trim();

  if (input.mode === 'create') {
    const payload: CreateChannelPayload = {
      name: trimmedName,
      handle: normalizedH,
      youtubeUrl: trimmedUrl || undefined,
      niche: trimmedNiche,
      subscribersCount: parsedSubs,
      ...(trimmedViews !== '' ? { monthlyViewsCount: Number(trimmedViews) } : {}),
      monetized: input.monetized,
      priceUsd: parsedPrice,
      description: trimmedDesc,
    };
    return payload;
  }

  // Edit mode
  const wasUrlPopulated =
    typeof input.initialData?.youtubeUrl === 'string' &&
    input.initialData.youtubeUrl.trim() !== '';

  const wasViewsPopulated =
    input.initialData?.monthlyViewsCount !== null &&
    input.initialData?.monthlyViewsCount !== undefined &&
    Number.isFinite(input.initialData.monthlyViewsCount);

  let resolvedUrl: string | null | undefined;
  if (trimmedUrl !== '') {
    resolvedUrl = trimmedUrl;
  } else if (wasUrlPopulated) {
    resolvedUrl = null;
  } else {
    resolvedUrl = undefined;
  }

  let resolvedViews: number | null | undefined;
  if (trimmedViews !== '') {
    resolvedViews = Number(trimmedViews);
  } else if (wasViewsPopulated) {
    resolvedViews = null;
  } else {
    resolvedViews = undefined;
  }

  const payload: UpdateChannelPayload = {
    name: trimmedName,
    handle: normalizedH,
    ...(resolvedUrl !== undefined ? { youtubeUrl: resolvedUrl } : {}),
    niche: trimmedNiche,
    subscribersCount: parsedSubs,
    ...(resolvedViews !== undefined ? { monthlyViewsCount: resolvedViews } : {}),
    monetized: input.monetized,
    priceUsd: parsedPrice,
    description: trimmedDesc,
  };

  return payload;
}

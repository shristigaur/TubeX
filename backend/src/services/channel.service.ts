import { prisma } from '../config/prisma.js';
import type { Prisma } from '@prisma/client';
import {
  type ChannelQueryInput,
  BUDGET_RANGES,
  SUBSCRIBER_RANGES,
  NICHE_LABEL_MAP,
  usdToCents,
  centsToUsd,
} from '../validators/channel.validator.js';

/**
 * Custom validation error for inconsistent or conflicting query bounds.
 * Carries an HTTP 400 status code compatible with the project's centralized errorHandler.
 */
export class ChannelValidationError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.name = 'ChannelValidationError';
    this.status = 400;
  }
}

/**
 * Explicit Prisma select projection for public channel listings.
 * Strictly avoids returning seller password hashes, emails, Google IDs, or full user objects.
 */
export const PUBLIC_CHANNEL_SELECT = {
  id: true,
  name: true,
  handle: true,
  youtubeUrl: true,
  niche: true,
  subscribersCount: true,
  monthlyViewsCount: true,
  monetized: true,
  verifiedAnalytics: true,
  priceCents: true,
  description: true,
  featuredBadge: true,
  status: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  seller: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

export interface PublicSellerDto {
  id: string;
  name: string;
}

export interface PublicChannelDto {
  id: string;
  name: string;
  handle: string;
  youtubeUrl: string | null;
  niche: string;
  subscribers: string;
  subscribersCount: number;
  monthlyViews: string | null;
  monthlyViewsCount: number | null;
  monetized: boolean;
  verifiedAnalytics: boolean;
  priceCents: number;
  priceUsd: number;
  description: string;
  featuredBadge: string | null;
  status: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  seller: PublicSellerDto;
}

export interface PublicChannelListResult {
  channels: PublicChannelDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Formats a non-negative integer count into standard human-readable display strings (e.g. 245K, 1.2M).
 * Returns null if count is null, undefined, negative, or not finite.
 */
export function formatCount(count: number | null | undefined): string | null {
  if (count === null || count === undefined || !Number.isFinite(count) || count < 0) {
    return null;
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
  return count.toString();
}

/**
 * Maps raw database listing record to safe public channel DTO.
 */
export function mapToPublicChannelDto(channel: any): PublicChannelDto {
  return {
    id: channel.id,
    name: channel.name,
    handle: channel.handle,
    youtubeUrl: channel.youtubeUrl ?? null,
    niche: channel.niche,
    subscribers: formatCount(channel.subscribersCount) ?? '0',
    subscribersCount: channel.subscribersCount,
    monthlyViews: channel.monthlyViewsCount != null ? formatCount(channel.monthlyViewsCount) : null,
    monthlyViewsCount: channel.monthlyViewsCount ?? null,
    monetized: Boolean(channel.monetized),
    verifiedAnalytics: Boolean(channel.verifiedAnalytics),
    priceCents: channel.priceCents,
    priceUsd: centsToUsd(channel.priceCents),
    description: channel.description,
    featuredBadge: channel.featuredBadge ?? null,
    status: channel.status,
    isPublished: channel.isPublished,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
    seller: {
      id: channel.seller?.id ?? '',
      name: channel.seller?.name ?? '',
    },
  };
}

/**
 * Builds combined price filtering condition in integer cents, safely harmonizing
 * preset budget ranges and custom minPrice/maxPrice constraints.
 */
function buildPriceCondition(query: ChannelQueryInput): Prisma.IntFilter | undefined {
  let customMinCents: number | undefined;
  let customMaxCents: number | undefined;

  if (query.minPrice !== undefined) {
    customMinCents = usdToCents(query.minPrice);
  }
  if (query.maxPrice !== undefined) {
    customMaxCents = usdToCents(query.maxPrice);
  }

  if (customMinCents !== undefined && customMaxCents !== undefined && customMinCents > customMaxCents) {
    throw new ChannelValidationError('minPrice cannot be greater than maxPrice');
  }

  let budgetMinCents: number | undefined;
  let budgetMaxCents: number | undefined;

  if (query.budget && query.budget !== 'all') {
    const range = BUDGET_RANGES[query.budget];
    if (range) {
      budgetMinCents = range.minCents;
      budgetMaxCents = range.maxCents;
    }
  }

  // Effective lower bound (gte)
  let effectiveMinCents: number | undefined;
  if (budgetMinCents !== undefined && budgetMinCents > 0) {
    effectiveMinCents = customMinCents !== undefined
      ? Math.max(budgetMinCents, customMinCents)
      : budgetMinCents;
  } else if (customMinCents !== undefined) {
    effectiveMinCents = customMinCents;
  }

  // Effective upper bound:
  // Budget upper bound is exclusive (< budgetMaxCents).
  // Custom upper bound is inclusive (<= customMaxCents).
  let effectiveUpperType: 'lt' | 'lte' | undefined;
  let effectiveUpperVal: number | undefined;

  if (budgetMaxCents !== undefined && customMaxCents !== undefined) {
    if (customMaxCents < budgetMaxCents) {
      effectiveUpperType = 'lte';
      effectiveUpperVal = customMaxCents;
    } else {
      effectiveUpperType = 'lt';
      effectiveUpperVal = budgetMaxCents;
    }
  } else if (budgetMaxCents !== undefined) {
    effectiveUpperType = 'lt';
    effectiveUpperVal = budgetMaxCents;
  } else if (customMaxCents !== undefined) {
    effectiveUpperType = 'lte';
    effectiveUpperVal = customMaxCents;
  }

  // Range consistency check
  if (effectiveMinCents !== undefined && effectiveUpperVal !== undefined) {
    if (effectiveUpperType === 'lte' && effectiveMinCents > effectiveUpperVal) {
      throw new ChannelValidationError('Inconsistent price bounds: minimum price exceeds maximum price');
    }
    if (effectiveUpperType === 'lt' && effectiveMinCents >= effectiveUpperVal) {
      throw new ChannelValidationError('Inconsistent price bounds: minimum price exceeds maximum price');
    }
  }

  if (effectiveMinCents !== undefined || effectiveUpperVal !== undefined) {
    const filter: Prisma.IntFilter = {};
    if (effectiveMinCents !== undefined) {
      filter.gte = effectiveMinCents;
    }
    if (effectiveUpperType === 'lte' && effectiveUpperVal !== undefined) {
      filter.lte = effectiveUpperVal;
    } else if (effectiveUpperType === 'lt' && effectiveUpperVal !== undefined) {
      filter.lt = effectiveUpperVal;
    }
    return filter;
  }

  return undefined;
}

/**
 * Builds combined subscriber count filtering condition, safely harmonizing
 * preset subscriber ranges and custom minSubscribers/maxSubscribers constraints.
 */
function buildSubscriberCondition(query: ChannelQueryInput): Prisma.IntFilter | undefined {
  if (
    query.minSubscribers !== undefined &&
    query.maxSubscribers !== undefined &&
    query.minSubscribers > query.maxSubscribers
  ) {
    throw new ChannelValidationError('minSubscribers cannot be greater than maxSubscribers');
  }

  let presetMinSubs: number | undefined;
  let presetMaxSubs: number | undefined;

  if (query.subscribers && query.subscribers !== 'all') {
    const range = SUBSCRIBER_RANGES[query.subscribers];
    if (range) {
      presetMinSubs = range.min;
      presetMaxSubs = range.max;
    }
  }

  let effectiveMinSubs: number | undefined;
  if (presetMinSubs !== undefined) {
    effectiveMinSubs = query.minSubscribers !== undefined
      ? Math.max(presetMinSubs, query.minSubscribers)
      : presetMinSubs;
  } else if (query.minSubscribers !== undefined) {
    effectiveMinSubs = query.minSubscribers;
  }

  let effectiveMaxSubs: number | undefined;
  if (presetMaxSubs !== undefined) {
    effectiveMaxSubs = query.maxSubscribers !== undefined
      ? Math.min(presetMaxSubs, query.maxSubscribers)
      : presetMaxSubs;
  } else if (query.maxSubscribers !== undefined) {
    effectiveMaxSubs = query.maxSubscribers;
  }

  if (effectiveMinSubs !== undefined && effectiveMaxSubs !== undefined && effectiveMinSubs > effectiveMaxSubs) {
    throw new ChannelValidationError('Inconsistent subscriber bounds: minimum subscribers exceeds maximum subscribers');
  }

  if (effectiveMinSubs !== undefined || effectiveMaxSubs !== undefined) {
    const filter: Prisma.IntFilter = {};
    if (effectiveMinSubs !== undefined) {
      filter.gte = effectiveMinSubs;
    }
    if (effectiveMaxSubs !== undefined) {
      filter.lte = effectiveMaxSubs;
    }
    return filter;
  }

  return undefined;
}

/**
 * Builds deterministic Prisma orderBy array with stable { id: 'desc' } tie-breaker.
 */
function buildOrderBy(sort?: string): Prisma.ChannelOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [{ createdAt: 'asc' }, { id: 'desc' }];
    case 'price_asc':
      return [{ priceCents: 'asc' }, { id: 'desc' }];
    case 'price_desc':
      return [{ priceCents: 'desc' }, { id: 'desc' }];
    case 'subscribers_desc':
      return [{ subscribersCount: 'desc' }, { id: 'desc' }];
    case 'subscribers_asc':
      return [{ subscribersCount: 'asc' }, { id: 'desc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}

/**
 * Service to retrieve paginated public channel listings.
 * Enforces strict public visibility, database-level filtering, deterministic sorting,
 * safe pagination, and stripped seller projections.
 */
export async function getPublicChannels(query: ChannelQueryInput): Promise<PublicChannelListResult> {
  // 1. Mandatory public visibility conditions
  const where: Prisma.ChannelWhereInput = {
    isPublished: true,
    status: 'AVAILABLE',
  };

  // 2. Niche filtering
  if (query.niche && query.niche !== 'all') {
    const resolvedNiche = NICHE_LABEL_MAP[query.niche] || query.niche;
    where.niche = resolvedNiche;
  }

  // 3. Price & Budget filtering
  const priceCondition = buildPriceCondition(query);
  if (priceCondition) {
    where.priceCents = priceCondition;
  }

  // 4. Subscriber count filtering
  const subscriberCondition = buildSubscriberCondition(query);
  if (subscriberCondition) {
    where.subscribersCount = subscriberCondition;
  }

  // 5. Validated pagination
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(50, Math.max(1, query.limit ?? 10));
  const skip = (page - 1) * limit;
  const take = limit;

  // 6. Deterministic sorting
  const orderBy = buildOrderBy(query.sort);

  // 7. Concurrent database query using consistent where filter
  const [channels, total] = await Promise.all([
    prisma.channel.findMany({
      where,
      select: PUBLIC_CHANNEL_SELECT,
      orderBy,
      skip,
      take,
    }),
    prisma.channel.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    channels: channels.map(mapToPublicChannelDto),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Service to retrieve a single public channel listing by its unique MongoDB ID.
 * Strictly enforces that the listing is published (isPublished: true) and has an AVAILABLE status.
 * Strips all internal and sensitive seller fields via PUBLIC_CHANNEL_SELECT and mapToPublicChannelDto.
 * Returns null if the channel is not found, unpublished, or unavailable.
 */
export async function getPublicChannelById(id: string): Promise<PublicChannelDto | null> {
  const channel = await prisma.channel.findFirst({
    where: {
      id,
      isPublished: true,
      status: 'AVAILABLE',
    },
    select: PUBLIC_CHANNEL_SELECT,
  });

  if (!channel) {
    return null;
  }

  return mapToPublicChannelDto(channel);
}

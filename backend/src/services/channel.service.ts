import { prisma } from '../config/prisma.js';
import type { Channel, Prisma } from '@prisma/client';
import {
  type ChannelQueryInput,
  type CreateChannelInput,
  type UpdateChannelInput,
  createChannelSchema,
  updateChannelSchema,
  BUDGET_RANGES,
  SUBSCRIBER_RANGES,
  NICHE_LABEL_MAP,
  usdToCents,
  centsToUsd,
} from '../validators/channel.validator.js';

/**
 * Custom validation error for inconsistent or conflicting query bounds and payload errors.
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
 * Custom error when a channel record is not found.
 * Carries an HTTP 404 status code compatible with the project's centralized errorHandler.
 */
export class ChannelNotFoundError extends Error {
  status: number;

  constructor(message: string = 'Channel not found') {
    super(message);
    this.name = 'ChannelNotFoundError';
    this.status = 404;
  }
}

/**
 * Custom error when an operation is forbidden due to ownership mismatch.
 * Carries an HTTP 403 status code compatible with the project's centralized errorHandler.
 */
export class ChannelForbiddenError extends Error {
  status: number;

  constructor(message: string = 'Forbidden: Access denied to channel') {
    super(message);
    this.name = 'ChannelForbiddenError';
    this.status = 403;
  }
}

export interface DeleteChannelResult {
  success: boolean;
  id: string;
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

/**
 * Allowed channel statuses that can be updated by the seller.
 * Product rules: Sellers can only edit private DRAFT listings before review submission.
 */
export const ALLOWED_SELLER_UPDATE_STATUSES = ['DRAFT'] as const;

/**
 * Creates a new private draft channel listing for a seller.
 * - Enforces sellerId exclusively from the authenticated context.
 * - Validates input strictly with createChannelSchema (rejects protected/admin fields).
 * - Converts USD price to integer cents using usdToCents.
 * - Enforces status: DRAFT and isPublished: false defaults.
 */
export async function createChannelListing(
  sellerId: string,
  input: unknown
): Promise<Channel> {
  if (!sellerId || typeof sellerId !== 'string' || sellerId.trim() === '') {
    throw new ChannelValidationError('Seller ID is required');
  }

  const parseResult = createChannelSchema.safeParse(input);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues[0]?.message || 'Validation failed';
    throw new ChannelValidationError(errorMsg);
  }

  const data = parseResult.data;
  const priceCents = usdToCents(data.priceUsd);

  return prisma.channel.create({
    data: {
      sellerId,
      name: data.name,
      handle: data.handle,
      youtubeUrl: data.youtubeUrl ?? null,
      niche: data.niche,
      subscribersCount: data.subscribersCount,
      monthlyViewsCount: data.monthlyViewsCount ?? null,
      monetized: data.monetized ?? false,
      priceCents,
      description: data.description,
      status: 'DRAFT',
      isPublished: false,
    },
  });
}

/**
 * Retrieves all channel listings belonging to an authenticated seller.
 * Strictly scopes by sellerId to ensure private drafts or pending listings
 * of other sellers are never exposed.
 */
export async function getSellerChannels(sellerId: string): Promise<Channel[]> {
  if (!sellerId || typeof sellerId !== 'string' || sellerId.trim() === '') {
    throw new ChannelValidationError('Seller ID is required');
  }

  return prisma.channel.findMany({
    where: {
      sellerId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Retrieves a single channel listing by ID scoped to the seller.
 * Returns null if not found or if the listing belongs to another seller
 * (preserving the existing service's established not-found return convention).
 */
export async function getSellerChannelById(
  sellerId: string,
  channelId: string
): Promise<Channel | null> {
  if (!sellerId || typeof sellerId !== 'string' || sellerId.trim() === '') {
    throw new ChannelValidationError('Seller ID is required');
  }
  if (!channelId || typeof channelId !== 'string' || channelId.trim() === '') {
    throw new ChannelValidationError('Channel ID is required');
  }

  return prisma.channel.findFirst({
    where: {
      id: channelId,
      sellerId,
    },
  });
}

/**
 * Updates a seller's existing channel listing.
 * - Strictly validates input with updateChannelSchema (rejects protected/admin fields).
 * - Enforces seller ownership.
 * - Permits updates only for eligible statuses (DRAFT).
 * - Enforces sellerId in the database update operation.
 */
export async function updateSellerChannel(
  sellerId: string,
  channelId: string,
  input: unknown
): Promise<Channel> {
  if (!sellerId || typeof sellerId !== 'string' || sellerId.trim() === '') {
    throw new ChannelValidationError('Seller ID is required');
  }
  if (!channelId || typeof channelId !== 'string' || channelId.trim() === '') {
    throw new ChannelValidationError('Channel ID is required');
  }

  const parseResult = updateChannelSchema.safeParse(input);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues[0]?.message || 'Validation failed';
    throw new ChannelValidationError(errorMsg);
  }

  const data = parseResult.data;

  // 1. Verify existence and ownership
  const existing = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!existing) {
    throw new ChannelNotFoundError('Channel not found');
  }

  if (existing.sellerId !== sellerId) {
    throw new ChannelForbiddenError('Forbidden: You do not have permission to update this channel');
  }

  // 2. Enforce allowed status per product rules
  if (!ALLOWED_SELLER_UPDATE_STATUSES.includes(existing.status as any)) {
    throw new ChannelValidationError(
      `Cannot update channel in status "${existing.status}". Only DRAFT channels can be edited.`
    );
  }

  // 3. Build update payload safely
  const updateData: Prisma.ChannelUpdateInput = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.handle !== undefined) updateData.handle = data.handle;
  if (data.youtubeUrl !== undefined) updateData.youtubeUrl = data.youtubeUrl ?? null;
  if (data.niche !== undefined) updateData.niche = data.niche;
  if (data.subscribersCount !== undefined) updateData.subscribersCount = data.subscribersCount;
  if (data.monthlyViewsCount !== undefined) updateData.monthlyViewsCount = data.monthlyViewsCount ?? null;
  if (data.monetized !== undefined) updateData.monetized = data.monetized;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.priceUsd !== undefined) {
    updateData.priceCents = usdToCents(data.priceUsd);
  }

  // 4. Atomic conditional update: must still belong to seller and be in DRAFT status
  const updateResult = await prisma.channel.updateMany({
    where: {
      id: channelId,
      sellerId,
      status: 'DRAFT',
    },
    data: updateData,
  });

  if (updateResult.count === 0) {
    throw new ChannelValidationError(
      'Failed to update channel: listing is not in DRAFT status or has been modified concurrently.'
    );
  }

  const updated = await prisma.channel.findFirst({
    where: {
      id: channelId,
      sellerId,
    },
  });

  return updated!;
}

/**
 * Submits a draft channel listing for admin moderation review.
 * - Permits submission only from an eligible DRAFT status.
 * - Enforces seller ownership.
 * - Transitions status to PENDING_REVIEW while strictly keeping isPublished: false.
 * - Uses atomic conditional update to ensure state is still DRAFT at write time.
 * - Never approves or publishes the listing.
 */
export async function submitChannelForReview(
  sellerId: string,
  channelId: string
): Promise<Channel> {
  if (!sellerId || typeof sellerId !== 'string' || sellerId.trim() === '') {
    throw new ChannelValidationError('Seller ID is required');
  }
  if (!channelId || typeof channelId !== 'string' || channelId.trim() === '') {
    throw new ChannelValidationError('Channel ID is required');
  }

  const existing = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!existing) {
    throw new ChannelNotFoundError('Channel not found');
  }

  if (existing.sellerId !== sellerId) {
    throw new ChannelForbiddenError('Forbidden: You do not have permission to submit this channel for review');
  }

  if (existing.status !== 'DRAFT') {
    throw new ChannelValidationError(
      `Cannot submit channel with status "${existing.status}" for review. Only DRAFT channels can be submitted.`
    );
  }

  // Atomic conditional update: must still belong to seller and be in DRAFT status
  const updateResult = await prisma.channel.updateMany({
    where: {
      id: channelId,
      sellerId,
      status: 'DRAFT',
    },
    data: {
      status: 'PENDING_REVIEW',
      isPublished: false,
    },
  });

  if (updateResult.count === 0) {
    throw new ChannelValidationError(
      'Failed to submit channel for review: listing is not in DRAFT status or has been modified concurrently.'
    );
  }

  const updated = await prisma.channel.findFirst({
    where: {
      id: channelId,
      sellerId,
    },
  });

  return updated!;
}

/**
 * Unpublishes a seller's published channel listing.
 * - Enforces seller ownership.
 * - Permits unpublishing only for currently published listings (isPublished: true, status: AVAILABLE).
 * - Refuses unpublishing if listing is sold or under contract.
 * - Transitions status to DELISTED and isPublished: false atomically.
 * - Never publishes or approves a listing.
 */
export async function unpublishSellerChannel(
  sellerId: string,
  channelId: string
): Promise<Channel> {
  if (!sellerId || typeof sellerId !== 'string' || sellerId.trim() === '') {
    throw new ChannelValidationError('Seller ID is required');
  }
  if (!channelId || typeof channelId !== 'string' || channelId.trim() === '') {
    throw new ChannelValidationError('Channel ID is required');
  }

  const existing = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!existing) {
    throw new ChannelNotFoundError('Channel not found');
  }

  if (existing.sellerId !== sellerId) {
    throw new ChannelForbiddenError('Forbidden: You do not have permission to unpublish this channel');
  }

  if (existing.status === 'UNDER_CONTRACT' || existing.status === 'SOLD') {
    throw new ChannelValidationError('Cannot unpublish a channel that is under contract or sold.');
  }

  if (!existing.isPublished || existing.status !== 'AVAILABLE') {
    throw new ChannelValidationError('Cannot unpublish a channel that is not currently published.');
  }

  // Atomic conditional update: must still belong to seller, be published, and be AVAILABLE
  const updateResult = await prisma.channel.updateMany({
    where: {
      id: channelId,
      sellerId,
      isPublished: true,
      status: 'AVAILABLE',
    },
    data: {
      status: 'DELISTED',
      isPublished: false,
    },
  });

  if (updateResult.count === 0) {
    throw new ChannelValidationError(
      'Failed to unpublish channel: listing is not currently published or has been modified concurrently.'
    );
  }

  const updated = await prisma.channel.findFirst({
    where: {
      id: channelId,
      sellerId,
    },
  });

  return updated!;
}

/**
 * Deletes a seller's channel listing.
 * - Enforces seller ownership.
 * - Refuses deletion if the listing is published (must be unpublished first).
 * - Employs atomic conditional deletion to prevent race conditions.
 */
export async function deleteSellerChannel(
  sellerId: string,
  channelId: string
): Promise<DeleteChannelResult> {
  if (!sellerId || typeof sellerId !== 'string' || sellerId.trim() === '') {
    throw new ChannelValidationError('Seller ID is required');
  }
  if (!channelId || typeof channelId !== 'string' || channelId.trim() === '') {
    throw new ChannelValidationError('Channel ID is required');
  }

  const existing = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!existing) {
    throw new ChannelNotFoundError('Channel not found');
  }

  if (existing.sellerId !== sellerId) {
    throw new ChannelForbiddenError('Forbidden: You do not have permission to delete this channel');
  }

  if (existing.isPublished) {
    throw new ChannelValidationError(
      'Cannot delete a published channel. The listing must be unpublished before deletion.'
    );
  }

  // Atomic conditional delete enforcing id, sellerId, and isPublished: false
  const result = await prisma.channel.deleteMany({
    where: {
      id: channelId,
      sellerId,
      isPublished: false,
    },
  });

  if (result.count === 0) {
    throw new ChannelValidationError(
      'Failed to delete channel: listing may have been modified or published concurrently.'
    );
  }

  return { success: true, id: channelId };
}


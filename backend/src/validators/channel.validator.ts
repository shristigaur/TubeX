import { z } from 'zod';

/**
 * Standard YouTube handle regex:
 * Exactly '@' prefix followed by 3-30 letters, numbers, periods, dashes, or underscores.
 */
const YOUTUBE_HANDLE_REGEX = /^@[a-zA-Z0-9._-]{3,30}$/;

/**
 * Canonical mapping of frontend filter slugs to database display labels.
 */
export const NICHE_LABEL_MAP: Record<string, string> = {
  tech: 'Technology & Gadgets',
  finance: 'Finance & Investing',
  gaming: 'Gaming & Esports',
  lifestyle: 'Lifestyle & Architecture',
  education: 'Education & Science',
  fitness: 'Health & Fitness',
  'Technology & Gadgets': 'Technology & Gadgets',
  'Finance & Investing': 'Finance & Investing',
  'Gaming & Esports': 'Gaming & Esports',
  'Lifestyle & Architecture': 'Lifestyle & Architecture',
  'Education & Science': 'Education & Science',
  'Health & Fitness': 'Health & Fitness',
};

export const ALLOWED_NICHES = [
  'Technology & Gadgets',
  'Finance & Investing',
  'Gaming & Esports',
  'Lifestyle & Architecture',
  'Education & Science',
  'Health & Fitness',
] as const;

export type NicheCategory = (typeof ALLOWED_NICHES)[number];

export const ALLOWED_SUBSCRIBER_RANGES = [
  'all',
  '10k-50k',
  '50k-100k',
  '100k-500k',
  '500k+',
] as const;

export type SubscriberRangeKey = (typeof ALLOWED_SUBSCRIBER_RANGES)[number];

export const ALLOWED_BUDGET_RANGES = [
  'all',
  'under-5k',
  '5k-15k',
  '15k-30k',
  '30k+',
] as const;

export type BudgetRangeKey = (typeof ALLOWED_BUDGET_RANGES)[number];

export const ALLOWED_SORT_OPTIONS = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'subscribers_desc',
  'subscribers_asc',
] as const;

export type SortOption = (typeof ALLOWED_SORT_OPTIONS)[number];

/**
 * Mutually exclusive budget range definitions with exact dollar and cent thresholds.
 * - under-5k: [0, 5000)
 * - 5k-15k:   [5000, 15000)
 * - 15k-30k:  [15000, 30000)
 * - 30k+:     [30000, infinity)
 */
export const BUDGET_RANGES = {
  'under-5k': { minUsd: 0, maxUsd: 5000, minCents: 0, maxCents: 500000 },
  '5k-15k': { minUsd: 5000, maxUsd: 15000, minCents: 500000, maxCents: 1500000 },
  '15k-30k': { minUsd: 15000, maxUsd: 30000, minCents: 1500000, maxCents: 3000000 },
  '30k+': { minUsd: 30000, maxUsd: undefined, minCents: 3000000, maxCents: undefined },
} as const;

/**
 * Subscriber count range definitions.
 */
export const SUBSCRIBER_RANGES = {
  '10k-50k': { min: 10000, max: 50000 },
  '50k-100k': { min: 50000, max: 100000 },
  '100k-500k': { min: 100000, max: 500000 },
  '500k+': { min: 500000, max: undefined },
} as const;

/**
 * Validates that a numeric amount does not exceed two decimal places (cents precision)
 * and is a finite, non-negative number.
 */
export function isValidUsdPrecision(val: number): boolean {
  if (!Number.isFinite(val) || val < 0) return false;
  const str = val.toString();
  if (str.includes('e') || str.includes('E')) return false;
  if (str.includes('.')) {
    const parts = str.split('.');
    if (parts[1] && parts[1].length > 2) return false;
  }
  return Math.abs(Math.round(val * 100) - val * 100) < 1e-6;
}

/**
 * Safely converts a validated USD amount into integer cents.
 * Throws if the amount is negative, infinite, or has more than 2 decimal places.
 */
export function usdToCents(amountUsd: number): number {
  if (!Number.isFinite(amountUsd) || amountUsd < 0) {
    throw new Error('USD amount must be a finite, non-negative number');
  }
  if (!isValidUsdPrecision(amountUsd)) {
    throw new Error('USD amount cannot have more than 2 decimal places');
  }
  const cents = Math.round(amountUsd * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new Error('USD amount exceeds safe integer range');
  }
  return cents;
}

/**
 * Converts integer cents back to USD dollar representation.
 */
export function centsToUsd(cents: number): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error('Cents must be a non-negative integer');
  }
  return cents / 100;
}

/**
 * Reusable YouTube handle preprocessor and schema:
 * Trims whitespace, prepends '@' if omitted, converts to lowercase,
 * and validates 3-30 character handle format.
 */
const handleSchema = z.preprocess((val) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (!trimmed) return trimmed;
  const withAt = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  return withAt.toLowerCase();
}, z.string().regex(YOUTUBE_HANDLE_REGEX, 'Invalid YouTube handle format. Must be @ followed by 3-30 letters, numbers, periods, dashes, or underscores.'));

/**
 * Base non-null YouTube URL schema with protocol and hostname validation.
 */
const youtubeUrlBaseSchema = z
  .string()
  .trim()
  .url('Invalid YouTube URL')
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return (
        (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
        (parsed.hostname === 'youtube.com' ||
          parsed.hostname === 'www.youtube.com' ||
          parsed.hostname === 'm.youtube.com' ||
          parsed.hostname === 'youtu.be')
      );
    } catch {
      return false;
    }
  }, 'YouTube URL must be a valid link using http or https (e.g. https://www.youtube.com/@channel)');

/**
 * Reusable optional YouTube URL schema for creation.
 */
const youtubeUrlSchema = youtubeUrlBaseSchema.optional();

/**
 * Reusable niche category preprocessor and schema:
 * Accepts slug or full title and normalizes to canonical display label.
 */
const nicheSchema = z.preprocess(
  (val) => {
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    return NICHE_LABEL_MAP[trimmed] || trimmed;
  },
  z.enum([
    'Technology & Gadgets',
    'Finance & Investing',
    'Gaming & Esports',
    'Lifestyle & Architecture',
    'Education & Science',
    'Health & Fitness',
  ])
);

/**
 * Strict regex for non-negative decimal string with at most two decimal places.
 * Rejects trailing zero expansions beyond cents (e.g. "1.2300", "0.0100")
 * and fractions beyond cents (e.g. "1.234", "14500.999").
 */
export const USD_STRING_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Reusable query price parameter validator that inspects original string representation
 * before numeric coercion to strictly reject extra decimal places or trailing decimals.
 */
const queryPriceSchema = (fieldName: string) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    return val;
  }, z.union([
    z.undefined(),
    z.string().refine((val) => USD_STRING_REGEX.test(val.trim()), {
      message: `${fieldName} must be a valid non-negative price with at most 2 decimal places`,
    }).transform((val) => Number(val.trim())),
    z.number()
      .min(0, `${fieldName} cannot be negative`)
      .max(20_000_000, `${fieldName} exceeds maximum limit ($20,000,000)`)
      .refine(isValidUsdPrecision, `${fieldName} cannot have more than 2 decimal places`),
  ])).pipe(
    z.number()
      .min(0, `${fieldName} cannot be negative`)
      .max(20_000_000, `${fieldName} exceeds maximum limit ($20,000,000)`)
      .optional()
  );

/**
 * Query schema for public channel marketplace listing with filter, pagination, and sorting parameters.
 * Strict: rejects any unknown query parameters.
 */
export const channelQuerySchema = z
  .object({
    niche: z
      .preprocess((val) => {
        if (typeof val !== 'string') return val;
        const trimmed = val.trim();
        if (trimmed === 'all' || trimmed === 'All Niches') return 'all';
        return NICHE_LABEL_MAP[trimmed] || trimmed;
      }, z.enum([
        'all',
        'Technology & Gadgets',
        'Finance & Investing',
        'Gaming & Esports',
        'Lifestyle & Architecture',
        'Education & Science',
        'Health & Fitness',
      ]))
      .optional(),
    subscribers: z
      .enum(['all', '10k-50k', '50k-100k', '100k-500k', '500k+'])
      .optional(),
    budget: z
      .enum(['all', 'under-5k', '5k-15k', '15k-30k', '30k+'])
      .optional(),
    minPrice: queryPriceSchema('minPrice'),
    maxPrice: queryPriceSchema('maxPrice'),
    minSubscribers: z.coerce
      .number()
      .int('minSubscribers must be an integer')
      .min(0, 'minSubscribers cannot be negative')
      .optional(),
    maxSubscribers: z.coerce
      .number()
      .int('maxSubscribers must be an integer')
      .min(0, 'maxSubscribers cannot be negative')
      .optional(),
    page: z.coerce
      .number()
      .int('page must be an integer')
      .min(1, 'page must be at least 1')
      .default(1),
    limit: z.coerce
      .number()
      .int('limit must be an integer')
      .min(1, 'limit must be at least 1')
      .max(50, 'limit cannot exceed 50')
      .default(10),
    sort: z
      .enum([
        'newest',
        'oldest',
        'price_asc',
        'price_desc',
        'subscribers_desc',
        'subscribers_asc',
      ])
      .default('newest'),
  })
  .strict()
  .refine(
    (data) => {
      if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    {
      message: 'minPrice cannot be greater than maxPrice',
      path: ['minPrice'],
    }
  )
  .refine(
    (data) => {
      if (
        data.minSubscribers !== undefined &&
        data.maxSubscribers !== undefined
      ) {
        return data.minSubscribers <= data.maxSubscribers;
      }
      return true;
    },
    {
      message: 'minSubscribers cannot be greater than maxSubscribers',
      path: ['minSubscribers'],
    }
  );

export type ChannelQueryInput = z.infer<typeof channelQuerySchema>;

/**
 * Create schema for authenticated seller channel listing submission.
 * Strict: rejects any unauthorized fields (sellerId, status, isPublished, etc.).
 */
export const createChannelSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Channel name is required')
      .max(100, 'Channel name cannot exceed 100 characters'),
    handle: handleSchema,
    youtubeUrl: youtubeUrlSchema,
    niche: nicheSchema,
    subscribersCount: z
      .number()
      .int('Subscriber count must be an integer')
      .min(0, 'Subscriber count cannot be negative')
      .max(1_000_000_000, 'Subscriber count too large'),
    monthlyViewsCount: z
      .number()
      .int('Monthly views count must be an integer')
      .min(0, 'Monthly views count cannot be negative')
      .max(10_000_000_000, 'Monthly views count too large')
      .optional(),
    monetized: z.boolean().default(false),
    priceUsd: z
      .number()
      .min(0, 'Price cannot be negative')
      .max(20_000_000, 'Price cannot exceed $20,000,000')
      .refine(isValidUsdPrecision, {
        message: 'Price cannot have more than 2 decimal places',
      }),
    description: z
      .string()
      .trim()
      .min(1, 'Description is required')
      .max(5000, 'Description cannot exceed 5000 characters'),
  })
  .strict();

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

/**
 * Update schema for modifying an existing channel listing.
 * Allows partial updates but rejects empty payloads and protected fields.
 */
export const updateChannelSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Channel name is required')
      .max(100, 'Channel name cannot exceed 100 characters')
      .optional(),
    handle: handleSchema.optional(),
    youtubeUrl: youtubeUrlBaseSchema.nullable().optional(),
    niche: nicheSchema.optional(),
    subscribersCount: z
      .number()
      .int('Subscriber count must be an integer')
      .min(0, 'Subscriber count cannot be negative')
      .max(1_000_000_000, 'Subscriber count too large')
      .optional(),
    monthlyViewsCount: z
      .number()
      .int('Monthly views count must be an integer')
      .min(0, 'Monthly views count cannot be negative')
      .max(10_000_000_000, 'Monthly views count too large')
      .nullable()
      .optional(),
    monetized: z.boolean().optional(),
    priceUsd: z
      .number()
      .min(0, 'Price cannot be negative')
      .max(20_000_000, 'Price cannot exceed $20,000,000')
      .refine(isValidUsdPrecision, {
        message: 'Price cannot have more than 2 decimal places',
      })
      .optional(),
    description: z
      .string()
      .trim()
      .min(1, 'Description is required')
      .max(5000, 'Description cannot exceed 5000 characters')
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Update object cannot be empty. At least one field must be provided.',
  });

export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;

/**
 * Strict regex for MongoDB ObjectId: exactly 24 hexadecimal characters.
 */
export const MONGODB_OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Zod schema for validating a MongoDB ObjectId string.
 */
export const objectIdSchema = z
  .string()
  .regex(
    MONGODB_OBJECT_ID_REGEX,
    'Invalid ID format. Must be a 24-character hexadecimal string'
  );

/**
 * Route parameter schema for channel endpoints expecting an :id parameter.
 * Rejects any non-hex or non-24-character parameter before passing to services.
 */
export const channelIdParamSchema = z
  .object({
    id: z
      .string()
      .regex(
        MONGODB_OBJECT_ID_REGEX,
        'Invalid channel ID format. Must be a 24-character hexadecimal string'
      ),
  })
  .strict();

export type ChannelIdParam = z.infer<typeof channelIdParamSchema>;

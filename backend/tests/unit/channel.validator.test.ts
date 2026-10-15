import { describe, it, expect } from 'vitest';
import {
  channelQuerySchema,
  createChannelSchema,
  updateChannelSchema,
  channelIdParamSchema,
  objectIdSchema,
  MONGODB_OBJECT_ID_REGEX,
  usdToCents,
  centsToUsd,
  isValidUsdPrecision,
  BUDGET_RANGES,
  SUBSCRIBER_RANGES,
} from '../../src/validators/channel.validator.js';

describe('Channel Request Validators', () => {
  describe('channelQuerySchema', () => {
    it('should validate and parse valid query parameters with coercion', () => {
      const rawQuery = {
        niche: 'tech',
        subscribers: '10k-50k',
        budget: '5k-15k',
        minPrice: '5000',
        maxPrice: '15000',
        minSubscribers: '10000',
        maxSubscribers: '50000',
        page: '2',
        limit: '25',
        sort: 'price_asc',
      };

      const result = channelQuerySchema.safeParse(rawQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.niche).toBe('Technology & Gadgets');
        expect(result.data.subscribers).toBe('10k-50k');
        expect(result.data.budget).toBe('5k-15k');
        expect(result.data.minPrice).toBe(5000);
        expect(result.data.maxPrice).toBe(15000);
        expect(result.data.minSubscribers).toBe(10000);
        expect(result.data.maxSubscribers).toBe(50000);
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(25);
        expect(result.data.sort).toBe('price_asc');
      }
    });

    it('should provide default values for empty query parameters', () => {
      const result = channelQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
        expect(result.data.sort).toBe('newest');
        expect(result.data.niche).toBeUndefined();
        expect(result.data.subscribers).toBeUndefined();
        expect(result.data.budget).toBeUndefined();
      }
    });

    it('should normalize niche slug to canonical display label and accept "all"', () => {
      const slugResult = channelQuerySchema.safeParse({ niche: 'finance' });
      expect(slugResult.success).toBe(true);
      if (slugResult.success) {
        expect(slugResult.data.niche).toBe('Finance & Investing');
      }

      const allResult = channelQuerySchema.safeParse({ niche: 'all' });
      expect(allResult.success).toBe(true);
      if (allResult.success) {
        expect(allResult.data.niche).toBe('all');
      }

      const labelResult = channelQuerySchema.safeParse({ niche: 'Gaming & Esports' });
      expect(labelResult.success).toBe(true);
      if (labelResult.success) {
        expect(labelResult.data.niche).toBe('Gaming & Esports');
      }
    });

    it('should reject invalid niche filter values', () => {
      const result = channelQuerySchema.safeParse({ niche: 'invalid_category' });
      expect(result.success).toBe(false);
    });

    it('should validate all budget range keys and reject invalid ones', () => {
      const validBudgets = ['all', 'under-5k', '5k-15k', '15k-30k', '30k+'];
      for (const budget of validBudgets) {
        const result = channelQuerySchema.safeParse({ budget });
        expect(result.success).toBe(true);
      }

      const invalidResult = channelQuerySchema.safeParse({ budget: 'invalid-range' });
      expect(invalidResult.success).toBe(false);
    });

    it('should validate all subscriber range keys and reject invalid ones', () => {
      const validRanges = ['all', '10k-50k', '50k-100k', '100k-500k', '500k+'];
      for (const subscribers of validRanges) {
        const result = channelQuerySchema.safeParse({ subscribers });
        expect(result.success).toBe(true);
      }

      const invalidResult = channelQuerySchema.safeParse({ subscribers: 'unknown-subs' });
      expect(invalidResult.success).toBe(false);
    });

    it('should enforce pagination constraints (minimums and maximums)', () => {
      expect(channelQuerySchema.safeParse({ page: 0 }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ page: -1 }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ page: 1.5 }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ page: 'abc' }).success).toBe(false);

      expect(channelQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ limit: -5 }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ limit: 50 }).success).toBe(true);
    });

    it('should reject unknown sort options', () => {
      expect(channelQuerySchema.safeParse({ sort: 'unsupported' }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ sort: 'subscribers_desc' }).success).toBe(true);
    });

    it('should reject minPrice greater than maxPrice', () => {
      const result = channelQuerySchema.safeParse({
        minPrice: 10000,
        maxPrice: 5000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('minPrice cannot be greater than maxPrice');
      }
    });

    it('should reject minSubscribers greater than maxSubscribers', () => {
      const result = channelQuerySchema.safeParse({
        minSubscribers: 50000,
        maxSubscribers: 10000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('minSubscribers cannot be greater than maxSubscribers');
      }
    });

    it('should reject negative minPrice, maxPrice, minSubscribers, and maxSubscribers', () => {
      expect(channelQuerySchema.safeParse({ minPrice: -10 }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ maxPrice: -1 }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ minSubscribers: -100 }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ maxSubscribers: -1 }).success).toBe(false);
    });

    it('should reject prices with more than two decimal places in query parameters, including trailing zeros', () => {
      // String representations with more than 2 decimal places (including trailing zeros)
      expect(channelQuerySchema.safeParse({ minPrice: '1.2300' }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ maxPrice: '0.0100' }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ minPrice: '1.234' }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ maxPrice: '14500.999' }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ minPrice: '10.000' }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ minPrice: '0.001' }).success).toBe(false);

      // Numeric inputs with more than 2 decimal places
      expect(channelQuerySchema.safeParse({ minPrice: 10.999 }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ maxPrice: 50.001 }).success).toBe(false);
      expect(channelQuerySchema.safeParse({ minPrice: 1.234 }).success).toBe(false);
    });

    it('should accept valid USD prices in query parameters (strings and numbers)', () => {
      // String format inputs
      const r1 = channelQuerySchema.safeParse({ minPrice: '1' });
      expect(r1.success).toBe(true);
      if (r1.success) expect(r1.data.minPrice).toBe(1);

      const r2 = channelQuerySchema.safeParse({ minPrice: '1.2' });
      expect(r2.success).toBe(true);
      if (r2.success) expect(r2.data.minPrice).toBe(1.2);

      const r3 = channelQuerySchema.safeParse({ minPrice: '1.23' });
      expect(r3.success).toBe(true);
      if (r3.success) expect(r3.data.minPrice).toBe(1.23);

      const r4 = channelQuerySchema.safeParse({ minPrice: '0.01' });
      expect(r4.success).toBe(true);
      if (r4.success) expect(r4.data.minPrice).toBe(0.01);

      const r5 = channelQuerySchema.safeParse({ minPrice: '14500.99' });
      expect(r5.success).toBe(true);
      if (r5.success) expect(r5.data.minPrice).toBe(14500.99);

      const r6 = channelQuerySchema.safeParse({ minPrice: '0' });
      expect(r6.success).toBe(true);
      if (r6.success) expect(r6.data.minPrice).toBe(0);

      const r7 = channelQuerySchema.safeParse({ minPrice: '0.00' });
      expect(r7.success).toBe(true);
      if (r7.success) expect(r7.data.minPrice).toBe(0);

      // Numeric format inputs
      expect(channelQuerySchema.safeParse({ minPrice: 1 }).success).toBe(true);
      expect(channelQuerySchema.safeParse({ minPrice: 1.2 }).success).toBe(true);
      expect(channelQuerySchema.safeParse({ minPrice: 1.23 }).success).toBe(true);
      expect(channelQuerySchema.safeParse({ minPrice: 0.01 }).success).toBe(true);
      expect(channelQuerySchema.safeParse({ minPrice: 14500.99 }).success).toBe(true);
      expect(channelQuerySchema.safeParse({ minPrice: 0 }).success).toBe(true);
    });

    it('should reject unknown query parameters (strict policy)', () => {
      const result = channelQuerySchema.safeParse({
        page: 1,
        unknownField: 'malicious',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createChannelSchema', () => {
    const validPayload = {
      name: 'Apex Tech Reviews',
      handle: '@apextechreviews',
      youtubeUrl: 'https://www.youtube.com/@apextechreviews',
      niche: 'tech',
      subscribersCount: 245000,
      monthlyViewsCount: 1200000,
      monetized: true,
      priceUsd: 14500,
      description: 'Quality hardware reviews with tier-1 demographics.',
    };

    it('should validate and normalize a complete valid payload', () => {
      const result = createChannelSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Apex Tech Reviews');
        expect(result.data.handle).toBe('@apextechreviews');
        expect(result.data.niche).toBe('Technology & Gadgets');
        expect(result.data.subscribersCount).toBe(245000);
        expect(result.data.monthlyViewsCount).toBe(1200000);
        expect(result.data.monetized).toBe(true);
        expect(result.data.priceUsd).toBe(14500);
        expect(result.data.description).toBe('Quality hardware reviews with tier-1 demographics.');
      }
    });

    it('should allow optional fields to be omitted', () => {
      const minimalPayload = {
        name: 'Simple Channel',
        handle: 'simplechannel',
        niche: 'Finance & Investing',
        subscribersCount: 50000,
        priceUsd: 5000,
        description: 'Personal finance breakdowns.',
      };

      const result = createChannelSchema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.handle).toBe('@simplechannel');
        expect(result.data.monetized).toBe(false);
        expect(result.data.youtubeUrl).toBeUndefined();
        expect(result.data.monthlyViewsCount).toBeUndefined();
      }
    });

    it('should normalize YouTube handle with missing "@" and whitespace and lowercase it', () => {
      const payload = {
        ...validPayload,
        handle: '  ApexTechReviews  ',
      };
      const result = createChannelSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.handle).toBe('@apextechreviews');
      }
    });

    it('should reject invalid YouTube handles', () => {
      expect(createChannelSchema.safeParse({ ...validPayload, handle: '@a' }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, handle: '@invalid with spaces' }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, handle: '' }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, handle: '@' + 'a'.repeat(35) }).success).toBe(false);
    });

    it('should validate YouTube URL formats and reject non-YouTube or malformed URLs', () => {
      expect(
        createChannelSchema.safeParse({
          ...validPayload,
          youtubeUrl: 'https://youtube.com/@channel',
        }).success
      ).toBe(true);

      expect(
        createChannelSchema.safeParse({
          ...validPayload,
          youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
        }).success
      ).toBe(true);

      expect(
        createChannelSchema.safeParse({
          ...validPayload,
          youtubeUrl: 'not-a-valid-url',
        }).success
      ).toBe(false);

      expect(
        createChannelSchema.safeParse({
          ...validPayload,
          youtubeUrl: 'https://vimeo.com/12345',
        }).success
      ).toBe(false);

      expect(
        createChannelSchema.safeParse({
          ...validPayload,
          youtubeUrl: 'ftp://youtube.com/@channel',
        }).success
      ).toBe(false);
    });

    it('should accept valid USD prices with 0, 1, or 2 decimal places', () => {
      // 1, 1.2, 1.23, 0.01, 14500.99, 0
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 1 }).success).toBe(true);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 1.2 }).success).toBe(true);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 1.23 }).success).toBe(true);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 0.01 }).success).toBe(true);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 14500.99 }).success).toBe(true);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 0 }).success).toBe(true);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 14500 }).success).toBe(true);
    });

    it('should reject negative prices and prices exceeding 2 decimal places in JSON body', () => {
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: -1 }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: -0.01 }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 1.234 }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 14500.999 }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 14500.001 }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 0.001 }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: 25_000_000 }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: Infinity }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, priceUsd: NaN }).success).toBe(false);
    });

    it('should reject negative and fractional subscriber and view counts', () => {
      expect(createChannelSchema.safeParse({ ...validPayload, subscribersCount: -1 }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, subscribersCount: 100.5 }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, monthlyViewsCount: -100 }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, monthlyViewsCount: 50.2 }).success).toBe(false);
    });

    it('should reject empty or whitespace-only name and description', () => {
      expect(createChannelSchema.safeParse({ ...validPayload, name: '   ' }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, name: '' }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, description: '   ' }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, description: '' }).success).toBe(false);
    });

    it('should reject names exceeding 100 characters and descriptions exceeding 5000 characters', () => {
      expect(createChannelSchema.safeParse({ ...validPayload, name: 'a'.repeat(101) }).success).toBe(false);
      expect(createChannelSchema.safeParse({ ...validPayload, description: 'a'.repeat(5001) }).success).toBe(false);
    });

    it('should reject submission of protected fields (sellerId, status, isPublished, etc.)', () => {
      const protectedAttacks = [
        { sellerId: '507f1f77bcf86cd799439011' },
        { status: 'AVAILABLE' },
        { isPublished: true },
        { verifiedAnalytics: true },
        { priceCents: 1450000 },
        { featuredBadge: 'Trending' },
        { id: '507f1f77bcf86cd799439012' },
        { _id: '507f1f77bcf86cd799439012' },
        { createdAt: new Date() },
        { role: 'ADMIN' },
      ];

      for (const field of protectedAttacks) {
        const payload = { ...validPayload, ...field };
        const result = createChannelSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });

    it('should reject unknown extra body fields', () => {
      const payload = { ...validPayload, unexpectedField: 'badData' };
      const result = createChannelSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('updateChannelSchema', () => {
    it('should accept valid partial updates', () => {
      expect(updateChannelSchema.safeParse({ name: 'Updated Channel Name' }).success).toBe(true);
      expect(updateChannelSchema.safeParse({ priceUsd: 19999.99 }).success).toBe(true);
      expect(updateChannelSchema.safeParse({ subscribersCount: 300000 }).success).toBe(true);
      expect(updateChannelSchema.safeParse({ monetized: false }).success).toBe(true);
      expect(updateChannelSchema.safeParse({ handle: '@newhandle' }).success).toBe(true);
    });

    it('should reject an empty update object', () => {
      const result = updateChannelSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Update object cannot be empty');
      }
    });

    it('should reject protected fields in update payload', () => {
      expect(updateChannelSchema.safeParse({ name: 'Valid', sellerId: '507f1f77bcf86cd799439011' }).success).toBe(false);
      expect(updateChannelSchema.safeParse({ status: 'AVAILABLE' }).success).toBe(false);
      expect(updateChannelSchema.safeParse({ isPublished: true }).success).toBe(false);
      expect(updateChannelSchema.safeParse({ priceCents: 50000 }).success).toBe(false);
      expect(updateChannelSchema.safeParse({ verifiedAnalytics: true }).success).toBe(false);
      expect(updateChannelSchema.safeParse({ featuredBadge: 'Top Seller' }).success).toBe(false);
    });

    it('should reject invalid values in partial updates', () => {
      expect(updateChannelSchema.safeParse({ priceUsd: -500 }).success).toBe(false);
      expect(updateChannelSchema.safeParse({ priceUsd: 500.123 }).success).toBe(false);
      expect(updateChannelSchema.safeParse({ subscribersCount: -1 }).success).toBe(false);
      expect(updateChannelSchema.safeParse({ handle: 'invalid with spaces' }).success).toBe(false);
      expect(updateChannelSchema.safeParse({ youtubeUrl: 'ftp://bad' }).success).toBe(false);
    });
  });

  describe('usdToCents and centsToUsd utilities', () => {
    it('should safely convert valid USD amounts to integer cents', () => {
      expect(usdToCents(1)).toBe(100);
      expect(usdToCents(1.2)).toBe(120);
      expect(usdToCents(1.23)).toBe(123);
      expect(usdToCents(0.01)).toBe(1);
      expect(usdToCents(14500.99)).toBe(1450099);
      expect(usdToCents(14500)).toBe(1450000);
      expect(usdToCents(14500.5)).toBe(1450050);
      expect(usdToCents(0)).toBe(0);
      expect(usdToCents(22000.75)).toBe(2200075);
    });

    it('should throw error when converting invalid USD amounts to cents', () => {
      expect(() => usdToCents(-10)).toThrow('USD amount must be a finite, non-negative number');
      expect(() => usdToCents(-0.01)).toThrow('USD amount must be a finite, non-negative number');
      expect(() => usdToCents(1.234)).toThrow('USD amount cannot have more than 2 decimal places');
      expect(() => usdToCents(14500.999)).toThrow('USD amount cannot have more than 2 decimal places');
      expect(() => usdToCents(14500.001)).toThrow('USD amount cannot have more than 2 decimal places');
      expect(() => usdToCents(0.001)).toThrow('USD amount cannot have more than 2 decimal places');
      expect(() => usdToCents(Infinity)).toThrow('USD amount must be a finite, non-negative number');
      expect(() => usdToCents(-Infinity)).toThrow('USD amount must be a finite, non-negative number');
      expect(() => usdToCents(NaN)).toThrow('USD amount must be a finite, non-negative number');
    });

    it('should safely convert integer cents back to USD dollars', () => {
      expect(centsToUsd(1450000)).toBe(14500);
      expect(centsToUsd(1450050)).toBe(14500.5);
      expect(centsToUsd(1450099)).toBe(14500.99);
      expect(centsToUsd(1)).toBe(0.01);
      expect(centsToUsd(0)).toBe(0);
    });

    it('should throw error when centsToUsd receives invalid cents input', () => {
      expect(() => centsToUsd(-100)).toThrow('Cents must be a non-negative integer');
      expect(() => centsToUsd(100.5)).toThrow('Cents must be a non-negative integer');
    });
  });

  describe('Budget and Subscriber Range Constants', () => {
    it('should define mutually exclusive budget ranges without overlap or gaps', () => {
      expect(BUDGET_RANGES['under-5k'].minCents).toBe(0);
      expect(BUDGET_RANGES['under-5k'].maxCents).toBe(500000);

      expect(BUDGET_RANGES['5k-15k'].minCents).toBe(500000);
      expect(BUDGET_RANGES['5k-15k'].maxCents).toBe(1500000);

      expect(BUDGET_RANGES['15k-30k'].minCents).toBe(1500000);
      expect(BUDGET_RANGES['15k-30k'].maxCents).toBe(3000000);

      expect(BUDGET_RANGES['30k+'].minCents).toBe(3000000);
      expect(BUDGET_RANGES['30k+'].maxCents).toBeUndefined();
    });

    it('should define subscriber ranges matching frontend values', () => {
      expect(SUBSCRIBER_RANGES['10k-50k'].min).toBe(10000);
      expect(SUBSCRIBER_RANGES['10k-50k'].max).toBe(50000);

      expect(SUBSCRIBER_RANGES['50k-100k'].min).toBe(50000);
      expect(SUBSCRIBER_RANGES['50k-100k'].max).toBe(100000);

      expect(SUBSCRIBER_RANGES['100k-500k'].min).toBe(100000);
      expect(SUBSCRIBER_RANGES['100k-500k'].max).toBe(500000);

      expect(SUBSCRIBER_RANGES['500k+'].min).toBe(500000);
      expect(SUBSCRIBER_RANGES['500k+'].max).toBeUndefined();
    });
  });

  describe('channelIdParamSchema and objectIdSchema', () => {
    it('should validate exactly 24-character hexadecimal MongoDB ObjectIds', () => {
      const validIds = [
        '670c5e7b8f1a2b3c4d5e6f7a',
        '507f1f77bcf86cd799439011',
        '000000000000000000000000',
        'FFFFFFFFFFFFFFFFFFFFFFFF',
        '670C5E7B8F1A2B3C4D5E6F7A',
      ];

      for (const id of validIds) {
        const result = channelIdParamSchema.safeParse({ id });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(id);
        }
      }
    });

    it('should reject malformed, non-hex, or incorrect length IDs with established error', () => {
      const invalidIds = [
        '123',
        'not-an-id',
        '',
        '670c5e7b8f1a2b3c4d5e6f7', // 23 chars
        '670c5e7b8f1a2b3c4d5e6f7aa', // 25 chars
        '670c5e7b8f1a2b3c4d5e6f7g', // non-hex 'g'
        ' 670c5e7b8f1a2b3c4d5e6f7a', // leading space
        '670c5e7b8f1a2b3c4d5e6f7a ', // trailing space
        '670c5e7b-8f1a-2b3c-4d5e-6f7a', // uuid with dashes
      ];

      for (const id of invalidIds) {
        const result = channelIdParamSchema.safeParse({ id });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toMatch(/Invalid channel ID format/);
        }
      }
    });

    it('should reject missing id or non-string id', () => {
      expect(channelIdParamSchema.safeParse({}).success).toBe(false);
      expect(channelIdParamSchema.safeParse({ id: 12345 }).success).toBe(false);
      expect(channelIdParamSchema.safeParse({ id: null }).success).toBe(false);
      expect(channelIdParamSchema.safeParse({ id: undefined }).success).toBe(false);
    });

    it('should reject extra unknown properties due to strict mode', () => {
      const result = channelIdParamSchema.safeParse({
        id: '670c5e7b8f1a2b3c4d5e6f7a',
        extra: 'not-allowed',
      });
      expect(result.success).toBe(false);
    });

    it('should validate standalone objectIdSchema directly', () => {
      expect(objectIdSchema.safeParse('670c5e7b8f1a2b3c4d5e6f7a').success).toBe(true);
      expect(objectIdSchema.safeParse('123').success).toBe(false);
      expect(objectIdSchema.safeParse('not-an-id').success).toBe(false);
    });
  });
});

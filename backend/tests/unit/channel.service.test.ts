import { vi } from 'vitest';
import { registerTestPrismaClient } from '../../src/config/prisma.js';

// Setup fail-closed test PrismaClient mock before importing application modules
export const mockChannelFindMany = vi.fn();
export const mockChannelCount = vi.fn();
export const mockChannelFindFirst = vi.fn();
export const mockChannelFindUnique = vi.fn();
export const mockChannelCreate = vi.fn();
export const mockChannelUpdate = vi.fn();
export const mockChannelUpdateMany = vi.fn();
export const mockChannelDeleteMany = vi.fn();

const mockPrisma = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn(),
  channel: {
    findMany: mockChannelFindMany,
    count: mockChannelCount,
    findFirst: mockChannelFindFirst,
    findUnique: mockChannelFindUnique,
    create: mockChannelCreate,
    update: mockChannelUpdate,
    updateMany: mockChannelUpdateMany,
    deleteMany: mockChannelDeleteMany,
  },
};

registerTestPrismaClient(mockPrisma as any);

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPublicChannels,
  getPublicChannelById,
  createChannelListing,
  getSellerChannels,
  getSellerChannelById,
  updateSellerChannel,
  submitChannelForReview,
  unpublishSellerChannel,
  deleteSellerChannel,
  formatCount,
  mapToPublicChannelDto,
  PUBLIC_CHANNEL_SELECT,
  ChannelValidationError,
  ChannelNotFoundError,
  ChannelForbiddenError,
} from '../../src/services/channel.service.js';

describe('Channel Service - getPublicChannels', () => {
  const baseMockChannel = {
    id: '670c5e7b8f1a2b3c4d5e6f7a',
    name: 'Apex Tech Reviews',
    handle: '@apextechreviews',
    youtubeUrl: 'https://youtube.com/@apextechreviews',
    niche: 'Technology & Gadgets',
    subscribersCount: 245000,
    monthlyViewsCount: 1200000,
    monetized: true,
    verifiedAnalytics: true,
    priceCents: 1450000,
    description: 'Hardware reviews and consumer tech guides.',
    featuredBadge: 'High Engagement',
    status: 'AVAILABLE',
    isPublished: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    seller: {
      id: '507f1f77bcf86cd799439011',
      name: 'Tech Seller',
    },
  };

  beforeEach(() => {
    mockChannelFindMany.mockReset();
    mockChannelCount.mockReset();
    mockChannelFindFirst.mockReset();
    mockChannelFindMany.mockResolvedValue([baseMockChannel]);
    mockChannelCount.mockResolvedValue(1);
    mockChannelFindFirst.mockResolvedValue(baseMockChannel);
  });

  describe('1. Public visibility constraints', () => {
    it('should always enforce isPublished: true and status: AVAILABLE', async () => {
      await getPublicChannels({});

      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublished: true,
            status: 'AVAILABLE',
          }),
        })
      );
      expect(mockChannelCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublished: true,
            status: 'AVAILABLE',
          }),
        })
      );
    });

    it('should keep public visibility constraints when other filters are applied', async () => {
      await getPublicChannels({ niche: 'tech', budget: 'under-5k' });

      const findManyCall = mockChannelFindMany.mock.calls[0][0];
      expect(findManyCall.where.isPublished).toBe(true);
      expect(findManyCall.where.status).toBe('AVAILABLE');
      expect(findManyCall.where.niche).toBe('Technology & Gadgets');
      expect(findManyCall.where.priceCents).toEqual({ lt: 500000 });
    });
  });

  describe('2. Niche and subscriber filters', () => {
    it('should map niche slug to canonical title', async () => {
      await getPublicChannels({ niche: 'gaming' });

      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            niche: 'Gaming & Esports',
          }),
        })
      );
    });

    it('should accept canonical niche title directly', async () => {
      await getPublicChannels({ niche: 'Finance & Investing' });

      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            niche: 'Finance & Investing',
          }),
        })
      );
    });

    it('should not add niche filter when niche is "all"', async () => {
      await getPublicChannels({ niche: 'all' });

      const findManyCall = mockChannelFindMany.mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty('niche');
    });

    it('should handle preset subscriber range filters', async () => {
      await getPublicChannels({ subscribers: '10k-50k' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscribersCount: { gte: 10000, lte: 50000 },
          }),
        })
      );

      mockChannelFindMany.mockClear();
      await getPublicChannels({ subscribers: '500k+' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscribersCount: { gte: 500000 },
          }),
        })
      );
    });

    it('should handle custom minSubscribers and maxSubscribers', async () => {
      await getPublicChannels({ minSubscribers: 25000, maxSubscribers: 80000 });

      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscribersCount: { gte: 25000, lte: 80000 },
          }),
        })
      );
    });

    it('should combine preset subscriber range with custom bounds taking strictest intersection', async () => {
      // 10k-50k preset with minSubscribers 20000 and maxSubscribers 40000
      await getPublicChannels({
        subscribers: '10k-50k',
        minSubscribers: 20000,
        maxSubscribers: 40000,
      });

      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscribersCount: { gte: 20000, lte: 40000 },
          }),
        })
      );
    });
  });

  describe('3. Budget and custom price bounds', () => {
    it('should handle preset budget ranges alone', async () => {
      // under-5k: [0, 5000) -> < 500,000 cents
      await getPublicChannels({ budget: 'under-5k' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priceCents: { lt: 500000 },
          }),
        })
      );

      mockChannelFindMany.mockClear();
      // 5k-15k: [5000, 15000) -> >= 500,000 and < 1,500,000 cents
      await getPublicChannels({ budget: '5k-15k' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priceCents: { gte: 500000, lt: 1500000 },
          }),
        })
      );

      mockChannelFindMany.mockClear();
      // 15k-30k: [15000, 30000) -> >= 1,500,000 and < 3,000,000 cents
      await getPublicChannels({ budget: '15k-30k' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priceCents: { gte: 1500000, lt: 3000000 },
          }),
        })
      );

      mockChannelFindMany.mockClear();
      // 30k+: [30000, infinity) -> >= 3,000,000 cents
      await getPublicChannels({ budget: '30k+' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priceCents: { gte: 3000000 },
          }),
        })
      );
    });

    it('should safely convert custom USD prices to integer cents', async () => {
      await getPublicChannels({ minPrice: 120.5, maxPrice: 999.99 });

      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priceCents: { gte: 12050, lte: 99999 },
          }),
        })
      );
    });

    it('should combine preset budget and custom price bounds using strictest constraints', async () => {
      // 5k-15k (500000..1500000 cents) combined with minPrice 8000 (800000 cents)
      await getPublicChannels({ budget: '5k-15k', minPrice: 8000 });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priceCents: { gte: 800000, lt: 1500000 },
          }),
        })
      );

      mockChannelFindMany.mockClear();
      // 5k-15k combined with maxPrice 12000 (1200000 cents) -> custom max (1200000) is stricter than budget max (1500000)
      await getPublicChannels({ budget: '5k-15k', maxPrice: 12000 });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priceCents: { gte: 500000, lte: 1200000 },
          }),
        })
      );

      mockChannelFindMany.mockClear();
      // 5k-15k combined with maxPrice 20000 (2000000 cents) -> budget max (1500000) is stricter than custom max
      await getPublicChannels({ budget: '5k-15k', maxPrice: 20000 });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priceCents: { gte: 500000, lt: 1500000 },
          }),
        })
      );
    });
  });

  describe('4. Invalid price and subscriber ranges', () => {
    it('should reject when minPrice exceeds maxPrice', async () => {
      await expect(
        getPublicChannels({ minPrice: 1000, maxPrice: 500 })
      ).rejects.toThrow(ChannelValidationError);
    });

    it('should reject when minSubscribers exceeds maxSubscribers', async () => {
      await expect(
        getPublicChannels({ minSubscribers: 100000, maxSubscribers: 50000 })
      ).rejects.toThrow(ChannelValidationError);
    });

    it('should reject conflicting budget and custom minPrice', async () => {
      // under-5k (< $5,000) with minPrice $6,000
      await expect(
        getPublicChannels({ budget: 'under-5k', minPrice: 6000 })
      ).rejects.toThrow(ChannelValidationError);

      // under-5k (< $5,000) with minPrice $5,000 (equal to exclusive threshold)
      await expect(
        getPublicChannels({ budget: 'under-5k', minPrice: 5000 })
      ).rejects.toThrow(ChannelValidationError);
    });

    it('should reject conflicting budget and custom maxPrice', async () => {
      // 5k-15k (>= $5,000) with maxPrice $4,000
      await expect(
        getPublicChannels({ budget: '5k-15k', maxPrice: 4000 })
      ).rejects.toThrow(ChannelValidationError);

      // 30k+ (>= $30,000) with maxPrice $25,000
      await expect(
        getPublicChannels({ budget: '30k+', maxPrice: 25000 })
      ).rejects.toThrow(ChannelValidationError);
    });

    it('should reject conflicting preset subscribers and custom bounds', async () => {
      // 10k-50k with minSubscribers 60000
      await expect(
        getPublicChannels({ subscribers: '10k-50k', minSubscribers: 60000 })
      ).rejects.toThrow(ChannelValidationError);

      // 500k+ with maxSubscribers 400000
      await expect(
        getPublicChannels({ subscribers: '500k+', maxSubscribers: 400000 })
      ).rejects.toThrow(ChannelValidationError);
    });
  });

  describe('5. Sorting modes and deterministic tie-breaker', () => {
    it('should sort by newest with id: desc tie-breaker', async () => {
      await getPublicChannels({ sort: 'newest' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      );
    });

    it('should sort by oldest with id: desc tie-breaker', async () => {
      await getPublicChannels({ sort: 'oldest' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'asc' }, { id: 'desc' }],
        })
      );
    });

    it('should sort by price_asc with id: desc tie-breaker', async () => {
      await getPublicChannels({ sort: 'price_asc' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priceCents: 'asc' }, { id: 'desc' }],
        })
      );
    });

    it('should sort by price_desc with id: desc tie-breaker', async () => {
      await getPublicChannels({ sort: 'price_desc' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priceCents: 'desc' }, { id: 'desc' }],
        })
      );
    });

    it('should sort by subscribers_desc with id: desc tie-breaker', async () => {
      await getPublicChannels({ sort: 'subscribers_desc' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ subscribersCount: 'desc' }, { id: 'desc' }],
        })
      );
    });

    it('should sort by subscribers_asc with id: desc tie-breaker', async () => {
      await getPublicChannels({ sort: 'subscribers_asc' });
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ subscribersCount: 'asc' }, { id: 'desc' }],
        })
      );
    });

    it('should default to newest when sort option is undefined', async () => {
      await getPublicChannels({});
      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      );
    });
  });

  describe('6. Pagination defaults, offsets, and maximum limit', () => {
    it('should default to page 1 and limit 10', async () => {
      await getPublicChannels({});

      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        })
      );
    });

    it('should calculate skip offset correctly for subsequent pages', async () => {
      await getPublicChannels({ page: 3, limit: 15 });

      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 30,
          take: 15,
        })
      );
    });

    it('should clamp limit to maximum of 50', async () => {
      await getPublicChannels({ page: 1, limit: 100 } as any);

      expect(mockChannelFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it('should compute pagination metadata correctly', async () => {
      mockChannelCount.mockResolvedValue(45);

      const result = await getPublicChannels({ page: 2, limit: 10 });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 45,
        totalPages: 5,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });

    it('should handle last page pagination flags', async () => {
      mockChannelCount.mockResolvedValue(20);

      const result = await getPublicChannels({ page: 2, limit: 10 });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 20,
        totalPages: 2,
        hasNextPage: false,
        hasPrevPage: true,
      });
    });
  });

  describe('7. Seller projection and private user field exclusion', () => {
    it('should use explicit Prisma select projection without private user fields', async () => {
      await getPublicChannels({});

      const select = mockChannelFindMany.mock.calls[0][0].select;
      expect(select).toBeDefined();
      expect(select.seller).toEqual({
        select: {
          id: true,
          name: true,
        },
      });

      // Confirm sensitive User fields are never in select
      expect(select.seller.select).not.toHaveProperty('passwordHash');
      expect(select.seller.select).not.toHaveProperty('email');
      expect(select.seller.select).not.toHaveProperty('googleId');
    });

    it('should verify PUBLIC_CHANNEL_SELECT projection definition', () => {
      expect(PUBLIC_CHANNEL_SELECT.seller.select).toEqual({
        id: true,
        name: true,
      });
      expect(PUBLIC_CHANNEL_SELECT.seller.select).not.toHaveProperty('passwordHash');
      expect(PUBLIC_CHANNEL_SELECT.seller.select).not.toHaveProperty('email');
      expect(PUBLIC_CHANNEL_SELECT.seller.select).not.toHaveProperty('googleId');
    });

    it('should ensure DTO seller output only contains id and name even if DB object has extra fields', () => {
      const channelWithExtraSellerFields = {
        ...baseMockChannel,
        seller: {
          id: '507f1f77bcf86cd799439011',
          name: 'Tech Seller',
          email: 'leak@example.com',
          passwordHash: 'hash-leak',
          googleId: 'google-leak',
        },
      };

      const dto = mapToPublicChannelDto(channelWithExtraSellerFields);
      expect(dto.seller).toEqual({
        id: '507f1f77bcf86cd799439011',
        name: 'Tech Seller',
      });
      expect(dto.seller).not.toHaveProperty('email');
      expect(dto.seller).not.toHaveProperty('passwordHash');
      expect(dto.seller).not.toHaveProperty('googleId');
    });
  });

  describe('8. Price conversion and count formatting boundaries', () => {
    it('should accurately convert priceCents to priceUsd and preserve priceCents', async () => {
      const result = await getPublicChannels({});

      expect(result.channels[0].priceCents).toBe(1450000);
      expect(result.channels[0].priceUsd).toBe(14500);
    });

    it('should format metric counts across various boundaries', () => {
      expect(formatCount(0)).toBe('0');
      expect(formatCount(950)).toBe('950');
      expect(formatCount(1000)).toBe('1K');
      expect(formatCount(1500)).toBe('1.5K');
      expect(formatCount(245000)).toBe('245K');
      expect(formatCount(1000000)).toBe('1M');
      expect(formatCount(1200000)).toBe('1.2M');
      expect(formatCount(3400000)).toBe('3.4M');
      expect(formatCount(1000000000)).toBe('1B');
      expect(formatCount(2500000000)).toBe('2.5B');
    });

    it('should safely return null for invalid, negative, or undefined counts', () => {
      expect(formatCount(null)).toBeNull();
      expect(formatCount(undefined)).toBeNull();
      expect(formatCount(-10)).toBeNull();
      expect(formatCount(NaN)).toBeNull();
      expect(formatCount(Infinity)).toBeNull();
    });
  });

  describe('9. Null and optional monthly views', () => {
    it('should handle null monthlyViewsCount safely in DTO', async () => {
      mockChannelFindMany.mockResolvedValue([
        {
          ...baseMockChannel,
          monthlyViewsCount: null,
        },
      ]);

      const result = await getPublicChannels({});

      expect(result.channels[0].monthlyViewsCount).toBeNull();
      expect(result.channels[0].monthlyViews).toBeNull();
    });

    it('should handle undefined monthlyViewsCount safely in DTO', async () => {
      mockChannelFindMany.mockResolvedValue([
        {
          ...baseMockChannel,
          monthlyViewsCount: undefined,
        },
      ]);

      const result = await getPublicChannels({});

      expect(result.channels[0].monthlyViewsCount).toBeNull();
      expect(result.channels[0].monthlyViews).toBeNull();
    });
  });

  describe('10. Consistent filters between findMany and count', () => {
    it('should pass the identical where clause to both findMany and count', async () => {
      await getPublicChannels({
        niche: 'tech',
        budget: '5k-15k',
        subscribers: '10k-50k',
      });

      const findManyWhere = mockChannelFindMany.mock.calls[0][0].where;
      const countWhere = mockChannelCount.mock.calls[0][0].where;

      expect(findManyWhere).toEqual(countWhere);
      expect(findManyWhere).toEqual({
        isPublished: true,
        status: 'AVAILABLE',
        niche: 'Technology & Gadgets',
        priceCents: { gte: 500000, lt: 1500000 },
        subscribersCount: { gte: 10000, lte: 50000 },
      });
    });
  });

  describe('11. Safe propagation of Prisma errors', () => {
    it('should propagate database errors thrown by findMany', async () => {
      const dbError = new Error('Database connection failed');
      mockChannelFindMany.mockRejectedValue(dbError);

      await expect(getPublicChannels({})).rejects.toThrow('Database connection failed');
    });

    it('should propagate database errors thrown by count', async () => {
      const dbError = new Error('Database query timed out');
      mockChannelCount.mockRejectedValue(dbError);

      await expect(getPublicChannels({})).rejects.toThrow('Database query timed out');
    });
  });

  describe('12. Empty result sets and no fabricated listings', () => {
    it('should return empty channels and zero pagination without fabricating records', async () => {
      mockChannelFindMany.mockResolvedValue([]);
      mockChannelCount.mockResolvedValue(0);

      const result = await getPublicChannels({});

      expect(result.channels).toEqual([]);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });
  });

  describe('Channel Service - getPublicChannelById', () => {
    const testChannelId = '670c5e7b8f1a2b3c4d5e6f7a';

    it('should query Prisma with id, isPublished: true, and status: AVAILABLE using PUBLIC_CHANNEL_SELECT', async () => {
      mockChannelFindFirst.mockResolvedValue(baseMockChannel);

      const result = await getPublicChannelById(testChannelId);

      expect(mockChannelFindFirst).toHaveBeenCalledWith({
        where: {
          id: testChannelId,
          isPublished: true,
          status: 'AVAILABLE',
        },
        select: PUBLIC_CHANNEL_SELECT,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(testChannelId);
      expect(result?.name).toBe('Apex Tech Reviews');
      expect(result?.handle).toBe('@apextechreviews');
      expect(result?.subscribers).toBe('245K');
      expect(result?.subscribersCount).toBe(245000);
      expect(result?.monthlyViews).toBe('1.2M');
      expect(result?.monthlyViewsCount).toBe(1200000);
      expect(result?.priceUsd).toBe(14500);
      expect(result?.priceCents).toBe(1450000);
      expect(result?.monetized).toBe(true);
      expect(result?.verifiedAnalytics).toBe(true);
      expect(result?.featuredBadge).toBe('High Engagement');
      expect(result?.status).toBe('AVAILABLE');
      expect(result?.isPublished).toBe(true);
      expect(result?.seller).toEqual({
        id: '507f1f77bcf86cd799439011',
        name: 'Tech Seller',
      });
    });

    it('should return null when channel is not found in database', async () => {
      mockChannelFindFirst.mockResolvedValue(null);

      const result = await getPublicChannelById('507f1f77bcf86cd799439099');

      expect(result).toBeNull();
      expect(mockChannelFindFirst).toHaveBeenCalledWith({
        where: {
          id: '507f1f77bcf86cd799439099',
          isPublished: true,
          status: 'AVAILABLE',
        },
        select: PUBLIC_CHANNEL_SELECT,
      });
    });

    it('should return null when channel exists but is unpublished (enforced by query)', async () => {
      // Prisma findFirst returns null because where has isPublished: true
      mockChannelFindFirst.mockResolvedValue(null);

      const result = await getPublicChannelById('670c5e7b8f1a2b3c4d5e6f7b');

      expect(result).toBeNull();
      expect(mockChannelFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublished: true,
          }),
        })
      );
    });

    it('should return null when channel has non-AVAILABLE status such as DRAFT or SOLD', async () => {
      // Prisma findFirst returns null because where has status: 'AVAILABLE'
      mockChannelFindFirst.mockResolvedValue(null);

      const result = await getPublicChannelById('670c5e7b8f1a2b3c4d5e6f7c');

      expect(result).toBeNull();
      expect(mockChannelFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'AVAILABLE',
          }),
        })
      );
    });

    it('should strictly exclude private seller fields, email, passwordHash, and googleId', async () => {
      expect(PUBLIC_CHANNEL_SELECT.seller.select).toEqual({
        id: true,
        name: true,
      });
      expect((PUBLIC_CHANNEL_SELECT.seller.select as any).email).toBeUndefined();
      expect((PUBLIC_CHANNEL_SELECT.seller.select as any).passwordHash).toBeUndefined();
      expect((PUBLIC_CHANNEL_SELECT.seller.select as any).googleId).toBeUndefined();

      mockChannelFindFirst.mockResolvedValue(baseMockChannel);
      const result = await getPublicChannelById(testChannelId);

      expect(result?.seller).toEqual({
        id: '507f1f77bcf86cd799439011',
        name: 'Tech Seller',
      });
      expect((result?.seller as any).email).toBeUndefined();
      expect((result?.seller as any).passwordHash).toBeUndefined();
    });

    it('should safely handle channels with null monthlyViewsCount', async () => {
      const channelWithNullViews = {
        ...baseMockChannel,
        monthlyViewsCount: null,
      };
      mockChannelFindFirst.mockResolvedValue(channelWithNullViews);

      const result = await getPublicChannelById(testChannelId);

      expect(result).not.toBeNull();
      expect(result?.monthlyViews).toBeNull();
      expect(result?.monthlyViewsCount).toBeNull();
    });

    it('should propagate unexpected database errors up to caller', async () => {
      mockChannelFindFirst.mockRejectedValue(new Error('Prisma connection timeout'));

      await expect(getPublicChannelById(testChannelId)).rejects.toThrow('Prisma connection timeout');
    });
  });
});

describe('Channel Service - Seller Operations', () => {
  const sellerId = '507f1f77bcf86cd799439011';
  const otherSellerId = '507f1f77bcf86cd799439099';
  const channelId = '670c5e7b8f1a2b3c4d5e6f7a';

  const baseDraftChannel = {
    id: channelId,
    name: 'Tech Insights Daily',
    handle: '@techinsights',
    youtubeUrl: 'https://youtube.com/@techinsights',
    niche: 'Technology & Gadgets',
    subscribersCount: 50000,
    monthlyViewsCount: 200000,
    monetized: false,
    verifiedAnalytics: false,
    priceCents: 500000,
    description: 'Tech daily breakdowns and hardware reviews.',
    featuredBadge: null,
    status: 'DRAFT',
    isPublished: false,
    sellerId,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
  };

  const validCreateInput = {
    name: 'Tech Insights Daily',
    handle: '@techinsights',
    youtubeUrl: 'https://youtube.com/@techinsights',
    niche: 'Technology & Gadgets',
    subscribersCount: 50000,
    monthlyViewsCount: 200000,
    monetized: false,
    priceUsd: 5000,
    description: 'Tech daily breakdowns and hardware reviews.',
  };

  beforeEach(() => {
    mockChannelFindMany.mockReset();
    mockChannelCount.mockReset();
    mockChannelFindFirst.mockReset();
    mockChannelFindUnique.mockReset();
    mockChannelCreate.mockReset();
    mockChannelUpdate.mockReset();
    mockChannelUpdateMany.mockReset();
    mockChannelDeleteMany.mockReset();
  });

  describe('createChannelListing', () => {
    it('should assign sellerId exclusively from the trusted function argument and default status to DRAFT and isPublished to false', async () => {
      mockChannelCreate.mockResolvedValue({
        ...baseDraftChannel,
      });

      const result = await createChannelListing(sellerId, validCreateInput);

      expect(mockChannelCreate).toHaveBeenCalledWith({
        data: {
          sellerId,
          name: 'Tech Insights Daily',
          handle: '@techinsights',
          youtubeUrl: 'https://youtube.com/@techinsights',
          niche: 'Technology & Gadgets',
          subscribersCount: 50000,
          monthlyViewsCount: 200000,
          monetized: false,
          priceCents: 500000,
          description: 'Tech daily breakdowns and hardware reviews.',
          status: 'DRAFT',
          isPublished: false,
        },
      });

      expect(result.status).toBe('DRAFT');
      expect(result.isPublished).toBe(false);
      expect(result.sellerId).toBe(sellerId);
    });

    it('should correctly convert validated USD price to integer cents', async () => {
      mockChannelCreate.mockResolvedValue({
        ...baseDraftChannel,
        priceCents: 123456,
      });

      await createChannelListing(sellerId, {
        ...validCreateInput,
        priceUsd: 1234.56,
      });

      const createCall = mockChannelCreate.mock.calls[0][0];
      expect(createCall.data.priceCents).toBe(123456);
    });

    it('should reject attempts to inject sellerId or admin fields in the payload', async () => {
      // Attempting to supply sellerId in payload
      await expect(
        createChannelListing(sellerId, {
          ...validCreateInput,
          sellerId: otherSellerId,
        })
      ).rejects.toThrow(ChannelValidationError);

      // Attempting to supply status in payload
      await expect(
        createChannelListing(sellerId, {
          ...validCreateInput,
          status: 'AVAILABLE',
        })
      ).rejects.toThrow(ChannelValidationError);

      // Attempting to supply isPublished in payload
      await expect(
        createChannelListing(sellerId, {
          ...validCreateInput,
          isPublished: true,
        })
      ).rejects.toThrow(ChannelValidationError);

      // Attempting to supply verifiedAnalytics in payload
      await expect(
        createChannelListing(sellerId, {
          ...validCreateInput,
          verifiedAnalytics: true,
        })
      ).rejects.toThrow(ChannelValidationError);

      // Attempting to supply featuredBadge in payload
      await expect(
        createChannelListing(sellerId, {
          ...validCreateInput,
          featuredBadge: 'Top Tier',
        })
      ).rejects.toThrow(ChannelValidationError);

      // Attempting to supply raw priceCents in payload
      await expect(
        createChannelListing(sellerId, {
          ...validCreateInput,
          priceCents: 100000,
        })
      ).rejects.toThrow(ChannelValidationError);

      expect(mockChannelCreate).not.toHaveBeenCalled();
    });

    it('should reject invalid input missing required fields or having negative price', async () => {
      await expect(
        createChannelListing(sellerId, {
          ...validCreateInput,
          name: '',
        })
      ).rejects.toThrow(ChannelValidationError);

      await expect(
        createChannelListing(sellerId, {
          ...validCreateInput,
          priceUsd: -10,
        })
      ).rejects.toThrow(ChannelValidationError);

      await expect(
        createChannelListing(sellerId, {
          ...validCreateInput,
          subscribersCount: -100,
        })
      ).rejects.toThrow(ChannelValidationError);
    });

    it('should reject if sellerId argument is empty or whitespace-only', async () => {
      await expect(createChannelListing('', validCreateInput)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(createChannelListing('   ', validCreateInput)).rejects.toThrow(
        ChannelValidationError
      );
    });
  });

  describe('getSellerChannels', () => {
    it('should return only listings belonging to the authenticated seller ordered newest first', async () => {
      mockChannelFindMany.mockResolvedValue([baseDraftChannel]);

      const channels = await getSellerChannels(sellerId);

      expect(mockChannelFindMany).toHaveBeenCalledWith({
        where: {
          sellerId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(channels).toHaveLength(1);
      expect(channels[0].sellerId).toBe(sellerId);
    });

    it('should never query another seller listings or leak cross-seller drafts', async () => {
      mockChannelFindMany.mockResolvedValue([]);

      await getSellerChannels(sellerId);

      const findManyCall = mockChannelFindMany.mock.calls[0][0];
      expect(findManyCall.where.sellerId).toBe(sellerId);
      expect(findManyCall.where.sellerId).not.toBe(otherSellerId);
    });

    it('should reject if sellerId argument is empty or whitespace-only', async () => {
      await expect(getSellerChannels('')).rejects.toThrow(ChannelValidationError);
      await expect(getSellerChannels('   ')).rejects.toThrow(ChannelValidationError);
    });
  });

  describe('getSellerChannelById', () => {
    it('should scope lookup to both channel ID and seller ID', async () => {
      mockChannelFindFirst.mockResolvedValue(baseDraftChannel);

      const result = await getSellerChannelById(sellerId, channelId);

      expect(mockChannelFindFirst).toHaveBeenCalledWith({
        where: {
          id: channelId,
          sellerId,
        },
      });
      expect(result).toEqual(baseDraftChannel);
    });

    it('should return null when listing does not exist (established not-found convention)', async () => {
      mockChannelFindFirst.mockResolvedValue(null);

      const result = await getSellerChannelById(sellerId, 'non-existent-id');

      expect(result).toBeNull();
      expect(mockChannelFindFirst).toHaveBeenCalledWith({
        where: {
          id: 'non-existent-id',
          sellerId,
        },
      });
    });

    it('should return null when channel belongs to another seller (cross-seller protection)', async () => {
      mockChannelFindFirst.mockResolvedValue(null);

      const result = await getSellerChannelById(otherSellerId, channelId);

      expect(result).toBeNull();
      expect(mockChannelFindFirst).toHaveBeenCalledWith({
        where: {
          id: channelId,
          sellerId: otherSellerId,
        },
      });
    });

    it('should reject if sellerId or channelId is missing or whitespace-only', async () => {
      await expect(getSellerChannelById('', channelId)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(getSellerChannelById('   ', channelId)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(getSellerChannelById(sellerId, '')).rejects.toThrow(
        ChannelValidationError
      );
      await expect(getSellerChannelById(sellerId, '   ')).rejects.toThrow(
        ChannelValidationError
      );
    });
  });

  describe('updateSellerChannel', () => {
    const validUpdateInput = {
      name: 'Updated Tech Insights',
      priceUsd: 7500,
      description: 'Updated description for channel.',
    };

    it('should update permitted fields using atomic conditional update requiring DRAFT status', async () => {
      const updatedChannel = {
        ...baseDraftChannel,
        name: 'Updated Tech Insights',
        priceCents: 750000,
        description: 'Updated description for channel.',
      };

      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      mockChannelUpdateMany.mockResolvedValue({ count: 1 });
      mockChannelFindFirst.mockResolvedValue(updatedChannel);

      const updated = await updateSellerChannel(sellerId, channelId, validUpdateInput);

      expect(mockChannelFindUnique).toHaveBeenCalledWith({
        where: { id: channelId },
      });

      expect(mockChannelUpdateMany).toHaveBeenCalledWith({
        where: {
          id: channelId,
          sellerId,
          status: 'DRAFT',
        },
        data: {
          name: 'Updated Tech Insights',
          priceCents: 750000,
          description: 'Updated description for channel.',
        },
      });

      expect(updated.name).toBe('Updated Tech Insights');
      expect(updated.priceCents).toBe(750000);
    });

    it('should handle concurrent modification race condition and fail if updateMany count is 0', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      // Simulating concurrent status change from DRAFT to PENDING_REVIEW before write occurs
      mockChannelUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        updateSellerChannel(sellerId, channelId, validUpdateInput)
      ).rejects.toThrow(ChannelValidationError);
    });

    it('should reject attempts to update protected fields in payload', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);

      await expect(
        updateSellerChannel(sellerId, channelId, {
          name: 'Valid Name',
          sellerId: otherSellerId,
        })
      ).rejects.toThrow(ChannelValidationError);

      await expect(
        updateSellerChannel(sellerId, channelId, {
          name: 'Valid Name',
          status: 'AVAILABLE',
        })
      ).rejects.toThrow(ChannelValidationError);

      await expect(
        updateSellerChannel(sellerId, channelId, {
          name: 'Valid Name',
          isPublished: true,
        })
      ).rejects.toThrow(ChannelValidationError);

      await expect(
        updateSellerChannel(sellerId, channelId, {
          name: 'Valid Name',
          verifiedAnalytics: true,
        })
      ).rejects.toThrow(ChannelValidationError);

      await expect(
        updateSellerChannel(sellerId, channelId, {
          name: 'Valid Name',
          featuredBadge: 'Featured',
        })
      ).rejects.toThrow(ChannelValidationError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should reject empty update payload without bypassing Zod validation', async () => {
      await expect(
        updateSellerChannel(sellerId, channelId, {})
      ).rejects.toThrow(ChannelValidationError);

      expect(mockChannelFindUnique).not.toHaveBeenCalled();
      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should block updates for non-DRAFT channels (PENDING_REVIEW, AVAILABLE, SOLD, DELISTED)', async () => {
      // PENDING_REVIEW channel
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        status: 'PENDING_REVIEW',
      });

      await expect(
        updateSellerChannel(sellerId, channelId, validUpdateInput)
      ).rejects.toThrow(ChannelValidationError);

      // AVAILABLE channel
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        status: 'AVAILABLE',
        isPublished: true,
      });

      await expect(
        updateSellerChannel(sellerId, channelId, validUpdateInput)
      ).rejects.toThrow(ChannelValidationError);

      // SOLD channel
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        status: 'SOLD',
      });

      await expect(
        updateSellerChannel(sellerId, channelId, validUpdateInput)
      ).rejects.toThrow(ChannelValidationError);

      // DELISTED channel
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        status: 'DELISTED',
        isPublished: false,
      });

      await expect(
        updateSellerChannel(sellerId, channelId, validUpdateInput)
      ).rejects.toThrow(ChannelValidationError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should block cross-seller updates and throw ChannelForbiddenError', async () => {
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        sellerId: otherSellerId,
      });

      await expect(
        updateSellerChannel(sellerId, channelId, validUpdateInput)
      ).rejects.toThrow(ChannelForbiddenError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should throw ChannelNotFoundError when channel does not exist', async () => {
      mockChannelFindUnique.mockResolvedValue(null);

      await expect(
        updateSellerChannel(sellerId, 'missing-channel', validUpdateInput)
      ).rejects.toThrow(ChannelNotFoundError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should reject if sellerId or channelId is empty or whitespace-only', async () => {
      await expect(updateSellerChannel('', channelId, validUpdateInput)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(updateSellerChannel('   ', channelId, validUpdateInput)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(updateSellerChannel(sellerId, '', validUpdateInput)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(updateSellerChannel(sellerId, '   ', validUpdateInput)).rejects.toThrow(
        ChannelValidationError
      );
    });

    it('should preserve existing youtubeUrl when omitted from update payload', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      mockChannelUpdateMany.mockResolvedValue({ count: 1 });
      mockChannelFindFirst.mockResolvedValue({
        ...baseDraftChannel,
        name: 'New Name Only',
      });

      await updateSellerChannel(sellerId, channelId, { name: 'New Name Only' });

      expect(mockChannelUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            youtubeUrl: expect.anything(),
          }),
        })
      );
    });

    it('should clear stored youtubeUrl when explicit null is provided', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      mockChannelUpdateMany.mockResolvedValue({ count: 1 });
      mockChannelFindFirst.mockResolvedValue({
        ...baseDraftChannel,
        youtubeUrl: null,
      });

      const updated = await updateSellerChannel(sellerId, channelId, { youtubeUrl: null });

      expect(mockChannelUpdateMany).toHaveBeenCalledWith({
        where: {
          id: channelId,
          sellerId,
          status: 'DRAFT',
        },
        data: {
          youtubeUrl: null,
        },
      });
      expect(updated.youtubeUrl).toBeNull();
    });

    it('should update youtubeUrl normally when valid replacement URL is provided', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      mockChannelUpdateMany.mockResolvedValue({ count: 1 });
      mockChannelFindFirst.mockResolvedValue({
        ...baseDraftChannel,
        youtubeUrl: 'https://youtube.com/@updatedchannel',
      });

      const updated = await updateSellerChannel(sellerId, channelId, {
        youtubeUrl: 'https://youtube.com/@updatedchannel',
      });

      expect(mockChannelUpdateMany).toHaveBeenCalledWith({
        where: {
          id: channelId,
          sellerId,
          status: 'DRAFT',
        },
        data: {
          youtubeUrl: 'https://youtube.com/@updatedchannel',
        },
      });
      expect(updated.youtubeUrl).toBe('https://youtube.com/@updatedchannel');
    });

    it('should preserve existing monthlyViewsCount when omitted from update payload', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      mockChannelUpdateMany.mockResolvedValue({ count: 1 });
      mockChannelFindFirst.mockResolvedValue({
        ...baseDraftChannel,
        name: 'New Name Only',
      });

      await updateSellerChannel(sellerId, channelId, { name: 'New Name Only' });

      expect(mockChannelUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            monthlyViewsCount: expect.anything(),
          }),
        })
      );
    });

    it('should clear stored monthlyViewsCount when explicit null is provided', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      mockChannelUpdateMany.mockResolvedValue({ count: 1 });
      mockChannelFindFirst.mockResolvedValue({
        ...baseDraftChannel,
        monthlyViewsCount: null,
      });

      const updated = await updateSellerChannel(sellerId, channelId, { monthlyViewsCount: null });

      expect(mockChannelUpdateMany).toHaveBeenCalledWith({
        where: {
          id: channelId,
          sellerId,
          status: 'DRAFT',
        },
        data: {
          monthlyViewsCount: null,
        },
      });
      expect(updated.monthlyViewsCount).toBeNull();
    });

    it('should update monthlyViewsCount normally when valid replacement count is provided', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      mockChannelUpdateMany.mockResolvedValue({ count: 1 });
      mockChannelFindFirst.mockResolvedValue({
        ...baseDraftChannel,
        monthlyViewsCount: 850000,
      });

      const updated = await updateSellerChannel(sellerId, channelId, {
        monthlyViewsCount: 850000,
      });

      expect(mockChannelUpdateMany).toHaveBeenCalledWith({
        where: {
          id: channelId,
          sellerId,
          status: 'DRAFT',
        },
        data: {
          monthlyViewsCount: 850000,
        },
      });
      expect(updated.monthlyViewsCount).toBe(850000);
    });

    it('should reject invalid non-null values for optional fields', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);

      await expect(
        updateSellerChannel(sellerId, channelId, { youtubeUrl: 'ftp://invalid-url' })
      ).rejects.toThrow(ChannelValidationError);

      await expect(
        updateSellerChannel(sellerId, channelId, { youtubeUrl: '' })
      ).rejects.toThrow(ChannelValidationError);

      await expect(
        updateSellerChannel(sellerId, channelId, { monthlyViewsCount: -50 })
      ).rejects.toThrow(ChannelValidationError);

      await expect(
        updateSellerChannel(sellerId, channelId, { monthlyViewsCount: 1.25 })
      ).rejects.toThrow(ChannelValidationError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('submitChannelForReview', () => {
    it('should submit a DRAFT channel for review using atomic conditional update, setting status to PENDING_REVIEW and keeping isPublished: false', async () => {
      const reviewedChannel = {
        ...baseDraftChannel,
        status: 'PENDING_REVIEW',
        isPublished: false,
      };

      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      mockChannelUpdateMany.mockResolvedValue({ count: 1 });
      mockChannelFindFirst.mockResolvedValue(reviewedChannel);

      const result = await submitChannelForReview(sellerId, channelId);

      expect(mockChannelFindUnique).toHaveBeenCalledWith({
        where: { id: channelId },
      });

      expect(mockChannelUpdateMany).toHaveBeenCalledWith({
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

      expect(result.status).toBe('PENDING_REVIEW');
      expect(result.isPublished).toBe(false);
    });

    it('should handle concurrent submission/modification race condition and fail if updateMany count is 0', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      // Channel was concurrently submitted or changed before write
      mockChannelUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        submitChannelForReview(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);
    });

    it('should never set isPublished: true or automatically approve the listing during submission', async () => {
      const reviewedChannel = {
        ...baseDraftChannel,
        status: 'PENDING_REVIEW',
        isPublished: false,
      };

      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      mockChannelUpdateMany.mockResolvedValue({ count: 1 });
      mockChannelFindFirst.mockResolvedValue(reviewedChannel);

      await submitChannelForReview(sellerId, channelId);

      const updateCall = mockChannelUpdateMany.mock.calls[0][0];
      expect(updateCall.data.isPublished).toBe(false);
      expect(updateCall.data.status).toBe('PENDING_REVIEW');
      expect(updateCall.data.status).not.toBe('AVAILABLE');
    });

    it('should prevent repeated review submissions if channel is already in PENDING_REVIEW', async () => {
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        status: 'PENDING_REVIEW',
      });

      await expect(
        submitChannelForReview(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should reject submission if channel is in AVAILABLE, SOLD, DELISTED, or non-DRAFT status', async () => {
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        status: 'AVAILABLE',
        isPublished: true,
      });

      await expect(
        submitChannelForReview(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);

      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        status: 'DELISTED',
        isPublished: false,
      });

      await expect(
        submitChannelForReview(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should block review submission for non-owned channel and throw ChannelForbiddenError', async () => {
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        sellerId: otherSellerId,
      });

      await expect(
        submitChannelForReview(sellerId, channelId)
      ).rejects.toThrow(ChannelForbiddenError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should throw ChannelNotFoundError when channel does not exist', async () => {
      mockChannelFindUnique.mockResolvedValue(null);

      await expect(
        submitChannelForReview(sellerId, 'non-existent-id')
      ).rejects.toThrow(ChannelNotFoundError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should reject if sellerId or channelId is empty or whitespace-only', async () => {
      await expect(submitChannelForReview('', channelId)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(submitChannelForReview('   ', channelId)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(submitChannelForReview(sellerId, '')).rejects.toThrow(
        ChannelValidationError
      );
      await expect(submitChannelForReview(sellerId, '   ')).rejects.toThrow(
        ChannelValidationError
      );
    });
  });

  describe('unpublishSellerChannel', () => {
    const publishedChannel = {
      ...baseDraftChannel,
      status: 'AVAILABLE',
      isPublished: true,
    };

    it('should unpublish an owned, published listing, setting status to DELISTED and isPublished to false atomically', async () => {
      const delistedChannel = {
        ...baseDraftChannel,
        status: 'DELISTED',
        isPublished: false,
      };

      mockChannelFindUnique.mockResolvedValue(publishedChannel);
      mockChannelUpdateMany.mockResolvedValue({ count: 1 });
      mockChannelFindFirst.mockResolvedValue(delistedChannel);

      const result = await unpublishSellerChannel(sellerId, channelId);

      expect(mockChannelFindUnique).toHaveBeenCalledWith({
        where: { id: channelId },
      });

      expect(mockChannelUpdateMany).toHaveBeenCalledWith({
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

      expect(result.status).toBe('DELISTED');
      expect(result.isPublished).toBe(false);
    });

    it('should never publish or move listing to AVAILABLE as a side-effect of unpublishing', async () => {
      const delistedChannel = {
        ...baseDraftChannel,
        status: 'DELISTED',
        isPublished: false,
      };

      mockChannelFindUnique.mockResolvedValue(publishedChannel);
      mockChannelUpdateMany.mockResolvedValue({ count: 1 });
      mockChannelFindFirst.mockResolvedValue(delistedChannel);

      await unpublishSellerChannel(sellerId, channelId);

      const updateCall = mockChannelUpdateMany.mock.calls[0][0];
      expect(updateCall.data.isPublished).toBe(false);
      expect(updateCall.data.status).toBe('DELISTED');
      expect(updateCall.data.status).not.toBe('AVAILABLE');
    });

    it('should refuse to unpublish another seller listing and throw ChannelForbiddenError', async () => {
      mockChannelFindUnique.mockResolvedValue({
        ...publishedChannel,
        sellerId: otherSellerId,
      });

      await expect(
        unpublishSellerChannel(sellerId, channelId)
      ).rejects.toThrow(ChannelForbiddenError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should refuse to unpublish a listing with status SOLD or UNDER_CONTRACT', async () => {
      mockChannelFindUnique.mockResolvedValue({
        ...publishedChannel,
        status: 'SOLD',
      });

      await expect(
        unpublishSellerChannel(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);

      mockChannelFindUnique.mockResolvedValue({
        ...publishedChannel,
        status: 'UNDER_CONTRACT',
      });

      await expect(
        unpublishSellerChannel(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should refuse to unpublish an unpublished listing (DRAFT, PENDING_REVIEW, DELISTED)', async () => {
      // DRAFT
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);

      await expect(
        unpublishSellerChannel(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);

      // PENDING_REVIEW
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        status: 'PENDING_REVIEW',
      });

      await expect(
        unpublishSellerChannel(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);

      // DELISTED
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        status: 'DELISTED',
        isPublished: false,
      });

      await expect(
        unpublishSellerChannel(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should throw ChannelNotFoundError when unpublishing a non-existent channel', async () => {
      mockChannelFindUnique.mockResolvedValue(null);

      await expect(
        unpublishSellerChannel(sellerId, 'missing-channel')
      ).rejects.toThrow(ChannelNotFoundError);

      expect(mockChannelUpdateMany).not.toHaveBeenCalled();
    });

    it('should handle concurrent modification race condition and fail if updateMany count is 0 during unpublish', async () => {
      mockChannelFindUnique.mockResolvedValue(publishedChannel);
      // Concurrently unpublished or delisted by admin
      mockChannelUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        unpublishSellerChannel(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);
    });

    it('should reject if sellerId or channelId is empty or whitespace-only', async () => {
      await expect(unpublishSellerChannel('', channelId)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(unpublishSellerChannel('   ', channelId)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(unpublishSellerChannel(sellerId, '')).rejects.toThrow(
        ChannelValidationError
      );
      await expect(unpublishSellerChannel(sellerId, '   ')).rejects.toThrow(
        ChannelValidationError
      );
    });
  });

  describe('deleteSellerChannel', () => {
    it('should successfully delete an unpublished channel owned by seller using atomic conditional deletion', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      mockChannelDeleteMany.mockResolvedValue({ count: 1 });

      const result = await deleteSellerChannel(sellerId, channelId);

      expect(mockChannelFindUnique).toHaveBeenCalledWith({
        where: { id: channelId },
      });

      expect(mockChannelDeleteMany).toHaveBeenCalledWith({
        where: {
          id: channelId,
          sellerId,
          isPublished: false,
        },
      });

      expect(result).toEqual({ success: true, id: channelId });
    });

    it('should successfully delete a DELISTED channel (since isPublished is false)', async () => {
      const delistedChannel = {
        ...baseDraftChannel,
        status: 'DELISTED',
        isPublished: false,
      };

      mockChannelFindUnique.mockResolvedValue(delistedChannel);
      mockChannelDeleteMany.mockResolvedValue({ count: 1 });

      const result = await deleteSellerChannel(sellerId, channelId);

      expect(result).toEqual({ success: true, id: channelId });
      expect(mockChannelDeleteMany).toHaveBeenCalledWith({
        where: {
          id: channelId,
          sellerId,
          isPublished: false,
        },
      });
    });

    it('should refuse deletion if listing is published (must unpublish before deletion rule)', async () => {
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        status: 'AVAILABLE',
        isPublished: true,
      });

      await expect(
        deleteSellerChannel(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);

      expect(mockChannelDeleteMany).not.toHaveBeenCalled();
    });

    it('should complete the full unpublish-then-delete workflow', async () => {
      const publishedChannel = {
        ...baseDraftChannel,
        status: 'AVAILABLE',
        isPublished: true,
      };
      const delistedChannel = {
        ...baseDraftChannel,
        status: 'DELISTED',
        isPublished: false,
      };

      // 1. Initial attempt to delete while published is blocked
      mockChannelFindUnique.mockResolvedValueOnce(publishedChannel);
      await expect(
        deleteSellerChannel(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);

      // 2. Unpublish listing
      mockChannelFindUnique.mockResolvedValueOnce(publishedChannel);
      mockChannelUpdateMany.mockResolvedValueOnce({ count: 1 });
      mockChannelFindFirst.mockResolvedValueOnce(delistedChannel);

      const unpublishResult = await unpublishSellerChannel(sellerId, channelId);
      expect(unpublishResult.isPublished).toBe(false);
      expect(unpublishResult.status).toBe('DELISTED');

      // 3. Deletion now succeeds on the unpublished/delisted listing
      mockChannelFindUnique.mockResolvedValueOnce(delistedChannel);
      mockChannelDeleteMany.mockResolvedValueOnce({ count: 1 });

      const deleteResult = await deleteSellerChannel(sellerId, channelId);
      expect(deleteResult).toEqual({ success: true, id: channelId });
    });

    it('should block deletion of non-owned channel and throw ChannelForbiddenError', async () => {
      mockChannelFindUnique.mockResolvedValue({
        ...baseDraftChannel,
        sellerId: otherSellerId,
      });

      await expect(
        deleteSellerChannel(sellerId, channelId)
      ).rejects.toThrow(ChannelForbiddenError);

      expect(mockChannelDeleteMany).not.toHaveBeenCalled();
    });

    it('should throw ChannelNotFoundError if channel does not exist', async () => {
      mockChannelFindUnique.mockResolvedValue(null);

      await expect(
        deleteSellerChannel(sellerId, 'non-existent-id')
      ).rejects.toThrow(ChannelNotFoundError);

      expect(mockChannelDeleteMany).not.toHaveBeenCalled();
    });

    it('should handle concurrent modification/publishing and throw if atomic delete count is 0', async () => {
      mockChannelFindUnique.mockResolvedValue(baseDraftChannel);
      mockChannelDeleteMany.mockResolvedValue({ count: 0 });

      await expect(
        deleteSellerChannel(sellerId, channelId)
      ).rejects.toThrow(ChannelValidationError);
    });

    it('should reject if sellerId or channelId is empty or whitespace-only', async () => {
      await expect(deleteSellerChannel('', channelId)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(deleteSellerChannel('   ', channelId)).rejects.toThrow(
        ChannelValidationError
      );
      await expect(deleteSellerChannel(sellerId, '')).rejects.toThrow(
        ChannelValidationError
      );
      await expect(deleteSellerChannel(sellerId, '   ')).rejects.toThrow(
        ChannelValidationError
      );
    });
  });
});


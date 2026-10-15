import { vi, describe, it, expect, beforeEach } from 'vitest';
import { registerTestPrismaClient } from '../../src/config/prisma.js';

// Maintain fail-closed test PrismaClient registration
const mockPrisma = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn(),
  channel: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

registerTestPrismaClient(mockPrisma as any);

// Mock the channel service to isolate the controller tests
export const mockGetPublicChannels = vi.fn();
export const mockGetPublicChannelById = vi.fn();

vi.mock('../../src/services/channel.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/channel.service.js')>();
  return {
    ...actual,
    getPublicChannels: (...args: any[]) => mockGetPublicChannels(...args),
    getPublicChannelById: (...args: any[]) => mockGetPublicChannelById(...args),
  };
});

import type { Request, Response, NextFunction } from 'express';
import { getChannels, getChannelById } from '../../src/controllers/channel.controller.js';
import { ChannelValidationError } from '../../src/services/channel.service.js';
import channelRoutes from '../../src/routes/channel.routes.js';
import apiV1Routes from '../../src/routes/index.js';
import { requireAuth } from '../../src/middleware/auth.middleware.js';

describe('Channel Controller & Routes (GET /api/v1/channels)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;
  let statusMock: any;
  let jsonMock: any;

  const mockServiceResponse = {
    channels: [
      {
        id: '670c5e7b8f1a2b3c4d5e6f7a',
        name: 'Apex Tech Reviews',
        handle: '@apextechreviews',
        youtubeUrl: 'https://youtube.com/@apextechreviews',
        niche: 'Technology & Gadgets',
        subscribers: '245K',
        subscribersCount: 245000,
        monthlyViews: '1.2M',
        monthlyViewsCount: 1200000,
        monetized: true,
        verifiedAnalytics: true,
        priceCents: 1450000,
        priceUsd: 14500,
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
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    mockReq = {
      query: {},
      params: {},
      headers: {},
      user: undefined,
    };
    nextFunction = vi.fn();
    mockGetPublicChannels.mockReset();
    mockGetPublicChannels.mockResolvedValue(mockServiceResponse);
    mockGetPublicChannelById.mockReset();
    mockGetPublicChannelById.mockResolvedValue(mockServiceResponse.channels[0]);
  });

  describe('1. Successful requests & response envelope', () => {
    it('should return 200 with standard response envelope on success', async () => {
      mockReq.query = {};

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Channels retrieved successfully.',
        data: mockServiceResponse,
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should not leak sensitive seller credentials in output envelope', async () => {
      mockReq.query = {};

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      const responseBody = jsonMock.mock.calls[0][0];
      const firstChannel = responseBody.data.channels[0];

      expect(firstChannel.seller).toEqual({
        id: '507f1f77bcf86cd799439011',
        name: 'Tech Seller',
      });
      expect(firstChannel.seller).not.toHaveProperty('passwordHash');
      expect(firstChannel.seller).not.toHaveProperty('email');
      expect(firstChannel.seller).not.toHaveProperty('googleId');
    });
  });

  describe('2. Validated query parameters passed to service', () => {
    it('should pass default pagination and sort when omitted in query', async () => {
      mockReq.query = {};

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockGetPublicChannels).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        sort: 'newest',
      });
    });

    it('should coerce string numbers and normalize niche slug', async () => {
      mockReq.query = {
        niche: 'gaming',
        budget: '5k-15k',
        subscribers: '10k-50k',
        minPrice: '5000',
        maxPrice: '12000',
        minSubscribers: '15000',
        maxSubscribers: '45000',
        page: '2',
        limit: '25',
        sort: 'price_asc',
      };

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockGetPublicChannels).toHaveBeenCalledWith({
        niche: 'Gaming & Esports',
        budget: '5k-15k',
        subscribers: '10k-50k',
        minPrice: 5000,
        maxPrice: 12000,
        minSubscribers: 15000,
        maxSubscribers: 45000,
        page: 2,
        limit: 25,
        sort: 'price_asc',
      });
    });
  });

  describe('3. Invalid query parameters return HTTP 400', () => {
    it('should reject invalid niche slug with 400', async () => {
      mockReq.query = { niche: 'unsupported_category' };

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String),
        })
      );
      expect(mockGetPublicChannels).not.toHaveBeenCalled();
    });

    it('should reject unknown query parameters due to strict schema', async () => {
      mockReq.query = { maliciousParam: 'attack' };

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String),
        })
      );
      expect(mockGetPublicChannels).not.toHaveBeenCalled();
    });

    it('should reject extra decimal places in price inputs', async () => {
      mockReq.query = { minPrice: '1.234' };

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String),
        })
      );
      expect(mockGetPublicChannels).not.toHaveBeenCalled();
    });

    it('should reject negative page numbers', async () => {
      mockReq.query = { page: '-1' };

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'page must be at least 1',
        })
      );
      expect(mockGetPublicChannels).not.toHaveBeenCalled();
    });

    it('should reject limits exceeding 50', async () => {
      mockReq.query = { limit: '100' };

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'limit cannot exceed 50',
        })
      );
      expect(mockGetPublicChannels).not.toHaveBeenCalled();
    });
  });

  describe('4. Invalid price and subscriber ranges return HTTP 400', () => {
    it('should return 400 when minPrice > maxPrice in query validator', async () => {
      mockReq.query = { minPrice: '2000', maxPrice: '1000' };

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'minPrice cannot be greater than maxPrice',
        })
      );
      expect(mockGetPublicChannels).not.toHaveBeenCalled();
    });

    it('should return 400 when minSubscribers > maxSubscribers in query validator', async () => {
      mockReq.query = { minSubscribers: '50000', maxSubscribers: '10000' };

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'minSubscribers cannot be greater than maxSubscribers',
        })
      );
      expect(mockGetPublicChannels).not.toHaveBeenCalled();
    });

    it('should catch ChannelValidationError from service and return HTTP 400', async () => {
      mockReq.query = { budget: 'under-5k', minPrice: '6000' };
      mockGetPublicChannels.mockRejectedValue(
        new ChannelValidationError('Inconsistent price bounds: minimum price exceeds maximum price')
      );

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Inconsistent price bounds: minimum price exceeds maximum price',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('5. Unexpected service errors delegated to error middleware', () => {
    it('should delegate unexpected errors to next(error) without leaking stack traces directly', async () => {
      const dbError = new Error('Database pool connection timeout');
      mockGetPublicChannels.mockRejectedValue(dbError);

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(dbError);
      expect(statusMock).not.toHaveBeenCalled();
      expect(jsonMock).not.toHaveBeenCalled();
    });
  });

  describe('6. Public route registration & mount path', () => {
    it('should mount channelRoutes at /channels on apiV1Routes', () => {
      const channelMount = apiV1Routes.stack.find(
        (layer: any) => layer.handle === channelRoutes
      );

      expect(channelMount).toBeDefined();
      expect(channelMount.matchers[0]('/channels')).toBeTruthy();
      expect(channelMount.matchers[0]('/other-path')).toBeFalsy();
    });

    it('should register GET / handler on channelRoutes pointing to getChannels', () => {
      const getRootRoute = channelRoutes.stack.find(
        (layer: any) => layer.route && layer.route.path === '/' && layer.route.methods.get
      );

      expect(getRootRoute).toBeDefined();
      const handlers = getRootRoute.route.stack.map((s: any) => s.handle);
      expect(handlers).toContain(getChannels);
    });
  });

  describe('7. Unauthenticated public access verification', () => {
    it('should not contain requireAuth in channelRoutes stack', () => {
      const getRootRoute = channelRoutes.stack.find(
        (layer: any) => layer.route && layer.route.path === '/' && layer.route.methods.get
      );

      expect(getRootRoute).toBeDefined();
      const handlers = getRootRoute.route.stack.map((s: any) => s.handle);
      expect(handlers).not.toContain(requireAuth);

      const hasAuthMiddleware = channelRoutes.stack.some(
        (layer: any) => layer.handle === requireAuth
      );
      expect(hasAuthMiddleware).toBe(false);
    });

    it('should succeed when no authorization header or user object is present', async () => {
      mockReq.headers = {};
      mockReq.user = undefined;

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Channels retrieved successfully.',
        })
      );
    });
  });

  describe('8. Single channel endpoint (GET /api/v1/channels/:id)', () => {
    const validChannelId = '670c5e7b8f1a2b3c4d5e6f7a';

    it('should return 200 with channel data for valid ID and published, available channel', async () => {
      mockReq.params = { id: validChannelId };
      mockGetPublicChannelById.mockResolvedValue(mockServiceResponse.channels[0]);

      await getChannelById(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockGetPublicChannelById).toHaveBeenCalledWith(validChannelId);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Channel retrieved successfully.',
        data: {
          channel: mockServiceResponse.channels[0],
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 validation error for invalid ID such as "123" without calling service', async () => {
      mockReq.params = { id: '123' };

      await getChannelById(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockGetPublicChannelById).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: expect.stringMatching(/Invalid channel ID format/),
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 validation error for invalid ID such as "not-an-id"', async () => {
      mockReq.params = { id: 'not-an-id' };

      await getChannelById(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockGetPublicChannelById).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: expect.stringMatching(/Invalid channel ID format/),
      });
    });

    it('should return 404 when channel is not found', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439099' };
      mockGetPublicChannelById.mockResolvedValue(null);

      await getChannelById(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockGetPublicChannelById).toHaveBeenCalledWith('507f1f77bcf86cd799439099');
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Channel not found',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 404 when channel is unpublished or unavailable (service returns null)', async () => {
      mockReq.params = { id: '670c5e7b8f1a2b3c4d5e6f7b' };
      mockGetPublicChannelById.mockResolvedValue(null);

      await getChannelById(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Channel not found',
      });
    });

    it('should ensure seller projection contains only permitted public fields', async () => {
      mockReq.params = { id: validChannelId };
      const expectedChannel = mockServiceResponse.channels[0];
      mockGetPublicChannelById.mockResolvedValue(expectedChannel);

      await getChannelById(mockReq as Request, mockRes as Response, nextFunction);

      const returnedChannel = jsonMock.mock.calls[0][0].data.channel;
      expect(returnedChannel.seller).toEqual({
        id: '507f1f77bcf86cd799439011',
        name: 'Tech Seller',
      });
      expect(returnedChannel.seller.email).toBeUndefined();
      expect(returnedChannel.seller.passwordHash).toBeUndefined();
    });

    it('should forward unexpected service errors to nextFunction (Express error middleware)', async () => {
      mockReq.params = { id: validChannelId };
      const testError = new Error('Database connection failed');
      mockGetPublicChannelById.mockRejectedValue(testError);

      await getChannelById(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(testError);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should confirm route registration in channelRoutes stack for GET /:id', () => {
      const getIdRoute = channelRoutes.stack.find(
        (layer: any) => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      );

      expect(getIdRoute).toBeDefined();
      const handlers = getIdRoute.route.stack.map((s: any) => s.handle);
      expect(handlers).toContain(getChannelById);
      expect(handlers).not.toContain(requireAuth);
    });

    it('should verify route ordering preserves existing GET / list behavior', async () => {
      mockReq.query = { niche: 'tech' };
      mockReq.params = {};

      await getChannels(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockGetPublicChannels).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Channels retrieved successfully.',
        })
      );
    });
  });
});

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { registerTestPrismaClient } from '../../src/config/prisma.js';

// Maintain fail-closed test PrismaClient registration
const mockPrisma = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn(),
  channel: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
};

registerTestPrismaClient(mockPrisma as any);

// Mock the channel service to isolate the controller tests
export const mockCreateChannelListing = vi.fn();
export const mockGetSellerChannels = vi.fn();
export const mockGetSellerChannelById = vi.fn();
export const mockUpdateSellerChannel = vi.fn();
export const mockSubmitChannelForReview = vi.fn();
export const mockUnpublishSellerChannel = vi.fn();
export const mockDeleteSellerChannel = vi.fn();

vi.mock('../../src/services/channel.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/channel.service.js')>();
  return {
    ...actual,
    createChannelListing: (...args: any[]) => mockCreateChannelListing(...args),
    getSellerChannels: (...args: any[]) => mockGetSellerChannels(...args),
    getSellerChannelById: (...args: any[]) => mockGetSellerChannelById(...args),
    updateSellerChannel: (...args: any[]) => mockUpdateSellerChannel(...args),
    submitChannelForReview: (...args: any[]) => mockSubmitChannelForReview(...args),
    unpublishSellerChannel: (...args: any[]) => mockUnpublishSellerChannel(...args),
    deleteSellerChannel: (...args: any[]) => mockDeleteSellerChannel(...args),
  };
});

import type { Request, Response, NextFunction } from 'express';
import {
  createListing,
  getSellerListings,
  getSellerListingById,
  updateListing,
  submitForReview,
  unpublishListing,
  deleteListing,
} from '../../src/controllers/channel.controller.js';
import {
  ChannelValidationError,
  ChannelNotFoundError,
  ChannelForbiddenError,
} from '../../src/services/channel.service.js';
import channelRoutes from '../../src/routes/channel.routes.js';
import { requireAuth } from '../../src/middleware/auth.middleware.js';

describe('Seller Channel Controller & Routes (/api/v1/channels/mine)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;
  let statusMock: any;
  let jsonMock: any;

  const validSellerId = '507f1f77bcf86cd799439011';
  const otherSellerId = '507f1f77bcf86cd799439022';
  const validChannelId = '670c5e7b8f1a2b3c4d5e6f7a';

  const sampleChannel = {
    id: validChannelId,
    name: 'Tech Frontier',
    handle: '@techfrontier',
    youtubeUrl: 'https://youtube.com/@techfrontier',
    niche: 'Technology & Gadgets',
    subscribersCount: 150000,
    monthlyViewsCount: 800000,
    monetized: true,
    verifiedAnalytics: false,
    priceCents: 1200000,
    description: 'A growing tech channel covering gadgets and hardware.',
    featuredBadge: null,
    status: 'DRAFT',
    isPublished: false,
    sellerId: validSellerId,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
  };

  const validCreateBody = {
    name: 'Tech Frontier',
    handle: '@techfrontier',
    youtubeUrl: 'https://youtube.com/@techfrontier',
    niche: 'Technology & Gadgets',
    subscribersCount: 150000,
    monthlyViewsCount: 800000,
    monetized: true,
    priceUsd: 12000,
    description: 'A growing tech channel covering gadgets and hardware.',
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
      body: {},
      headers: {},
      user: {
        sub: validSellerId,
        role: 'USER',
      },
    };
    nextFunction = vi.fn();

    mockCreateChannelListing.mockReset();
    mockGetSellerChannels.mockReset();
    mockGetSellerChannelById.mockReset();
    mockUpdateSellerChannel.mockReset();
    mockSubmitChannelForReview.mockReset();
    mockUnpublishSellerChannel.mockReset();
    mockDeleteSellerChannel.mockReset();

    mockCreateChannelListing.mockResolvedValue(sampleChannel);
    mockGetSellerChannels.mockResolvedValue([sampleChannel]);
    mockGetSellerChannelById.mockResolvedValue(sampleChannel);
    mockUpdateSellerChannel.mockResolvedValue({ ...sampleChannel, name: 'Tech Frontier Pro' });
    mockSubmitChannelForReview.mockResolvedValue({ ...sampleChannel, status: 'PENDING_REVIEW' });
    mockUnpublishSellerChannel.mockResolvedValue({ ...sampleChannel, status: 'DELISTED', isPublished: false });
    mockDeleteSellerChannel.mockResolvedValue({ success: true, id: validChannelId });
  });

  // =========================================================================
  // 1. Unauthenticated Requests Rejected for Every Seller Endpoint
  // =========================================================================
  describe('1. Unauthenticated access enforcement', () => {
    const endpoints: Array<{ name: string; handler: Function; params?: Record<string, string>; body?: any }> = [
      { name: 'POST /mine (createListing)', handler: createListing, body: validCreateBody },
      { name: 'GET /mine (getSellerListings)', handler: getSellerListings },
      { name: 'GET /mine/:id (getSellerListingById)', handler: getSellerListingById, params: { id: validChannelId } },
      { name: 'PATCH /mine/:id (updateListing)', handler: updateListing, params: { id: validChannelId }, body: { name: 'Updated' } },
      { name: 'POST /mine/:id/submit (submitForReview)', handler: submitForReview, params: { id: validChannelId } },
      { name: 'POST /mine/:id/unpublish (unpublishListing)', handler: unpublishListing, params: { id: validChannelId } },
      { name: 'DELETE /mine/:id (deleteListing)', handler: deleteListing, params: { id: validChannelId } },
    ];

    endpoints.forEach(({ name, handler, params, body }) => {
      it(`should return 401 Unauthorized for ${name} when req.user is missing`, async () => {
        mockReq.user = undefined;
        mockReq.params = params || {};
        mockReq.body = body || {};

        await handler(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: 'Unauthorized',
          })
        );
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it(`should return 401 Unauthorized for ${name} when req.user.sub is malformed`, async () => {
        mockReq.user = { sub: 'invalid-non-hex-id', role: 'USER' };
        mockReq.params = params || {};
        mockReq.body = body || {};

        await handler(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: 'Unauthorized',
          })
        );
        expect(nextFunction).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 2. Seller ID Derived Strictly from Authenticated Context (req.user.sub)
  // =========================================================================
  describe('2. Seller ID context isolation', () => {
    it('createListing: should pass authenticated sellerId and reject sellerId in body', async () => {
      // Body containing unauthorized sellerId field should be rejected by strict schema
      mockReq.body = { ...validCreateBody, sellerId: otherSellerId };

      await createListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockCreateChannelListing).not.toHaveBeenCalled();
    });

    it('createListing: should pass req.user.sub to service function on valid input', async () => {
      mockReq.body = validCreateBody;

      await createListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockCreateChannelListing).toHaveBeenCalledWith(validSellerId, expect.any(Object));
      expect(mockCreateChannelListing).toHaveBeenCalledWith(
        validSellerId,
        expect.not.objectContaining({ sellerId: expect.anything() })
      );
    });

    it('getSellerListings: should query channels exclusively using req.user.sub', async () => {
      await getSellerListings(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockGetSellerChannels).toHaveBeenCalledWith(validSellerId);
    });

    it('getSellerListingById: should scope lookup strictly to req.user.sub', async () => {
      mockReq.params = { id: validChannelId };

      await getSellerListingById(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockGetSellerChannelById).toHaveBeenCalledWith(validSellerId, validChannelId);
    });

    it('updateListing: should pass req.user.sub to updateSellerChannel and reject body sellerId', async () => {
      mockReq.params = { id: validChannelId };
      mockReq.body = { name: 'Valid Update', sellerId: otherSellerId };

      await updateListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockUpdateSellerChannel).not.toHaveBeenCalled();
    });

    it('submitForReview: should pass req.user.sub to submitChannelForReview', async () => {
      mockReq.params = { id: validChannelId };

      await submitForReview(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockSubmitChannelForReview).toHaveBeenCalledWith(validSellerId, validChannelId);
    });

    it('unpublishListing: should pass req.user.sub to unpublishSellerChannel', async () => {
      mockReq.params = { id: validChannelId };

      await unpublishListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockUnpublishSellerChannel).toHaveBeenCalledWith(validSellerId, validChannelId);
    });

    it('deleteListing: should pass req.user.sub to deleteSellerChannel', async () => {
      mockReq.params = { id: validChannelId };

      await deleteListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockDeleteSellerChannel).toHaveBeenCalledWith(validSellerId, validChannelId);
    });
  });

  // =========================================================================
  // 3. Malformed Channel IDs Rejected Before Service Calls
  // =========================================================================
  describe('3. Route parameter validation (:id)', () => {
    const parameterizedEndpoints = [
      { name: 'getSellerListingById', handler: getSellerListingById, mock: mockGetSellerChannelById },
      { name: 'updateListing', handler: updateListing, mock: mockUpdateSellerChannel, body: { name: 'New Name' } },
      { name: 'submitForReview', handler: submitForReview, mock: mockSubmitChannelForReview },
      { name: 'unpublishListing', handler: unpublishListing, mock: mockUnpublishSellerChannel },
      { name: 'deleteListing', handler: deleteListing, mock: mockDeleteSellerChannel },
    ];

    const malformedIds = [
      '123',
      'not-an-object-id',
      '507f1f77bcf86cd79943901112345', // 29 chars (too long)
      '507f1f77bcf86cd79943901',       // 23 chars (too short)
      '507f1f77bcf86cd79943901z',       // non-hex character 'z'
      '                        ',       // whitespace only
      '',                               // empty string
    ];

    parameterizedEndpoints.forEach(({ name, handler, mock, body }) => {
      malformedIds.forEach((badId) => {
        it(`${name}: should reject malformed channel ID "${badId}" with 400 before service call`, async () => {
          mockReq.params = { id: badId };
          if (body) mockReq.body = body;

          await handler(mockReq as Request, mockRes as Response, nextFunction);

          expect(statusMock).toHaveBeenCalledWith(400);
          expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
              success: false,
              message: expect.stringMatching(/invalid channel id format/i),
            })
          );
          expect(mock).not.toHaveBeenCalled();
        });
      });
    });
  });

  // =========================================================================
  // 4. Request Body Validation for Create and Update
  // =========================================================================
  describe('4. Request body validation', () => {
    describe('createListing body validation', () => {
      it('should reject empty body with 400', async () => {
        mockReq.body = {};

        await createListing(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(mockCreateChannelListing).not.toHaveBeenCalled();
      });

      it('should reject missing channel name with 400', async () => {
        const { name: _, ...missingName } = validCreateBody;
        mockReq.body = missingName;

        await createListing(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(mockCreateChannelListing).not.toHaveBeenCalled();
      });

      it('should reject invalid YouTube handle format with 400', async () => {
        mockReq.body = { ...validCreateBody, handle: 'bad handle with spaces!!' };

        await createListing(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(mockCreateChannelListing).not.toHaveBeenCalled();
      });

      it('should reject negative price with 400', async () => {
        mockReq.body = { ...validCreateBody, priceUsd: -50 };

        await createListing(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(mockCreateChannelListing).not.toHaveBeenCalled();
      });

      it('should reject price with more than 2 decimal places with 400', async () => {
        mockReq.body = { ...validCreateBody, priceUsd: 199.999 };

        await createListing(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(mockCreateChannelListing).not.toHaveBeenCalled();
      });

      it('should reject admin/lifecycle fields injected in body with 400', async () => {
        mockReq.body = {
          ...validCreateBody,
          status: 'AVAILABLE',
          isPublished: true,
          featuredBadge: 'Staff Pick',
        };

        await createListing(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(mockCreateChannelListing).not.toHaveBeenCalled();
      });
    });

    describe('updateListing body validation', () => {
      it('should reject empty update body with 400', async () => {
        mockReq.params = { id: validChannelId };
        mockReq.body = {};

        await updateListing(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(mockUpdateSellerChannel).not.toHaveBeenCalled();
      });

      it('should reject protected lifecycle status field in update body with 400', async () => {
        mockReq.params = { id: validChannelId };
        mockReq.body = { status: 'AVAILABLE' };

        await updateListing(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(mockUpdateSellerChannel).not.toHaveBeenCalled();
      });

      it('should reject isPublished flag in update body with 400', async () => {
        mockReq.params = { id: validChannelId };
        mockReq.body = { isPublished: true };

        await updateListing(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(mockUpdateSellerChannel).not.toHaveBeenCalled();
      });

      it('should reject invalid price with > 2 decimal places in update body with 400', async () => {
        mockReq.params = { id: validChannelId };
        mockReq.body = { priceUsd: 1500.123 };

        await updateListing(mockReq as Request, mockRes as Response, nextFunction);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(mockUpdateSellerChannel).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 5. Successful Requests Return Envelope & Expected Status Codes
  // =========================================================================
  describe('5. Successful requests & response envelopes', () => {
    it('POST /mine: returns 201 with created channel in data envelope', async () => {
      mockReq.body = validCreateBody;

      await createListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Channel listing created successfully.',
        data: { channel: sampleChannel },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('GET /mine: returns 200 with channels array in data envelope', async () => {
      await getSellerListings(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Seller channels retrieved successfully.',
        data: { channels: [sampleChannel] },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('GET /mine/:id: returns 200 with single channel in data envelope', async () => {
      mockReq.params = { id: validChannelId };

      await getSellerListingById(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Channel retrieved successfully.',
        data: { channel: sampleChannel },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('PATCH /mine/:id: returns 200 with updated channel in data envelope', async () => {
      mockReq.params = { id: validChannelId };
      mockReq.body = { name: 'Tech Frontier Pro' };

      await updateListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Channel listing updated successfully.',
        data: { channel: { ...sampleChannel, name: 'Tech Frontier Pro' } },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('POST /mine/:id/submit: returns 200 with pending review channel in data envelope', async () => {
      mockReq.params = { id: validChannelId };

      await submitForReview(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Channel submitted for review successfully.',
        data: { channel: { ...sampleChannel, status: 'PENDING_REVIEW' } },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('POST /mine/:id/unpublish: returns 200 with delisted channel in data envelope', async () => {
      mockReq.params = { id: validChannelId };

      await unpublishListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Channel unpublished successfully.',
        data: { channel: { ...sampleChannel, status: 'DELISTED', isPublished: false } },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('DELETE /mine/:id: returns 200 with deletion result in data envelope', async () => {
      mockReq.params = { id: validChannelId };

      await deleteListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Channel listing deleted successfully.',
        data: { success: true, id: validChannelId },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. Missing or Non-Owned Listings Follow 404 / 403 Conventions
  // =========================================================================
  describe('6. Missing and non-owned listing authorization', () => {
    it('GET /mine/:id: returns 404 when channel is not found or owned by another seller', async () => {
      mockReq.params = { id: validChannelId };
      mockGetSellerChannelById.mockResolvedValue(null);

      await getSellerListingById(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Channel not found',
        })
      );
    });

    it('PATCH /mine/:id: returns 404 when service throws ChannelNotFoundError', async () => {
      mockReq.params = { id: validChannelId };
      mockReq.body = { name: 'Valid Edit' };
      mockUpdateSellerChannel.mockRejectedValue(new ChannelNotFoundError('Channel not found'));

      await updateListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Channel not found',
        })
      );
    });

    it('PATCH /mine/:id: returns 403 when service throws ChannelForbiddenError (ownership mismatch)', async () => {
      mockReq.params = { id: validChannelId };
      mockReq.body = { name: 'Valid Edit' };
      mockUpdateSellerChannel.mockRejectedValue(
        new ChannelForbiddenError('Forbidden: You do not have permission to update this channel')
      );

      await updateListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/forbidden/i),
        })
      );
    });

    it('POST /mine/:id/submit: returns 403 when user does not own the channel', async () => {
      mockReq.params = { id: validChannelId };
      mockSubmitChannelForReview.mockRejectedValue(
        new ChannelForbiddenError('Forbidden: You do not have permission to submit this channel for review')
      );

      await submitForReview(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/forbidden/i),
        })
      );
    });

    it('POST /mine/:id/unpublish: returns 403 when user does not own the channel', async () => {
      mockReq.params = { id: validChannelId };
      mockUnpublishSellerChannel.mockRejectedValue(
        new ChannelForbiddenError('Forbidden: You do not have permission to unpublish this channel')
      );

      await unpublishListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/forbidden/i),
        })
      );
    });

    it('DELETE /mine/:id: returns 403 when user does not own the channel', async () => {
      mockReq.params = { id: validChannelId };
      mockDeleteSellerChannel.mockRejectedValue(
        new ChannelForbiddenError('Forbidden: You do not have permission to delete this channel')
      );

      await deleteListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/forbidden/i),
        })
      );
    });
  });

  // =========================================================================
  // 7. Error Handling: Validation, State, and Unexpected Errors
  // =========================================================================
  describe('7. Centralized error handling & service error translation', () => {
    it('should map ChannelValidationError to 400 Bad Request', async () => {
      mockReq.params = { id: validChannelId };
      mockSubmitChannelForReview.mockRejectedValue(
        new ChannelValidationError('Cannot submit channel with status "AVAILABLE" for review. Only DRAFT channels can be submitted.')
      );

      await submitForReview(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/only draft channels can be submitted/i),
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should forward unexpected database errors to next(error) without responding directly', async () => {
      mockReq.body = validCreateBody;
      const dbError = new Error('Database connection reset');
      mockCreateChannelListing.mockRejectedValue(dbError);

      await createListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(dbError);
      expect(statusMock).not.toHaveBeenCalled();
      expect(jsonMock).not.toHaveBeenCalled();
    });

    it('should forward unexpected errors in deleteListing to next(error)', async () => {
      mockReq.params = { id: validChannelId };
      const internalError = new Error('Unexpected Prisma crash');
      mockDeleteSellerChannel.mockRejectedValue(internalError);

      await deleteListing(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(internalError);
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 8. Route Mounting, Authentication Middleware & Ordering
  // =========================================================================
  describe('8. Route mounting, requireAuth, and collision prevention', () => {
    it('should ensure all 7 seller endpoints have requireAuth attached', () => {
      const sellerRouteEntries = [
        { path: '/mine', method: 'post' },
        { path: '/mine', method: 'get' },
        { path: '/mine/:id', method: 'get' },
        { path: '/mine/:id', method: 'patch' },
        { path: '/mine/:id/submit', method: 'post' },
        { path: '/mine/:id/unpublish', method: 'post' },
        { path: '/mine/:id', method: 'delete' },
      ];

      sellerRouteEntries.forEach(({ path, method }) => {
        const routeLayer = channelRoutes.stack.find(
          (layer: any) => layer.route && layer.route.path === path && layer.route.methods[method]
        );

        expect(routeLayer, `Route ${method.toUpperCase()} ${path} should be registered`).toBeDefined();
        const handlers = routeLayer.route.stack.map((s: any) => s.handle);
        expect(handlers, `Route ${method.toUpperCase()} ${path} must include requireAuth`).toContain(requireAuth);
      });
    });

    it('should ensure all seller routes precede the parameterized /:id route to prevent route collision', () => {
      const sellerRouteIndices = channelRoutes.stack
        .map((layer: any, idx: number) => ({ layer, idx }))
        .filter(({ layer }) => layer.route && layer.route.path.startsWith('/mine'))
        .map(({ idx }) => idx);

      const publicIdRouteIndex = channelRoutes.stack.findIndex(
        (layer: any) => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      );

      expect(sellerRouteIndices.length).toBe(7);
      expect(publicIdRouteIndex).toBeGreaterThan(-1);

      // Every seller route MUST be registered before the public /:id route
      sellerRouteIndices.forEach((sellerIdx) => {
        expect(sellerIdx).toBeLessThan(publicIdRouteIndex);
      });
    });

    it('should verify public routes (/ and /:id) remain unauthenticated', () => {
      const getRoot = channelRoutes.stack.find(
        (layer: any) => layer.route && layer.route.path === '/' && layer.route.methods.get
      );
      const getId = channelRoutes.stack.find(
        (layer: any) => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      );

      expect(getRoot).toBeDefined();
      expect(getId).toBeDefined();

      const rootHandlers = getRoot.route.stack.map((s: any) => s.handle);
      const idHandlers = getId.route.stack.map((s: any) => s.handle);

      expect(rootHandlers).not.toContain(requireAuth);
      expect(idHandlers).not.toContain(requireAuth);
    });
  });
});

import { vi } from 'vitest';
import { registerTestPrismaClient } from '../../src/config/prisma.js';

export const mockUserFindUnique = vi.fn();

const mockPrisma = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn(),
  user: {
    findUnique: mockUserFindUnique,
  },
};

registerTestPrismaClient(mockPrisma as any);

import { describe, it, expect, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { getMe } from '../../src/controllers/auth.controller.js';
import { requireAuth } from '../../src/middleware/auth.middleware.js';
import authRouter from '../../src/routes/auth.routes.js';

describe('GET /api/v1/auth/me Controller & Route', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;
  let statusMock: any;
  let jsonMock: any;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
    };
    mockReq = {
      headers: {},
      user: undefined,
    };
    nextFunction = vi.fn();
    mockUserFindUnique.mockReset();
  });

  describe('requireAuth Middleware protection', () => {
    it('should return 401 if Authorization header is missing', () => {
      mockReq.headers = {};

      requireAuth(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Authorization header is missing',
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if token is malformed', () => {
      mockReq.headers = { authorization: 'Bearer malformed.token.value' };

      requireAuth(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Invalid or expired token',
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('getMe controller logic', () => {
    it('should return 401 if req.user is missing or sub is undefined', async () => {
      mockReq.user = undefined;

      await getMe(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Unauthorized',
        })
      );
    });

    it('should return 401 if req.user.sub is not a valid 24-hex MongoDB ObjectId', async () => {
      mockReq.user = {
        sub: 'not-a-valid-object-id',
        role: 'USER',
      };

      await getMe(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Unauthorized',
        })
      );
      // Ensures no database lookup occurs for invalid format
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it('should return 200 and the safe user profile for authenticated user', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const mockUser = {
        id: validObjectId,
        name: 'Creator Morgan',
        email: 'creator@example.com',
        role: 'USER',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      };

      mockUserFindUnique.mockResolvedValue(mockUser);

      mockReq.user = {
        sub: validObjectId,
        role: 'USER',
      };

      await getMe(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: validObjectId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'User profile retrieved successfully.',
        data: {
          user: mockUser,
        },
      });

      // Verify sensitive fields are strictly absent
      const responseData = jsonMock.mock.calls[0][0];
      expect(responseData.data.user).not.toHaveProperty('passwordHash');
      expect(responseData.data).not.toHaveProperty('accessToken');
      expect(responseData.data).not.toHaveProperty('token');
      expect(responseData.data.user).not.toHaveProperty('googleId');
    });

    it('should return 404 if a valid ObjectId user cannot be found in the database', async () => {
      const validNonExistentId = '507f1f77bcf86cd799439012';
      mockUserFindUnique.mockResolvedValue(null);

      mockReq.user = {
        sub: validNonExistentId,
        role: 'USER',
      };

      await getMe(mockReq as Request, mockRes as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'User not found',
        })
      );
    });

    it('should pass database errors to next() without exposing internals directly', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const dbError = new Error('Database connection failed');
      mockUserFindUnique.mockRejectedValue(dbError);

      mockReq.user = {
        sub: validObjectId,
        role: 'USER',
      };

      await getMe(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(dbError);
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('Route registration verification', () => {
    it('should have GET /me registered with requireAuth and getMe handlers in authRouter', () => {
      const meRoute = authRouter.stack.find(
        (layer: any) => layer.route && layer.route.path === '/me' && layer.route.methods.get
      );

      expect(meRoute).toBeDefined();
      expect(meRoute.route.stack.length).toBeGreaterThanOrEqual(2);

      // Verify that requireAuth and getMe are in the route handler stack
      const handlers = meRoute.route.stack.map((s: any) => s.handle);
      expect(handlers).toContain(requireAuth);
      expect(handlers).toContain(getMe);
    });
  });
});

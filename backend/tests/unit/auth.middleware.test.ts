import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../src/middleware/auth.middleware.js';
import { signAccessToken } from '../../src/utils/auth/jwt.js';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config/env.js';

describe('requireAuth Middleware', () => {
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
    };
    nextFunction = vi.fn();
  });

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

  it('should return 401 if Authorization header is malformed (not Bearer format)', () => {
    mockReq.headers = { authorization: 'Basic some-credentials' };

    requireAuth(mockReq as Request, mockRes as Response, nextFunction);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Authorization header format must be Bearer <token>',
      })
    );
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 if Bearer token is missing a token segment', () => {
    mockReq.headers = { authorization: 'Bearer' };

    requireAuth(mockReq as Request, mockRes as Response, nextFunction);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Authorization header format must be Bearer <token>',
      })
    );
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 if token has too many parts', () => {
    mockReq.headers = { authorization: 'Bearer token1 token2' };

    requireAuth(mockReq as Request, mockRes as Response, nextFunction);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Authorization header format must be Bearer <token>',
      })
    );
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid or malformed', () => {
    mockReq.headers = { authorization: 'Bearer invalid.token.value' };

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

  it('should return 401 if token signature is tampered', () => {
    const validToken = signAccessToken({ sub: 'user-123', role: 'USER' });
    const tampered = validToken.substring(0, validToken.length - 5) + 'xxxxx';
    mockReq.headers = { authorization: `Bearer ${tampered}` };

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

  it('should return 401 if token is expired', () => {
    const expiredToken = jwt.sign(
      { sub: 'user-expired', role: 'USER' },
      config.jwtAccessSecret,
      {
        algorithm: 'HS256',
        expiresIn: '-1s',
      }
    );
    mockReq.headers = { authorization: `Bearer ${expiredToken}` };

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

  it('should return 401 if token uses an unsupported algorithm (e.g. HS512)', () => {
    const tokenHS512 = jwt.sign(
      { sub: 'user-hs512', role: 'USER' },
      config.jwtAccessSecret,
      {
        algorithm: 'HS512',
      }
    );
    mockReq.headers = { authorization: `Bearer ${tokenHS512}` };

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

  it('should succeed, attach req.user, and call next() for a valid token', () => {
    const payload = { sub: 'usr-456', role: 'ADMIN' };
    const validToken = signAccessToken(payload);
    mockReq.headers = { authorization: `Bearer ${validToken}` };

    requireAuth(mockReq as Request, mockRes as Response, nextFunction);

    expect(statusMock).not.toHaveBeenCalled();
    expect(nextFunction).toHaveBeenCalledTimes(1);
    expect(mockReq.user).toEqual({
      sub: 'usr-456',
      role: 'ADMIN',
    });
  });
});

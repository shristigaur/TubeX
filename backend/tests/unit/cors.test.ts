import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { parseAllowedOrigins } from '../../src/config/env.js';
import { isOriginAllowed, corsMiddleware, handleCorsError } from '../../src/middleware/security/cors.js';

describe('CORS Configuration & Origin Matching', () => {
  describe('parseAllowedOrigins', () => {
    it('should fall back to default http://localhost:3000 when both env vars are absent', () => {
      const origins = parseAllowedOrigins(undefined, undefined);
      expect(origins).toEqual(['http://localhost:3000']);
    });

    it('should use FRONTEND_URL when FRONTEND_URLS is absent', () => {
      const origins = parseAllowedOrigins(undefined, 'https://app.tubex.com');
      expect(origins).toEqual(['https://app.tubex.com']);
    });

    it('should parse a single origin from FRONTEND_URLS', () => {
      const origins = parseAllowedOrigins('https://tubex.io', 'http://localhost:3000');
      expect(origins).toEqual(['https://tubex.io']);
    });

    it('should parse multiple comma-separated origins from FRONTEND_URLS', () => {
      const origins = parseAllowedOrigins('http://localhost:3000,http://localhost:3001', undefined);
      expect(origins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    });

    it('should trim surrounding whitespace from each origin entry', () => {
      const origins = parseAllowedOrigins('  http://localhost:3000  ,  http://localhost:3001   ', undefined);
      expect(origins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    });

    it('should ignore empty entries between commas and never produce an empty-string wildcard', () => {
      const origins = parseAllowedOrigins('http://localhost:3000, , ,, http://localhost:3001,', undefined);
      expect(origins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
      expect(origins).not.toContain('');
    });

    it('should fall back to FRONTEND_URL when FRONTEND_URLS contains only whitespace and commas', () => {
      const origins = parseAllowedOrigins('   , ,   ', 'http://localhost:3000');
      expect(origins).toEqual(['http://localhost:3000']);
    });

    it('should fall back to default http://localhost:3000 when both FRONTEND_URLS and FRONTEND_URL are whitespace only', () => {
      const origins = parseAllowedOrigins('  ', '   ');
      expect(origins).toEqual(['http://localhost:3000']);
    });
  });

  describe('isOriginAllowed', () => {
    const allowed = ['http://localhost:3000', 'http://localhost:3001', 'https://tubex.com'];

    it('should allow requests with no origin (non-browser clients, server-to-server, curl)', () => {
      expect(isOriginAllowed(undefined, allowed)).toBe(true);
    });

    it('should allow exact matching origins', () => {
      expect(isOriginAllowed('http://localhost:3000', allowed)).toBe(true);
      expect(isOriginAllowed('http://localhost:3001', allowed)).toBe(true);
      expect(isOriginAllowed('https://tubex.com', allowed)).toBe(true);
    });

    it('should reject unlisted origins', () => {
      expect(isOriginAllowed('http://localhost:3002', allowed)).toBe(false);
      expect(isOriginAllowed('https://malicious-site.com', allowed)).toBe(false);
    });

    it('should reject substring attempts and domain spoofing', () => {
      expect(isOriginAllowed('http://localhost:3000.attacker.com', allowed)).toBe(false);
      expect(isOriginAllowed('https://tubex.com.attacker.com', allowed)).toBe(false);
      expect(isOriginAllowed('http://localhost:300', allowed)).toBe(false);
    });

    it('should reject protocol / scheme mismatches', () => {
      expect(isOriginAllowed('https://localhost:3000', allowed)).toBe(false);
      expect(isOriginAllowed('http://tubex.com', allowed)).toBe(false);
    });

    it('should reject empty string origins', () => {
      expect(isOriginAllowed('', allowed)).toBe(false);
    });
  });

  describe('corsMiddleware & handleCorsError', () => {
    it('should call next() without error for an allowed origin', () => {
      const req = {
        method: 'GET',
        headers: {
          origin: 'http://localhost:3000',
        },
      } as unknown as Request;
      const res = {
        setHeader: vi.fn(),
        getHeader: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      corsMiddleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should pass an error to next() for a disallowed origin', () => {
      const req = {
        method: 'GET',
        headers: {
          origin: 'http://evil.com',
        },
      } as unknown as Request;
      const res = {
        setHeader: vi.fn(),
        getHeader: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      corsMiddleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const passedError = next.mock.calls[0][0];
      expect(passedError.message).toBe('Not allowed by CORS');
    });

    it('should return HTTP 403 from handleCorsError when error is Not allowed by CORS', () => {
      const err = new Error('Not allowed by CORS');
      const req = {} as Request;
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res = { status: statusMock } as unknown as Response;
      const next = vi.fn();

      handleCorsError(err, req, res, next);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Origin not allowed by CORS',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should forward non-CORS errors to the next error handler in handleCorsError', () => {
      const err = new Error('Database timeout');
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn();

      handleCorsError(err, req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});

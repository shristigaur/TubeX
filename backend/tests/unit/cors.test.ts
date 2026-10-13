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

    it('should normalize trailing slashes from configured origins in FRONTEND_URLS', () => {
      const origins = parseAllowedOrigins('https://tubex.market/,http://localhost:3000///', undefined);
      expect(origins).toEqual(['https://tubex.market', 'http://localhost:3000']);
    });

    it('should normalize trailing slashes from FRONTEND_URL fallback', () => {
      const origins = parseAllowedOrigins(undefined, 'https://app.tubex.market/');
      expect(origins).toEqual(['https://app.tubex.market']);
    });

    it('should normalize origins with both surrounding whitespace and trailing slashes', () => {
      const origins = parseAllowedOrigins('  https://tubex.market/  ,  http://localhost:3001/   ', undefined);
      expect(origins).toEqual(['https://tubex.market', 'http://localhost:3001']);
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

    it('should allow browser origin without trailing slash when configured with trailing slash and parsed', () => {
      const parsedOrigins = parseAllowedOrigins('https://tubex.market/', undefined);
      expect(isOriginAllowed('https://tubex.market', parsedOrigins)).toBe(true);
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

    it('should reject null origin (sandboxed iframes, privacy contexts)', () => {
      expect(isOriginAllowed('null', allowed)).toBe(false);
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

    describe('OPTIONS preflight requests', () => {
      it('should handle preflight request for an allowed origin by ending response with HTTP 204', () => {
        const req = {
          method: 'OPTIONS',
          headers: {
            origin: 'http://localhost:3000',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'Content-Type, Authorization',
          },
        } as unknown as Request;
        const res = {
          statusCode: 200,
          setHeader: vi.fn(),
          getHeader: vi.fn(),
          end: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        corsMiddleware(req, res, next);

        expect(res.statusCode).toBe(204);
        expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Length', '0');
        expect(res.end).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
      });

      it('should advertise configured allowed methods for preflight requests', () => {
        const req = {
          method: 'OPTIONS',
          headers: {
            origin: 'http://localhost:3000',
            'access-control-request-method': 'DELETE',
          },
        } as unknown as Request;
        const res = {
          statusCode: 200,
          setHeader: vi.fn(),
          getHeader: vi.fn(),
          end: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        corsMiddleware(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith(
          'Access-Control-Allow-Methods',
          'GET,POST,PUT,DELETE,PATCH,OPTIONS'
        );
      });

      it('should advertise configured allowed headers and not reflect arbitrary requested headers', () => {
        const req = {
          method: 'OPTIONS',
          headers: {
            origin: 'http://localhost:3000',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'Content-Type, Authorization, X-Disallowed-Header',
          },
        } as unknown as Request;
        const res = {
          statusCode: 200,
          setHeader: vi.fn(),
          getHeader: vi.fn(),
          end: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        corsMiddleware(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith(
          'Access-Control-Allow-Headers',
          'Content-Type,Authorization'
        );
      });

      it('should pass an error to next() and not end the response for a disallowed origin making an OPTIONS request', () => {
        const req = {
          method: 'OPTIONS',
          headers: {
            origin: 'https://malicious-site.com',
            'access-control-request-method': 'POST',
          },
        } as unknown as Request;
        const res = {
          statusCode: 200,
          setHeader: vi.fn(),
          getHeader: vi.fn(),
          end: vi.fn(),
        } as unknown as Response;
        const next = vi.fn();

        corsMiddleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
        const passedError = next.mock.calls[0][0];
        expect(passedError.message).toBe('Not allowed by CORS');
        expect(res.end).not.toHaveBeenCalled();
        expect(res.setHeader).not.toHaveBeenCalledWith(
          'Access-Control-Allow-Origin',
          'https://malicious-site.com'
        );
      });
    });
  });
});

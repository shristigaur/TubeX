import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken, JWT_ALGORITHM } from '../../src/utils/auth/jwt.js';
import { config } from '../../src/config/env.js';

// Note: JWT tests rely on process.env.JWT_ACCESS_SECRET being set in tests/setup.ts
describe('JWT Utility', () => {
  it('should sign a token using HS256 algorithm and successfully verify it', () => {
    const payload = { sub: 'user-123', role: 'USER' };
    const token = signAccessToken(payload);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    
    // Verify algorithm header is pinned to HS256
    const decodedComplete = jwt.decode(token, { complete: true });
    expect(decodedComplete?.header.alg).toBe(JWT_ALGORITHM);
    expect(decodedComplete?.header.alg).toBe('HS256');

    // Verify payload
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-123');
    expect(decoded.role).toBe('USER');
  });

  it('should reject a token signed with an unsupported algorithm (e.g. HS512)', () => {
    const payload = { sub: 'user-attacker', role: 'ADMIN' };
    const unsupportedToken = jwt.sign(payload, config.jwtAccessSecret, {
      algorithm: 'HS512',
    });

    expect(() => verifyAccessToken(unsupportedToken)).toThrow('Invalid or expired token');
  });

  it('should reject a token with "none" algorithm', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'user-none', role: 'ADMIN' })).toString('base64url');
    const unsignedToken = `${header}.${payload}.`;

    expect(() => verifyAccessToken(unsignedToken)).toThrow('Invalid or expired token');
  });

  it('should throw an error for a malformed token', () => {
    expect(() => verifyAccessToken('malformed.token.string')).toThrow('Invalid or expired token');
  });

  it('should throw an error for an invalid/tampered signature', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'USER' });
    const parts = token.split('.');
    // Tamper with the signature
    const tamperedToken = `${parts[0]}.${parts[1]}.invalid_sig`;
    
    expect(() => verifyAccessToken(tamperedToken)).toThrow('Invalid or expired token');
  });

  it('should reject an expired token', () => {
    const expiredToken = jwt.sign(
      { sub: 'user-expired', role: 'USER' },
      config.jwtAccessSecret,
      {
        algorithm: 'HS256',
        expiresIn: '-1s',
      }
    );

    expect(() => verifyAccessToken(expiredToken)).toThrow('Invalid or expired token');
  });
});

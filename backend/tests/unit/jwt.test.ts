import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../../src/utils/auth/jwt.js';

// Note: JWT tests rely on process.env.JWT_ACCESS_SECRET being set in tests/setup.ts
describe('JWT Utility', () => {
  it('should sign and verify a valid token', () => {
    const payload = { sub: 'user-123', role: 'USER' };
    const token = signAccessToken(payload);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-123');
    expect(decoded.role).toBe('USER');
  });

  it('should throw an error for a malformed token', () => {
    expect(() => verifyAccessToken('malformed.token.string')).toThrow('Invalid or expired token');
  });

  it('should throw an error for an invalid signature', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'USER' });
    const parts = token.split('.');
    // Tamper with the signature
    const tamperedToken = `${parts[0]}.${parts[1]}.invalid_sig`;
    
    expect(() => verifyAccessToken(tamperedToken)).toThrow('Invalid or expired token');
  });
});

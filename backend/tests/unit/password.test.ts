import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/utils/auth/password.js';

describe('Password Utility', () => {
  it('should hash a password and successfully verify it', async () => {
    const plainText = 'mySecretPassword123!';
    const hash = await hashPassword(plainText);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(plainText);
    
    const isValid = await verifyPassword(plainText, hash);
    expect(isValid).toBe(true);
  });

  it('should fail verification for incorrect password', async () => {
    const plainText = 'correctPassword';
    const hash = await hashPassword(plainText);
    
    const isValid = await verifyPassword('wrongPassword', hash);
    expect(isValid).toBe(false);
  });

  it('should reject empty passwords for hashing', async () => {
    await expect(hashPassword('')).rejects.toThrow('Password cannot be empty');
    await expect(hashPassword('   ')).rejects.toThrow('Password cannot be empty');
  });

  it('should return false when verifying with missing arguments', async () => {
    expect(await verifyPassword('', 'hash')).toBe(false);
    expect(await verifyPassword('pass', '')).toBe(false);
  });
});

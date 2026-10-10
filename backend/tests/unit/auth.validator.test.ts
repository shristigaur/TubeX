import { describe, it, expect } from 'vitest';
import { signupSchema, loginSchema } from '../../src/validators/auth.validator.js';

describe('Auth Validators', () => {
  describe('signupSchema', () => {
    it('should validate and normalize a correct payload', () => {
      const data = {
        name: '  Test User  ',
        email: ' TestUser@EXAMPLE.com ',
        password: 'securePassword123'
      };
      
      const result = signupSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test User');
        expect(result.data.email).toBe('testuser@example.com');
        expect(result.data.password).toBe('securePassword123');
      }
    });

    it('should reject invalid emails', () => {
      const result = signupSchema.safeParse({
        name: 'Test',
        email: 'invalid-email',
        password: 'password123'
      });
      expect(result.success).toBe(false);
    });

    it('should reject short passwords', () => {
      const result = signupSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        password: 'short'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should validate and normalize a correct payload', () => {
      const result = loginSchema.safeParse({
        email: ' LOGIN@Example.com ',
        password: 'password123'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('login@example.com');
      }
    });

    it('should require a password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: ''
      });
      expect(result.success).toBe(false);
    });
  });
});

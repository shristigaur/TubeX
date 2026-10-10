import { describe, it, expect } from 'vitest';
import { validateTestDbUrl } from '../../tests/utils/urlValidator.js';

describe('Database URL Validator', () => {
  const originalUrl = 'mongodb://127.0.0.1:27017/prod_db';

  it('should accept valid local hostnames', () => {
    expect(() => validateTestDbUrl('mongodb://localhost:27017/test_db', originalUrl)).not.toThrow();
    expect(() => validateTestDbUrl('mongodb://127.0.0.1:27017/test_db', originalUrl)).not.toThrow();
    expect(() => validateTestDbUrl('mongodb://0.0.0.0:27017/test_db', originalUrl)).not.toThrow();
    expect(() => validateTestDbUrl('mongodb://[::1]:27017/test_db', originalUrl)).not.toThrow();
  });

  it('should reject remote hostnames', () => {
    expect(() => validateTestDbUrl('mongodb://mongo.remote.com:27017/test_db', originalUrl))
      .toThrow('SAFETY GATE: TEST_DATABASE_URL must target a local disposable instance');
    expect(() => validateTestDbUrl('mongodb://user:pass@cluster0.mongodb.net/test_db', originalUrl))
      .toThrow('SAFETY GATE: TEST_DATABASE_URL must target a local disposable instance');
  });

  it('should reject a remote hostname where localhost is just a query parameter', () => {
    expect(() => validateTestDbUrl('mongodb://remote.com:27017/test_db?authSource=localhost', originalUrl))
      .toThrow('SAFETY GATE: TEST_DATABASE_URL must target a local disposable instance');
  });

  it('should reject malformed URLs', () => {
    expect(() => validateTestDbUrl('not-a-url', originalUrl))
      .toThrow('SAFETY GATE: TEST_DATABASE_URL is malformed or invalid');
  });

  it('should reject unsupported schemes', () => {
    expect(() => validateTestDbUrl('mongodb+srv://localhost/test_db', originalUrl))
      .toThrow('SAFETY GATE: TEST_DATABASE_URL must use the mongodb: protocol');
    expect(() => validateTestDbUrl('http://localhost:27017/test_db', originalUrl))
      .toThrow('SAFETY GATE: TEST_DATABASE_URL must use the mongodb: protocol');
  });

  it('should reject missing test URL', () => {
    expect(() => validateTestDbUrl(undefined, originalUrl))
      .toThrow('SAFETY GATE: ENABLE_DB_TESTS is true, but TEST_DATABASE_URL is not set.');
    expect(() => validateTestDbUrl('', originalUrl))
      .toThrow('SAFETY GATE: ENABLE_DB_TESTS is true, but TEST_DATABASE_URL is not set.');
  });

  it('should reject if test URL maps to the same database as original URL (even with different local aliases)', () => {
    // Same string
    expect(() => validateTestDbUrl('mongodb://127.0.0.1:27017/prod_db', originalUrl))
      .toThrow('SAFETY GATE: TEST_DATABASE_URL maps to the exact same host, port, and database as DATABASE_URL');
    
    // Alias mismatch but same target
    expect(() => validateTestDbUrl('mongodb://localhost:27017/prod_db', originalUrl))
      .toThrow('SAFETY GATE: TEST_DATABASE_URL maps to the exact same host, port, and database as DATABASE_URL');
      
    // IPv6 and 0.0.0.0
    expect(() => validateTestDbUrl('mongodb://0.0.0.0:27017/prod_db', originalUrl))
      .toThrow('SAFETY GATE: TEST_DATABASE_URL maps to the exact same host, port, and database as DATABASE_URL');
    expect(() => validateTestDbUrl('mongodb://[::1]:27017/prod_db', originalUrl))
      .toThrow('SAFETY GATE: TEST_DATABASE_URL maps to the exact same host, port, and database as DATABASE_URL');
  });

  it('should not leak credentials in error messages for invalid remote URL', () => {
    const errorMsg = 'SAFETY GATE: TEST_DATABASE_URL must target a local disposable instance';
    let caughtError: Error | null = null;
    try {
      validateTestDbUrl('mongodb://secretUser:superSecretPassword123@remote.mongodb.net:27017/db', originalUrl);
    } catch (e) {
      caughtError = e as Error;
    }
    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain(errorMsg);
    expect(caughtError?.message).not.toContain('secretUser');
    expect(caughtError?.message).not.toContain('superSecretPassword123');
  });

  it('should handle unparseable originalUrl gracefully', () => {
    expect(() => validateTestDbUrl('mongodb://localhost:27017/test_db', 'invalid-original'))
      .not.toThrow();
  });
});

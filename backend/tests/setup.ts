import { vi } from 'vitest';

// 1. Safe Environment Variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-only-jwt-secret-do-not-use-in-production';
process.env.DATABASE_URL = 'mongodb://blocked-test-db:27017/test-db';

// 2. Database Isolation Mock
// We strictly mock the core @prisma/client library to prevent ANY direct instantiation.
// We preserve other exports (like Prisma errors/types) using importOriginal.
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/client')>();
  
  return {
    ...actual,
    PrismaClient: new Proxy(class {}, {
      construct() {
        throw new Error(
          'DATABASE ISOLATION: Database access is BLOCKED in default unit-test mode. ' +
          'Direct PrismaClient construction is prohibited to protect production data.'
        );
      }
    }),
  };
});

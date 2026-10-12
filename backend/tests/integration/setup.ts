import { afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { validateIntegrationTarget } from './targetValidator.js';
import { registerTestPrismaClient } from '../../src/config/prisma.js';

// 1. Explicit opt-in verification
// Integration tests require explicit opt-in via ENABLE_INTEGRATION_TESTS='true'.
// If opt-in is missing or false, fail immediately with a static message containing no secrets or URIs.
if (process.env.ENABLE_INTEGRATION_TESTS !== 'true') {
  throw new Error(
    'FAIL-CLOSED ISOLATION: Integration tests are disabled. ' +
    'Set ENABLE_INTEGRATION_TESTS=true to execute.'
  );
}

// 2. Snapshot environment targets and validate before construction
// Snapshot the original application DATABASE_URL before any modifications.
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// Validate TEST_DATABASE_URL strictly using the target validator.
// If TEST_DATABASE_URL is absent, malformed, points to a remote host, default port, or collides with DATABASE_URL, this throws immediately.
validateIntegrationTarget(testDatabaseUrl, originalDatabaseUrl);

// 3. Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-only-jwt-secret-do-not-use-in-production';

// Bind process.env.DATABASE_URL strictly to the verified TEST_DATABASE_URL
// This ensures that any module or Prisma schema reading DATABASE_URL receives the test URL.
process.env.DATABASE_URL = testDatabaseUrl;

// Suppress dotenv from re-reading or overriding the active test configuration
try {
  const dotenv = await import('dotenv');
  if (dotenv && typeof dotenv.config === 'function') {
    dotenv.config = () => ({ parsed: {} });
  }
} catch {
  // dotenv not loaded or cannot be intercepted
}

// 4. Explicit Prisma datasource construction and registration
// Construct the integration Prisma client using the exact validated test URI explicitly.
// Do not call $connect() or execute queries here (connection is separated from construction).
const testClient = new PrismaClient({
  datasources: {
    db: {
      url: testDatabaseUrl,
    },
  },
});

// Register the approved disposable test client into the fail-closed registry
registerTestPrismaClient(testClient);

// 5. Deterministic teardown hook
// Disconnects only the approved integration test client.
// Note: If disconnect fails, cleanup in finally is guaranteed, but Vitest hook error handling
// cannot guarantee that earlier test assertion failures are not obscured by the hook failure.
// Raw error details are suppressed from logs to prevent connection string or credential leakage.
afterAll(async () => {
  let disconnectFailed = false;
  try {
    if (testClient) {
      await testClient.$disconnect();
    }
  } catch {
    disconnectFailed = true;
    console.error('FAIL-CLOSED ISOLATION: Test PrismaClient disconnect failed during teardown (details suppressed).');
  } finally {
    // In-memory replica-set lifecycle teardown can be safely added here in a later gate
  }

  if (disconnectFailed) {
    throw new Error('FAIL-CLOSED ISOLATION: Test PrismaClient disconnect failed during teardown.');
  }
});

// Architectural Boundary Note:
// Integration tests must import { prisma } from '../../src/config/prisma.js' or use { testClient }.
// Direct instantiation via `new PrismaClient()` from '@prisma/client' is not blocked by a runtime mock
// in integration mode to avoid interfering with approved client construction. Static enforcement
// should be addressed in a dedicated tooling gate.
export { testClient };


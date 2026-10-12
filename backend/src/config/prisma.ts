import { PrismaClient } from '@prisma/client';

// Private module-scoped symbol to store test client on global object across ES module re-evaluations
const TEST_PRISMA_CLIENT = Symbol.for('tubex.test.prisma.client');

declare global {
  var prisma: PrismaClient | undefined;
  var [TEST_PRISMA_CLIENT]: PrismaClient | undefined;
}

/**
 * Validates that an object structurally implements essential PrismaClient methods.
 * Avoids solely relying on `instanceof PrismaClient`, which can fail across module boundaries/realms.
 */
function isValidPrismaClientShape(candidate: unknown): candidate is PrismaClient {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  const c = candidate as Record<string, unknown>;
  return (
    typeof c.$connect === 'function' &&
    typeof c.$disconnect === 'function' &&
    typeof c.$transaction === 'function'
  );
}

/**
 * Register an approved disposable test PrismaClient.
 * This is strictly allowed only when NODE_ENV === 'test'.
 */
export function registerTestPrismaClient(client: PrismaClient): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('FAIL-CLOSED PRISMA GATE: registerTestPrismaClient is only allowed when NODE_ENV === "test".');
  }
  if (!isValidPrismaClientShape(client)) {
    throw new Error('FAIL-CLOSED PRISMA GATE: Provided candidate does not implement the required PrismaClient interface.');
  }
  if (global[TEST_PRISMA_CLIENT]) {
    throw new Error('FAIL-CLOSED PRISMA GATE: Duplicate test client registration rejected. A test client is already registered.');
  }
  global[TEST_PRISMA_CLIENT] = client;
}

/**
 * Internal resolver ensuring fail-closed client resolution in test mode.
 */
function resolvePrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'test') {
    const testClient = global[TEST_PRISMA_CLIENT];
    if (!testClient) {
      throw new Error(
        'FAIL-CLOSED PRISMA GATE: Direct construction of PrismaClient is strictly blocked in test mode. ' +
        'An approved test client must be explicitly registered via registerTestPrismaClient(...) before importing application modules.'
      );
    }
    return testClient;
  }

  // Normal development and production behavior
  return global.prisma || new PrismaClient();
}

/**
 * In test mode, export a Proxy that defers client resolution until invocation,
 * ensuring fail-closed behavior if accessed before registration.
 * In development and production, export the standard singleton directly to avoid Proxy overhead.
 */
export const prisma: PrismaClient =
  process.env.NODE_ENV === 'test'
    ? new Proxy({} as PrismaClient, {
        get(_target, prop, receiver) {
          const client = resolvePrismaClient();
          const value = Reflect.get(client, prop, receiver);
          if (typeof value === 'function') {
            return value.bind(client);
          }
          return value;
        },
      })
    : (global.prisma || new PrismaClient());

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  global.prisma = prisma;
}



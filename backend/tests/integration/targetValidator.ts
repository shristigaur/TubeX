export function validateIntegrationTarget(
  testUrl: string | undefined,
  productionUrl: string | undefined
): void {
  if (!testUrl || typeof testUrl !== 'string' || testUrl.trim() === '') {
    throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL is not set or empty. Integration tests cannot execute.');
  }

  // Exact string identity comparison against production URL before parsing
  if (productionUrl && typeof productionUrl === 'string' && productionUrl.trim() !== '') {
    if (testUrl.trim() === productionUrl.trim()) {
      throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL is identical to DATABASE_URL. Execution refused.');
    }
  }

  // Explicitly reject multi-host MongoDB URIs
  if (testUrl.includes(',')) {
    throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL specifies multiple hosts. Multi-host replica set URIs are not permitted for disposable integration tests.');
  }

  let parsedTestUrl: URL;
  try {
    parsedTestUrl = new URL(testUrl);
  } catch {
    throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL is malformed or invalid.');
  }

  // Reject multi-host if captured in host or hostname
  if (parsedTestUrl.host.includes(',') || parsedTestUrl.hostname.includes(',')) {
    throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL specifies multiple hosts. Multi-host replica set URIs are not permitted for disposable integration tests.');
  }

  // Enforce protocol: standard MongoDB URI only (never Atlas SRV records)
  if (parsedTestUrl.protocol !== 'mongodb:') {
    throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL must strictly use the mongodb: protocol.');
  }

  // Reject 0.0.0.0 explicitly as an ambiguous bind address
  if (parsedTestUrl.hostname === '0.0.0.0') {
    throw new Error('FAIL-CLOSED ISOLATION: 0.0.0.0 is an ambiguous bind address and cannot be used as a client destination.');
  }

  // Enforce host: explicitly approved loopback destinations only
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (!loopbackHosts.has(parsedTestUrl.hostname)) {
    throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL must target an approved loopback host (localhost, 127.0.0.1, or ::1).');
  }

  // Validate port: non-empty, numeric integer, within 1024-65535, and not default 27017
  const portStr = parsedTestUrl.port;
  if (!portStr || portStr.trim() === '') {
    throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL has no explicit port. Dedicated disposable instance must use an ephemeral non-default port.');
  }

  if (!/^\d+$/.test(portStr)) {
    throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL port must be a valid numeric integer.');
  }

  const portNum = Number.parseInt(portStr, 10);
  if (portNum === 27017) {
    throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL targets default port 27017. Dedicated disposable instance must use an ephemeral non-default port.');
  }

  if (portNum < 1024 || portNum > 65535) {
    throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL port must be an unprivileged ephemeral port between 1024 and 65535.');
  }

  // Database name: must start with "tubex_test_" followed by an allowed non-empty suffix, without extra path segments
  const pathname = parsedTestUrl.pathname;
  if (!/^\/tubex_test_[a-zA-Z0-9_-]+$/.test(pathname)) {
    throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL database name must be explicitly isolated and start with "tubex_test_" followed by an allowed non-empty suffix, without extra path segments.');
  }

  // Resolved component collision comparison against production/development URL
  if (productionUrl && typeof productionUrl === 'string' && productionUrl.trim() !== '') {
    try {
      const parsedProd = new URL(productionUrl);

      // Check for exact hostname match or equivalent approved loopback alias match
      const isTestLoopback = loopbackHosts.has(parsedTestUrl.hostname);
      const isProdLoopback = loopbackHosts.has(parsedProd.hostname);
      const hostsMatch =
        parsedTestUrl.hostname === parsedProd.hostname ||
        (isTestLoopback && isProdLoopback);

      if (
        parsedTestUrl.protocol === parsedProd.protocol &&
        hostsMatch &&
        parsedTestUrl.port === parsedProd.port &&
        parsedTestUrl.pathname === parsedProd.pathname
      ) {
        throw new Error('FAIL-CLOSED ISOLATION: TEST_DATABASE_URL resolves to the same host, port, and database as DATABASE_URL. Execution refused.');
      }
    } catch (err: any) {
      if (err?.message?.includes('FAIL-CLOSED ISOLATION')) {
        throw err;
      }
      // If production URL cannot be parsed by URL constructor, exact string inequality was already verified above.
    }
  }
}

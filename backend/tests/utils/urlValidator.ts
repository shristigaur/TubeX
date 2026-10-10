export function validateTestDbUrl(testUrl: string | undefined, originalUrl: string | undefined): void {
  if (!testUrl) {
    throw new Error('SAFETY GATE: ENABLE_DB_TESTS is true, but TEST_DATABASE_URL is not set.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(testUrl);
  } catch (error) {
    throw new Error('SAFETY GATE: TEST_DATABASE_URL is malformed or invalid.');
  }

  if (parsedUrl.protocol !== 'mongodb:') {
    throw new Error('SAFETY GATE: TEST_DATABASE_URL must use the mongodb: protocol.');
  }

  const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];

  if (!localHosts.includes(parsedUrl.hostname)) {
    throw new Error('SAFETY GATE: TEST_DATABASE_URL must target a local disposable instance (localhost, 127.0.0.1, 0.0.0.0, or ::1).');
  }

  if (originalUrl) {
    let parsedOriginal: URL | null = null;
    try {
      parsedOriginal = new URL(originalUrl);
    } catch {
      // Ignore unparseable originalUrl
    }

    if (parsedOriginal) {
      // We block it if it points to the exact same host, port, and database path.
      // Treat all local aliases as equivalent to prevent bypasses.
      const isParsedUrlLocal = localHosts.includes(parsedUrl.hostname);
      const isOriginalUrlLocal = localHosts.includes(parsedOriginal.hostname);
      
      const hostsMatch = 
        parsedUrl.hostname === parsedOriginal.hostname || 
        (isParsedUrlLocal && isOriginalUrlLocal);

      if (
        hostsMatch &&
        parsedUrl.port === parsedOriginal.port &&
        parsedUrl.pathname === parsedOriginal.pathname
      ) {
        throw new Error('SAFETY GATE: TEST_DATABASE_URL maps to the exact same host, port, and database as DATABASE_URL. This is strictly forbidden.');
      }
    } else if (testUrl === originalUrl) {
      // Fallback string match if originalUrl wasn't parseable but strings are identical
      throw new Error('SAFETY GATE: TEST_DATABASE_URL matches the production/development DATABASE_URL. This is strictly forbidden.');
    }
  }
}

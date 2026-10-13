export function parseAllowedOrigins(
  envFrontendUrls = process.env.FRONTEND_URLS,
  envFrontendUrl = process.env.FRONTEND_URL
): string[] {
  if (typeof envFrontendUrls === 'string') {
    const urls = envFrontendUrls
      .split(',')
      .map((url) => url.trim().replace(/\/+$/, ''))
      .filter((url) => url.length > 0);

    if (urls.length > 0) {
      return urls;
    }
  }

  const fallback = typeof envFrontendUrl === 'string' ? envFrontendUrl.trim().replace(/\/+$/, '') : 'http://localhost:3000';
  return fallback.length > 0 ? [fallback] : ['http://localhost:3000'];
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  allowedOrigins: parseAllowedOrigins(),
  databaseUrl: process.env.DATABASE_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET as string,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
};


// Validate required configurations during startup
if (!config.databaseUrl) {
  console.error('[Error]: DATABASE_URL is missing from environment.');
  process.exit(1);
}

if (!config.jwtAccessSecret) {
  console.error('[Error]: JWT_ACCESS_SECRET is missing from environment.');
  process.exit(1);
}

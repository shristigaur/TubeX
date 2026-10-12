import cors from 'cors';
import { config } from '../../config/env.js';
import { sendError } from '../../utils/response.js';

/**
 * Checks whether an incoming origin is permitted by the CORS policy.
 *
 * Requests without an Origin header (e.g. server-to-server calls or curl/postman)
 * are permitted because CORS is a browser-enforced security mechanism.
 * IMPORTANT: Non-browser requests without an Origin header are NOT authenticated
 * merely because CORS permits them. Sensitive endpoints must enforce authorization
 * using the requireAuth middleware.
 *
 * Browser origins must match entries in allowedOrigins exactly (no wildcards or substrings).
 */
export const isOriginAllowed = (
  origin: string | undefined,
  allowedOrigins: string[] = config.allowedOrigins
): boolean => {
  if (origin === undefined) {
    return true;
  }
  return allowedOrigins.includes(origin);
};

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // credentials: true, // commented out; to be enabled when auth cookies/sessions are added
});

// A small wrapper to handle CORS errors gracefully according to the API convention
export const handleCorsError = (err: any, req: any, res: any, next: any) => {
  if (err.message === 'Not allowed by CORS') {
    return sendError(res, 403, 'Origin not allowed by CORS');
  }
  next(err);
};

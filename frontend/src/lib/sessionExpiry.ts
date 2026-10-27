import { ApiError } from './api.ts';

/**
 * Standard user-facing message displayed across all UI components when a session expires.
 */
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

/**
 * Mutable ref-compatible guard to prevent duplicate handling of expired session events.
 */
export interface SessionExpiryGuard {
  current: boolean;
}

/**
 * Handlers and state setters invoked when an expired session is detected.
 */
export interface SessionExpiryHandlers {
  guard: SessionExpiryGuard;
  logout: () => void;
  redirectToLogin: () => void;
  setFeedbackSuccess?: (message: null) => void;
  setFeedbackError?: (message: string) => void;
  setListingsError?: (message: string) => void;
  setFormServerError?: (message: string) => void;
}

/**
 * Centralized, isolated logic for detecting and handling HTTP 401 authentication expiration.
 *
 * - Returns `true` if the error was an HTTP 401 and session expiry was handled (or already handling).
 * - Returns `false` for any non-401 errors (400, 403, 404, 500, network dropouts, generic errors),
 *   allowing callers to retain their normal error handling paths.
 */
export function handleExpiredSession(
  error: unknown,
  handlers: SessionExpiryHandlers
): boolean {
  if (error instanceof ApiError && error.statusCode === 401) {
    if (handlers.guard.current) {
      return true;
    }
    handlers.guard.current = true;

    handlers.setFeedbackSuccess?.(null);
    handlers.setFeedbackError?.(SESSION_EXPIRED_MESSAGE);
    handlers.setListingsError?.(SESSION_EXPIRED_MESSAGE);
    handlers.setFormServerError?.(SESSION_EXPIRED_MESSAGE);

    handlers.logout();
    handlers.redirectToLogin();
    return true;
  }
  return false;
}

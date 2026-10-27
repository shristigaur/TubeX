import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from './api.ts';
import {
  handleExpiredSession,
  SESSION_EXPIRED_MESSAGE,
  type SessionExpiryGuard,
  type SessionExpiryHandlers,
} from './sessionExpiry.ts';

describe('handleExpiredSession', () => {
  function createMockHandlers(initialGuard = false) {
    const calls = {
      logout: 0,
      redirectToLogin: 0,
      setFeedbackSuccess: [] as (null | string)[],
      setFeedbackError: [] as string[],
      setListingsError: [] as string[],
      setFormServerError: [] as string[],
    };

    const guard: SessionExpiryGuard = { current: initialGuard };

    const handlers: SessionExpiryHandlers = {
      guard,
      logout: () => {
        calls.logout += 1;
      },
      redirectToLogin: () => {
        calls.redirectToLogin += 1;
      },
      setFeedbackSuccess: (msg) => {
        calls.setFeedbackSuccess.push(msg);
      },
      setFeedbackError: (msg) => {
        calls.setFeedbackError.push(msg);
      },
      setListingsError: (msg) => {
        calls.setListingsError.push(msg);
      },
      setFormServerError: (msg) => {
        calls.setFormServerError.push(msg);
      },
    };

    return { handlers, calls, guard };
  }

  describe('401 detection and exactly-once handling', () => {
    it('should detect ApiError with statusCode 401 and invoke logout and redirect', () => {
      const { handlers, calls, guard } = createMockHandlers(false);
      const error = new ApiError('Invalid or expired token', 401);

      const handled = handleExpiredSession(error, handlers);

      assert.equal(handled, true);
      assert.equal(guard.current, true);
      assert.equal(calls.logout, 1);
      assert.equal(calls.redirectToLogin, 1);
    });

    it('should set the exact expired-session message on all error feedback setters', () => {
      const { handlers, calls } = createMockHandlers(false);
      const error = new ApiError('jwt expired', 401);

      assert.equal(
        SESSION_EXPIRED_MESSAGE,
        'Your session has expired. Please sign in again.'
      );

      handleExpiredSession(error, handlers);

      assert.deepEqual(calls.setFeedbackError, [
        'Your session has expired. Please sign in again.',
      ]);
      assert.deepEqual(calls.setListingsError, [
        'Your session has expired. Please sign in again.',
      ]);
      assert.deepEqual(calls.setFormServerError, [
        'Your session has expired. Please sign in again.',
      ]);
    });

    it('should safely execute when optional UI setters are omitted', () => {
      const guard: SessionExpiryGuard = { current: false };
      let logoutCalled = 0;
      let redirectCalled = 0;

      const minimalHandlers: SessionExpiryHandlers = {
        guard,
        logout: () => {
          logoutCalled += 1;
        },
        redirectToLogin: () => {
          redirectCalled += 1;
        },
      };

      const error = new ApiError('Unauthorized', 401);
      const handled = handleExpiredSession(error, minimalHandlers);

      assert.equal(handled, true);
      assert.equal(guard.current, true);
      assert.equal(logoutCalled, 1);
      assert.equal(redirectCalled, 1);
    });
  });

  describe('repeated 401 calls and duplicate prevention', () => {
    it('should prevent duplicate logout and redirect calls across repeated 401s', () => {
      const { handlers, calls, guard } = createMockHandlers(false);
      const error1 = new ApiError('Invalid or expired token', 401);
      const error2 = new ApiError('Unauthorized', 401);
      const error3 = new ApiError('jwt expired', 401);

      // First call: should execute handlers
      const handled1 = handleExpiredSession(error1, handlers);
      assert.equal(handled1, true);
      assert.equal(guard.current, true);
      assert.equal(calls.logout, 1);
      assert.equal(calls.redirectToLogin, 1);
      assert.equal(calls.setFeedbackError.length, 1);

      // Second call: guard is already true; must return true without re-executing
      const handled2 = handleExpiredSession(error2, handlers);
      assert.equal(handled2, true);
      assert.equal(guard.current, true);
      assert.equal(calls.logout, 1, 'logout must not be called again');
      assert.equal(calls.redirectToLogin, 1, 'redirect must not be called again');
      assert.equal(calls.setFeedbackError.length, 1, 'setters must not be called again');

      // Third call: repeated invocation
      const handled3 = handleExpiredSession(error3, handlers);
      assert.equal(handled3, true);
      assert.equal(calls.logout, 1);
      assert.equal(calls.redirectToLogin, 1);
    });

    it('should return true immediately if guard was already true before the first call', () => {
      const { handlers, calls } = createMockHandlers(true);
      const error = new ApiError('Unauthorized', 401);

      const handled = handleExpiredSession(error, handlers);

      assert.equal(handled, true);
      assert.equal(calls.logout, 0);
      assert.equal(calls.redirectToLogin, 0);
      assert.equal(calls.setFeedbackError.length, 0);
    });
  });

  describe('clearing stale success feedback on expiry', () => {
    it('should clear stale success feedback by setting feedbackSuccess to null on 401', () => {
      const { handlers, calls } = createMockHandlers(false);
      const error = new ApiError('Session expired', 401);

      handleExpiredSession(error, handlers);

      assert.deepEqual(calls.setFeedbackSuccess, [null]);
    });

    it('should not clear success feedback when error is not a 401', () => {
      const { handlers, calls } = createMockHandlers(false);
      const error = new ApiError('Internal Server Error', 500);

      handleExpiredSession(error, handlers);

      assert.equal(calls.setFeedbackSuccess.length, 0);
    });
  });

  describe('non-401 HTTP errors and network errors', () => {
    it('should not trigger logout or redirect for HTTP 400 Bad Request', () => {
      const { handlers, calls, guard } = createMockHandlers(false);
      const error = new ApiError('Validation failed', 400);

      const handled = handleExpiredSession(error, handlers);

      assert.equal(handled, false);
      assert.equal(guard.current, false);
      assert.equal(calls.logout, 0);
      assert.equal(calls.redirectToLogin, 0);
      assert.equal(calls.setFeedbackError.length, 0);
    });

    it('should not trigger logout or redirect for HTTP 403 Forbidden', () => {
      const { handlers, calls, guard } = createMockHandlers(false);
      const error = new ApiError('Forbidden: Access denied to channel', 403);

      const handled = handleExpiredSession(error, handlers);

      assert.equal(handled, false);
      assert.equal(guard.current, false);
      assert.equal(calls.logout, 0);
      assert.equal(calls.redirectToLogin, 0);
      assert.equal(calls.setFeedbackError.length, 0);
    });

    it('should not trigger logout or redirect for HTTP 404 Not Found', () => {
      const { handlers, calls, guard } = createMockHandlers(false);
      const error = new ApiError('Channel not found', 404);

      const handled = handleExpiredSession(error, handlers);

      assert.equal(handled, false);
      assert.equal(guard.current, false);
      assert.equal(calls.logout, 0);
      assert.equal(calls.redirectToLogin, 0);
      assert.equal(calls.setFeedbackError.length, 0);
    });

    it('should not trigger logout or redirect for HTTP 500 Internal Server Error', () => {
      const { handlers, calls, guard } = createMockHandlers(false);
      const error = new ApiError('Internal Server Error', 500);

      const handled = handleExpiredSession(error, handlers);

      assert.equal(handled, false);
      assert.equal(guard.current, false);
      assert.equal(calls.logout, 0);
      assert.equal(calls.redirectToLogin, 0);
      assert.equal(calls.setFeedbackError.length, 0);
    });

    it('should not trigger logout or redirect for network connection failure (statusCode 0)', () => {
      const { handlers, calls, guard } = createMockHandlers(false);
      const error = new ApiError(
        'Unable to connect to TubeX server. Please check your network connection.',
        0
      );

      const handled = handleExpiredSession(error, handlers);

      assert.equal(handled, false);
      assert.equal(guard.current, false);
      assert.equal(calls.logout, 0);
      assert.equal(calls.redirectToLogin, 0);
      assert.equal(calls.setFeedbackError.length, 0);
    });

    it('should not trigger logout or redirect for generic standard Error', () => {
      const { handlers, calls, guard } = createMockHandlers(false);
      const error = new Error('Failed to fetch');

      const handled = handleExpiredSession(error, handlers);

      assert.equal(handled, false);
      assert.equal(guard.current, false);
      assert.equal(calls.logout, 0);
      assert.equal(calls.redirectToLogin, 0);
      assert.equal(calls.setFeedbackError.length, 0);
    });

    it('should not trigger logout or redirect for non-object errors (strings, numbers, null, undefined)', () => {
      const { handlers, calls, guard } = createMockHandlers(false);

      assert.equal(handleExpiredSession('unexpected error', handlers), false);
      assert.equal(handleExpiredSession(401, handlers), false);
      assert.equal(handleExpiredSession(null, handlers), false);
      assert.equal(handleExpiredSession(undefined, handlers), false);
      assert.equal(handleExpiredSession({ status: 401 }, handlers), false); // not an instance of ApiError

      assert.equal(guard.current, false);
      assert.equal(calls.logout, 0);
      assert.equal(calls.redirectToLogin, 0);
    });
  });

  describe('caller error flow preservation', () => {
    it('returning false allows callers to retain their normal error handling path', () => {
      const { handlers } = createMockHandlers(false);
      let standardErrorHandlerInvoked = false;

      function simulateAction(err: unknown) {
        if (handleExpiredSession(err, handlers)) {
          return;
        }
        standardErrorHandlerInvoked = true;
      }

      // Non-401 error should fall through to normal handler
      simulateAction(new ApiError('Bad Request', 400));
      assert.equal(standardErrorHandlerInvoked, true);

      // Reset and test 401: should NOT fall through
      standardErrorHandlerInvoked = false;
      simulateAction(new ApiError('Unauthorized', 401));
      assert.equal(standardErrorHandlerInvoked, false);
    });
  });
});

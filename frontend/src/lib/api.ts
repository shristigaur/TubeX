/**
 * Shared frontend API client for TubeX.
 *
 * Configures the base URL for the TubeX API and provides typed request helpers.
 * Sensitive data such as tokens and passwords are never logged or stored here.
 */

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
).replace(/\/+$/, '');

/**
 * Standard TubeX user profile shape returned by authentication endpoints.
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Payload data returned inside successful authentication responses.
 */
export interface AuthResponseData {
  user: UserProfile;
  accessToken: string;
}

/**
 * Standard TubeX API success envelope.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

/**
 * Standard TubeX API error envelope.
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  error?: unknown;
}

/**
 * Request payload for user signup.
 * Note: confirmPassword is intentionally excluded; password confirmation
 * must be verified client-side and never transmitted over the wire.
 */
export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

/**
 * Request payload for user login.
 */
export interface LoginRequest {
  email: string;
  password: string;
}

export type AuthResponse = ApiSuccessResponse<AuthResponseData>;
export type UserResponse = ApiSuccessResponse<{ user: UserProfile }>;

/**
 * Safe client error representation that encapsulates HTTP status and sanitized messages
 * without exposing stack traces, raw server internals, or credentials.
 */
export class ApiError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Returns a safe, user-friendly fallback error message for HTTP status codes
 * when the server does not return a clean JSON error response.
 */
function getStatusFallbackMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Invalid email or password.';
    case 403:
      return 'Access denied. You do not have permission to perform this action.';
    case 404:
      return 'Requested resource not found.';
    case 409:
      return 'An account with this email already exists.';
    case 429:
      return 'Too many requests. Please slow down and try again later.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Server is currently unavailable. Please try again shortly.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

interface ServerResponsePayload {
  success?: boolean;
  message?: string;
  data?: unknown;
  error?: unknown;
}

/**
 * Shared request executor with safe JSON parsing, status handling, and optional Bearer token injection.
 */
async function request<T>(
  endpoint: string,
  options: {
    method: 'GET' | 'POST';
    body?: unknown;
    token?: string;
  }
): Promise<ApiSuccessResponse<T>> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      'Unable to connect to TubeX server. Please check your network connection.',
      0
    );
  }

  let jsonBody: ServerResponsePayload | null = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      jsonBody = (await res.json()) as ServerResponsePayload;
    } catch {
      jsonBody = null;
    }
  }

  if (!res.ok) {
    const message =
      typeof jsonBody?.message === 'string' && jsonBody.message.trim().length > 0
        ? jsonBody.message.trim()
        : getStatusFallbackMessage(res.status);

    throw new ApiError(message, res.status);
  }

  if (!jsonBody || jsonBody.success !== true) {
    throw new ApiError('Unexpected response from TubeX server.', res.status);
  }

  return jsonBody as ApiSuccessResponse<T>;
}

/**
 * Internal POST helper with safe JSON parsing and error sanitization.
 */
async function post<T>(endpoint: string, body: unknown): Promise<ApiSuccessResponse<T>> {
  return request<T>(endpoint, { method: 'POST', body });
}

/**
 * Register a new user account.
 * Transmits only name, email, and password to the backend.
 */
export async function signup(payload: SignupRequest): Promise<AuthResponse> {
  const { name, email, password } = payload;
  return post<AuthResponseData>('/auth/signup', { name, email, password });
}

/**
 * Authenticate an existing user.
 * Transmits email and password to the backend.
 */
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const { email, password } = payload;
  return post<AuthResponseData>('/auth/login', { email, password });
}

/**
 * Fetch the currently authenticated user profile using a Bearer token.
 */
export async function getMe(token: string): Promise<UserResponse> {
  return request<{ user: UserProfile }>('/auth/me', {
    method: 'GET',
    token,
  });
}


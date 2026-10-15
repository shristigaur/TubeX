/**
 * Shared frontend API client for TubeX.
 *
 * Configures the base URL for the TubeX API and provides typed request helpers.
 * Sensitive data such as tokens and passwords are never logged or stored here.
 */

/**
 * Safely normalizes the configured API base URL.
 * - Uses http://localhost:4000/api/v1 as fallback if absent or whitespace.
 * - Trims whitespace and removes trailing slashes.
 * - Allows only absolute http: and https: URLs.
 * - Rejects embedded credentials (username or password).
 * - Rejects unsupported protocols (ftp, file, ws, wss, etc.).
 * - If given a host-only URL (e.g. https://example.onrender.com), appends /api/v1.
 * - Preserves existing /api/v1 suffix and relative /api/v1 path.
 * - Rejects unexpected paths and malformed URLs with sanitized error messages.
 */
export function normalizeApiBaseUrl(rawUrl?: string): string {
  const fallback = 'http://localhost:4000/api/v1';
  if (!rawUrl || typeof rawUrl !== 'string') {
    return fallback;
  }

  const trimmed = rawUrl.trim();
  if (trimmed === '') {
    return fallback;
  }

  // Remove trailing slashes
  const cleaned = trimmed.replace(/\/+$/, '');

  try {
    const parsed = new URL(cleaned);

    // Enforce HTTP / HTTPS protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        'Invalid NEXT_PUBLIC_API_URL protocol. Expected "http:" or "https:".'
      );
    }

    // Reject embedded credentials
    if (parsed.username || parsed.password) {
      throw new Error(
        'Invalid NEXT_PUBLIC_API_URL: Embedded credentials (username or password) are not permitted.'
      );
    }

    const pathname = parsed.pathname.replace(/\/+$/, '');

    // Host-only URL (e.g. https://example.onrender.com or pathname is empty / '/')
    if (pathname === '' || pathname === '/') {
      return `${parsed.origin}/api/v1`;
    }

    // Exact expected API version path
    if (pathname === '/api/v1') {
      return `${parsed.origin}/api/v1`;
    }

    // Unexpected path configured
    throw new Error(
      'Invalid NEXT_PUBLIC_API_URL path. Expected a host-only URL or ending in "/api/v1".'
    );
  } catch (err) {
    if (err instanceof TypeError) {
      // Failed URL parsing (e.g. relative path without origin or malformed format)
      if (cleaned === '/api/v1') {
        return '/api/v1';
      }
      throw new Error(
        'Invalid NEXT_PUBLIC_API_URL. Must be a valid absolute HTTP/HTTPS URL.'
      );
    }
    throw err;
  }
}

export const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);


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
 * Channel listing shape returned by the public marketplace API.
 */
export interface ChannelListing {
  id: string;
  name: string;
  handle: string;
  youtubeUrl?: string | null;
  niche: string;
  subscribers: string;
  subscribersCount: number;
  monthlyViews: string | null;
  monthlyViewsCount?: number | null;
  monetized: boolean;
  priceUsd: number;
  priceCents?: number;
  verifiedAnalytics: boolean;
  featuredBadge?: string | null;
  description: string;
  seller?: {
    id: string;
    name: string;
  };
}

/**
 * Pagination metadata returned in listings response.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Payload data for channels listing response.
 */
export interface ChannelsResponseData {
  channels: ChannelListing[];
  pagination: PaginationMeta;
}

/**
 * Supported query parameters for public channel marketplace.
 */
export interface ChannelsQueryParams {
  niche?: string;
  subscribers?: string;
  budget?: string;
  minPrice?: number;
  maxPrice?: number;
  minSubscribers?: number;
  maxSubscribers?: number;
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'subscribers_desc' | 'subscribers_asc';
}

export type ChannelsResponse = ApiSuccessResponse<ChannelsResponseData>;

/**
 * Payload data for single channel response.
 */
export interface SingleChannelResponseData {
  channel: ChannelListing;
}

export type SingleChannelResponse = ApiSuccessResponse<SingleChannelResponseData>;

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
    signal?: AbortSignal;
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
      signal: options.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
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

/**
 * Serializes channel query parameters into a URL query string.
 * Omits undefined, empty, or 'all' filter values.
 */
export function buildChannelsQueryString(params?: ChannelsQueryParams): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();

  if (params.niche && params.niche !== 'all') {
    searchParams.set('niche', params.niche);
  }
  if (params.subscribers && params.subscribers !== 'all') {
    searchParams.set('subscribers', params.subscribers);
  }
  if (params.budget && params.budget !== 'all') {
    searchParams.set('budget', params.budget);
  }
  if (params.minPrice !== undefined && Number.isFinite(params.minPrice)) {
    searchParams.set('minPrice', params.minPrice.toString());
  }
  if (params.maxPrice !== undefined && Number.isFinite(params.maxPrice)) {
    searchParams.set('maxPrice', params.maxPrice.toString());
  }
  if (params.minSubscribers !== undefined && Number.isFinite(params.minSubscribers)) {
    searchParams.set('minSubscribers', params.minSubscribers.toString());
  }
  if (params.maxSubscribers !== undefined && Number.isFinite(params.maxSubscribers)) {
    searchParams.set('maxSubscribers', params.maxSubscribers.toString());
  }
  if (params.page !== undefined && Number.isFinite(params.page) && params.page > 0) {
    searchParams.set('page', params.page.toString());
  }
  if (params.limit !== undefined && Number.isFinite(params.limit) && params.limit > 0) {
    searchParams.set('limit', params.limit.toString());
  }
  if (params.sort) {
    searchParams.set('sort', params.sort);
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Fetch public channel listings from /api/v1/channels with optional filters, sorting, and pagination.
 * Does not send authentication tokens for public browsing.
 */
export async function fetchChannels(
  params?: ChannelsQueryParams,
  options?: { signal?: AbortSignal }
): Promise<ChannelsResponse> {
  const qs = buildChannelsQueryString(params);
  const response = await request<ChannelsResponseData>(`/channels${qs}`, {
    method: 'GET',
    signal: options?.signal,
  });

  if (
    !response.data ||
    !Array.isArray(response.data.channels) ||
    !response.data.pagination ||
    typeof response.data.pagination.total !== 'number'
  ) {
    throw new ApiError('Unexpected response format from TubeX server.', 500);
  }

  return response;
}

/**
 * Fetch a single public channel listing by its unique ID from /api/v1/channels/:id.
 * Does not send authentication tokens for public browsing.
 * Encodes the channel ID safely in the URL path.
 */
export async function fetchChannelById(
  id: string,
  options?: { signal?: AbortSignal }
): Promise<SingleChannelResponse> {
  const trimmedId = id ? id.trim() : '';
  if (!trimmedId) {
    throw new ApiError('Channel ID is required.', 400);
  }

  const encodedId = encodeURIComponent(trimmedId);
  const response = await request<SingleChannelResponseData>(`/channels/${encodedId}`, {
    method: 'GET',
    signal: options?.signal,
  });

  if (
    !response.data ||
    typeof response.data !== 'object' ||
    !response.data.channel ||
    typeof response.data.channel.id !== 'string' ||
    typeof response.data.channel.name !== 'string'
  ) {
    throw new ApiError('Unexpected response format from TubeX server.', 500);
  }

  return response;
}


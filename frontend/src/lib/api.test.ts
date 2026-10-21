import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeApiBaseUrl,
  buildChannelsQueryString,
  fetchChannels,
  fetchChannelById,
  centsToUsd,
  fetchSellerChannels,
  fetchSellerChannelById,
  createSellerChannel,
  updateSellerChannel,
  submitChannelForReview,
  unpublishSellerChannel,
  deleteSellerChannel,
  ApiError,
  API_BASE_URL,
  type SellerChannelListing,
  type CreateChannelPayload,
  type UpdateChannelPayload,
} from './api.ts';

describe('normalizeApiBaseUrl', () => {
  it('should fall back to localhost default for undefined, empty, or whitespace-only inputs', () => {
    const fallback = 'http://localhost:4000/api/v1';
    assert.equal(normalizeApiBaseUrl(undefined), fallback);
    assert.equal(normalizeApiBaseUrl(''), fallback);
    assert.equal(normalizeApiBaseUrl('   '), fallback);
    assert.equal(normalizeApiBaseUrl('\t\n  '), fallback);
  });

  it('should append /api/v1 to host-only HTTP and HTTPS URLs', () => {
    assert.equal(normalizeApiBaseUrl('http://localhost:4000'), 'http://localhost:4000/api/v1');
    assert.equal(normalizeApiBaseUrl('http://localhost:4000/'), 'http://localhost:4000/api/v1');
    assert.equal(normalizeApiBaseUrl('https://api.example.test'), 'https://api.example.test/api/v1');
    assert.equal(normalizeApiBaseUrl('https://api.example.test/'), 'https://api.example.test/api/v1');
  });

  it('should preserve existing /api/v1 paths without duplication and normalize trailing slashes', () => {
    assert.equal(normalizeApiBaseUrl('http://localhost:4000/api/v1'), 'http://localhost:4000/api/v1');
    assert.equal(normalizeApiBaseUrl('http://localhost:4000/api/v1/'), 'http://localhost:4000/api/v1');
    assert.equal(normalizeApiBaseUrl('https://api.example.test/api/v1///'), 'https://api.example.test/api/v1');
  });

  it('should reject unexpected paths and malformed URLs with sanitized errors', () => {
    assert.throws(
      () => normalizeApiBaseUrl('https://api.example.test/custom-backend'),
      {
        name: 'Error',
        message: 'Invalid NEXT_PUBLIC_API_URL path. Expected a host-only URL or ending in "/api/v1".',
      }
    );

    assert.throws(
      () => normalizeApiBaseUrl('https://api.example.test/api/v2'),
      {
        name: 'Error',
        message: 'Invalid NEXT_PUBLIC_API_URL path. Expected a host-only URL or ending in "/api/v1".',
      }
    );

    assert.throws(
      () => normalizeApiBaseUrl('https://'),
      {
        name: 'Error',
        message: 'Invalid NEXT_PUBLIC_API_URL. Must be a valid absolute HTTP/HTTPS URL.',
      }
    );

    assert.throws(
      () => normalizeApiBaseUrl('not-a-valid-url'),
      {
        name: 'Error',
        message: 'Invalid NEXT_PUBLIC_API_URL. Must be a valid absolute HTTP/HTTPS URL.',
      }
    );
  });

  it('should reject unsupported schemes such as ftp, file, ws, and wss', () => {
    const unsupportedSchemes = [
      'ftp://files.example.test',
      'file:///etc/config',
      'ws://socket.example.test',
      'wss://socket.example.test',
      'gopher://gopher.example.test',
    ];

    for (const url of unsupportedSchemes) {
      assert.throws(
        () => normalizeApiBaseUrl(url),
        {
          name: 'Error',
          message: 'Invalid NEXT_PUBLIC_API_URL protocol. Expected "http:" or "https:".',
        }
      );
    }
  });

  it('should reject URLs containing embedded credentials instead of silently removing them', () => {
    assert.throws(
      () => normalizeApiBaseUrl('https://dummyuser:dummypass@api.example.test/api/v1'),
      {
        name: 'Error',
        message: 'Invalid NEXT_PUBLIC_API_URL: Embedded credentials (username or password) are not permitted.',
      }
    );

    assert.throws(
      () => normalizeApiBaseUrl('https://dummyuser@api.example.test/api/v1'),
      {
        name: 'Error',
        message: 'Invalid NEXT_PUBLIC_API_URL: Embedded credentials (username or password) are not permitted.',
      }
    );
  });

  it('should strip query strings and fragments while preserving nonstandard ports', () => {
    assert.equal(
      normalizeApiBaseUrl('https://api.example.test:8443'),
      'https://api.example.test:8443/api/v1'
    );
    assert.equal(
      normalizeApiBaseUrl('https://api.example.test:8443/api/v1?token=dummy-secret-token#section'),
      'https://api.example.test:8443/api/v1'
    );
    assert.equal(
      normalizeApiBaseUrl('http://localhost:4000/?debug=1&env=test'),
      'http://localhost:4000/api/v1'
    );
  });

  it('should preserve relative /api/v1 paths', () => {
    assert.equal(normalizeApiBaseUrl('/api/v1'), '/api/v1');
    assert.equal(normalizeApiBaseUrl('/api/v1/'), '/api/v1');
  });

  it('should sanitize errors and never disclose credentials or sensitive query strings from malformed inputs', () => {
    const sensitiveInputs = [
      'https://dummyuser:supersecretpassword@invalid:port:url',
      'https://invalid:port:url?token=supersecrettoken123',
    ];

    for (const input of sensitiveInputs) {
      try {
        normalizeApiBaseUrl(input);
        assert.fail('Should have thrown an error');
      } catch (err: unknown) {
        assert.ok(err instanceof Error);
        assert.equal(err.name, 'Error');
        assert.ok(
          !err.message.includes('supersecretpassword'),
          'Error message must not include credentials'
        );
        assert.ok(
          !err.message.includes('supersecrettoken123'),
          'Error message must not include tokens'
        );
        assert.equal(
          err.message,
          'Invalid NEXT_PUBLIC_API_URL. Must be a valid absolute HTTP/HTTPS URL.'
        );
      }
    }
  });
});

describe('buildChannelsQueryString', () => {
  it('should return empty string for undefined or empty params', () => {
    assert.equal(buildChannelsQueryString(undefined), '');
    assert.equal(buildChannelsQueryString({}), '');
  });

  it('should omit filter options set to "all"', () => {
    const qs = buildChannelsQueryString({
      niche: 'all',
      subscribers: 'all',
      budget: 'all',
    });
    assert.equal(qs, '');
  });

  it('should correctly encode niche, subscribers, and budget filters', () => {
    const qs = buildChannelsQueryString({
      niche: 'tech',
      subscribers: '10k-50k',
      budget: 'under-5k',
    });
    assert.equal(qs, '?niche=tech&subscribers=10k-50k&budget=under-5k');
  });

  it('should URL-encode niches containing spaces and ampersands', () => {
    const qs = buildChannelsQueryString({
      niche: 'Technology & Gadgets',
    });
    assert.ok(qs.includes('Technology+%26+Gadgets') || qs.includes('Technology%20%26%20Gadgets'));
  });

  it('should serialize custom price and subscriber ranges', () => {
    const qs = buildChannelsQueryString({
      minPrice: 500,
      maxPrice: 1500.5,
      minSubscribers: 10000,
      maxSubscribers: 50000,
    });
    assert.equal(qs, '?minPrice=500&maxPrice=1500.5&minSubscribers=10000&maxSubscribers=50000');
  });

  it('should serialize pagination and sort parameters', () => {
    const qs = buildChannelsQueryString({
      page: 3,
      limit: 25,
      sort: 'price_asc',
    });
    assert.equal(qs, '?page=3&limit=25&sort=price_asc');
  });

  it('should ignore non-finite numbers and invalid page/limit numbers', () => {
    const qs = buildChannelsQueryString({
      minPrice: NaN,
      maxPrice: Infinity,
      page: 0,
      limit: -5,
    });
    assert.equal(qs, '');
  });
});

describe('fetchChannels', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockChannel = {
    id: 'ch-01',
    name: 'Apex Tech',
    handle: '@apextech',
    niche: 'Technology & Gadgets',
    subscribers: '245K',
    subscribersCount: 245000,
    monthlyViews: '1.2M',
    monthlyViewsCount: 1200000,
    monetized: true,
    priceUsd: 14500,
    priceCents: 1450000,
    verifiedAnalytics: true,
    featuredBadge: 'Featured',
    description: 'Hardware reviews.',
    status: 'AVAILABLE',
    isPublished: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    seller: {
      id: 'seller-01',
      name: 'Tech Seller',
    },
  };

  it('should call /api/v1/channels with encoded query parameters and return mapped listings', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedHeaders: HeadersInit | undefined;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = input.toString();
      capturedMethod = init?.method ?? 'GET';
      capturedHeaders = init?.headers;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Channels retrieved successfully.',
          data: {
            channels: [mockChannel],
            pagination: {
              page: 1,
              limit: 12,
              total: 1,
              totalPages: 1,
              hasNextPage: false,
              hasPrevPage: false,
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const res = await fetchChannels({ niche: 'tech', page: 1, limit: 12, sort: 'newest' });

    assert.equal(capturedMethod, 'GET');
    assert.ok(capturedUrl.startsWith(API_BASE_URL));
    assert.ok(capturedUrl.includes('/channels?niche=tech&page=1&limit=12&sort=newest'));

    // Verify unauthenticated public browsing: no Authorization header sent
    if (capturedHeaders) {
      assert.ok(!('Authorization' in capturedHeaders || 'authorization' in capturedHeaders));
    }

    assert.equal(res.success, true);
    assert.equal(res.data.channels.length, 1);
    assert.equal(res.data.channels[0].name, 'Apex Tech');
    assert.equal(res.data.pagination.total, 1);
  });

  it('should handle empty listing response honestly without fabrication', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Channels retrieved successfully.',
          data: {
            channels: [],
            pagination: {
              page: 1,
              limit: 12,
              total: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false,
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const res = await fetchChannels();

    assert.equal(res.success, true);
    assert.equal(res.data.channels.length, 0);
    assert.equal(res.data.pagination.total, 0);
  });

  it('should throw ApiError with status and message on HTTP 400 validation error', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'minPrice cannot be greater than maxPrice',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await fetchChannels({ minPrice: 2000, maxPrice: 1000 });
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, 'minPrice cannot be greater than maxPrice');
        return true;
      }
    );
  });

  it('should throw ApiError on network connection failure without leaking details', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await assert.rejects(
      async () => {
        await fetchChannels();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 0);
        assert.equal(
          err.message,
          'Unable to connect to TubeX server. Please check your network connection.'
        );
        return true;
      }
    );
  });

  it('should throw ApiError on malformed response missing required channels array', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Channels retrieved successfully.',
          data: {
            channels: 'not-an-array',
            pagination: { total: 0 },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await fetchChannels();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 500);
        assert.equal(err.message, 'Unexpected response format from TubeX server.');
        return true;
      }
    );
  });

  it('should propagate AbortError when request is cancelled via AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort();

    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        const abortErr = new Error('The operation was aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      return new Response('{}');
    };

    await assert.rejects(
      async () => {
        await fetchChannels({}, { signal: controller.signal });
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.name, 'AbortError');
        return true;
      }
    );
  });
});

describe('fetchChannelById', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockChannel = {
    id: '670c5e7b8f1a2b3c4d5e6f7a',
    name: 'Apex Tech Reviews',
    handle: '@apextechreviews',
    youtubeUrl: 'https://youtube.com/@apextechreviews',
    niche: 'Technology & Gadgets',
    subscribers: '245K',
    subscribersCount: 245000,
    monthlyViews: '1.2M',
    monthlyViewsCount: 1200000,
    monetized: true,
    priceUsd: 14500,
    priceCents: 1450000,
    verifiedAnalytics: true,
    featuredBadge: 'High Engagement',
    description: 'Hardware reviews and consumer tech guides.',
    status: 'AVAILABLE',
    isPublished: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    seller: {
      id: '507f1f77bcf86cd799439011',
      name: 'Tech Seller',
    },
  };

  it('should call /api/v1/channels/:id and return parsed channel DTO on success', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedHeaders: HeadersInit | undefined;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = input.toString();
      capturedMethod = init?.method ?? 'GET';
      capturedHeaders = init?.headers;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Channel retrieved successfully.',
          data: {
            channel: mockChannel,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const res = await fetchChannelById('670c5e7b8f1a2b3c4d5e6f7a');

    assert.equal(capturedMethod, 'GET');
    assert.ok(capturedUrl.startsWith(API_BASE_URL));
    assert.ok(capturedUrl.endsWith('/channels/670c5e7b8f1a2b3c4d5e6f7a'));

    // Verify unauthenticated public browsing: no Authorization header sent
    if (capturedHeaders) {
      assert.ok(!('Authorization' in capturedHeaders || 'authorization' in capturedHeaders));
    }

    assert.equal(res.success, true);
    assert.equal(res.message, 'Channel retrieved successfully.');
    assert.equal(res.data.channel.id, '670c5e7b8f1a2b3c4d5e6f7a');
    assert.equal(res.data.channel.name, 'Apex Tech Reviews');
    assert.equal(res.data.channel.priceUsd, 14500);
    assert.equal(res.data.channel.seller?.name, 'Tech Seller');
  });

  it('should safely URL-encode the ID parameter in the request path', async () => {
    let capturedUrl = '';

    globalThis.fetch = async (input: RequestInfo | URL) => {
      capturedUrl = input.toString();
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Channel retrieved successfully.',
          data: { channel: mockChannel },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    await fetchChannelById('ch 123/special&id=test');
    assert.ok(capturedUrl.includes('/channels/ch%20123%2Fspecial%26id%3Dtest'));
  });

  it('should reject empty or whitespace-only channel ID before making network request', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response('{}');
    };

    await assert.rejects(
      async () => {
        await fetchChannelById('');
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, 'Channel ID is required.');
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await fetchChannelById('   ');
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, 'Channel ID is required.');
        return true;
      }
    );

    assert.equal(fetchCalled, false);
  });

  it('should throw ApiError with status and message on HTTP 400 invalid-ID response from server', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid channel ID format. Must be a 24-character hexadecimal string',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await fetchChannelById('123');
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 400);
        assert.equal(
          err.message,
          'Invalid channel ID format. Must be a 24-character hexadecimal string'
        );
        return true;
      }
    );
  });

  it('should throw ApiError on HTTP 404 not-found response', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Channel not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await fetchChannelById('507f1f77bcf86cd799439099');
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 404);
        assert.equal(err.message, 'Channel not found');
        return true;
      }
    );
  });

  it('should throw ApiError on network connection failure without leaking details', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await assert.rejects(
      async () => {
        await fetchChannelById('670c5e7b8f1a2b3c4d5e6f7a');
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 0);
        assert.equal(
          err.message,
          'Unable to connect to TubeX server. Please check your network connection.'
        );
        return true;
      }
    );
  });

  it('should throw ApiError on malformed response missing required channel object', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Channel retrieved successfully.',
          data: {
            channel: null,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await fetchChannelById('670c5e7b8f1a2b3c4d5e6f7a');
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 500);
        assert.equal(err.message, 'Unexpected response format from TubeX server.');
        return true;
      }
    );
  });

  it('should propagate AbortError when single-channel request is cancelled via AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort();

    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        const abortErr = new Error('The operation was aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      return new Response('{}');
    };

    await assert.rejects(
      async () => {
        await fetchChannelById('670c5e7b8f1a2b3c4d5e6f7a', { signal: controller.signal });
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.name, 'AbortError');
        return true;
      }
    );
  });
});

describe('centsToUsd', () => {
  it('should convert valid integer cents to USD dollars correctly', () => {
    assert.equal(centsToUsd(0), 0);
    assert.equal(centsToUsd(99), 0.99);
    assert.equal(centsToUsd(100), 1);
    assert.equal(centsToUsd(1450000), 14500);
    assert.equal(centsToUsd(123456), 1234.56);
  });

  it('should throw an Error on negative cents', () => {
    assert.throws(() => centsToUsd(-1), {
      name: 'Error',
      message: 'Cents must be a non-negative integer.',
    });
    assert.throws(() => centsToUsd(-500), {
      name: 'Error',
      message: 'Cents must be a non-negative integer.',
    });
  });

  it('should throw an Error on non-integer cents', () => {
    assert.throws(() => centsToUsd(12.34), {
      name: 'Error',
      message: 'Cents must be a non-negative integer.',
    });
  });

  it('should throw an Error on non-finite values (NaN, Infinity)', () => {
    assert.throws(() => centsToUsd(NaN), {
      name: 'Error',
      message: 'Cents must be a non-negative integer.',
    });
    assert.throws(() => centsToUsd(Infinity), {
      name: 'Error',
      message: 'Cents must be a non-negative integer.',
    });
  });
});

describe('Seller API Client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const testToken = 'valid-jwt-seller-token';
  const testChannelId = '670c5e7b8f1a2b3c4d5e6f7a';

  const mockSellerChannel: SellerChannelListing = {
    id: testChannelId,
    name: 'Tech Frontier',
    handle: '@techfrontier',
    youtubeUrl: 'https://youtube.com/@techfrontier',
    niche: 'Technology & Gadgets',
    subscribersCount: 150000,
    monthlyViewsCount: 800000,
    monetized: true,
    verifiedAnalytics: false,
    priceCents: 1200000,
    description: 'A growing tech channel covering gadgets and hardware.',
    featuredBadge: null,
    status: 'DRAFT',
    isPublished: false,
    sellerId: '507f1f77bcf86cd799439011',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };

  const validCreatePayload: CreateChannelPayload = {
    name: 'Tech Frontier',
    handle: '@techfrontier',
    youtubeUrl: 'https://youtube.com/@techfrontier',
    niche: 'Technology & Gadgets',
    subscribersCount: 150000,
    monthlyViewsCount: 800000,
    monetized: true,
    priceUsd: 12000,
    description: 'A growing tech channel covering gadgets and hardware.',
  };

  // =========================================================================
  // fetchSellerChannels
  // =========================================================================
  describe('fetchSellerChannels', () => {
    it('should call GET /channels/mine with Bearer token and return channels array', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedHeaders: HeadersInit | undefined;

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = input.toString();
        capturedMethod = init?.method ?? 'GET';
        capturedHeaders = init?.headers;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Seller channels retrieved successfully.',
            data: { channels: [mockSellerChannel] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await fetchSellerChannels(testToken);

      assert.equal(capturedUrl, `${API_BASE_URL}/channels/mine`);
      assert.equal(capturedMethod, 'GET');

      const headers = capturedHeaders as Record<string, string>;
      assert.equal(headers['Authorization'], `Bearer ${testToken}`);

      assert.equal(res.success, true);
      assert.equal(res.data.channels.length, 1);
      assert.equal(res.data.channels[0].name, 'Tech Frontier');
      assert.equal(res.data.channels[0].status, 'DRAFT');
    });

    it('should reject with 401 if token is empty or whitespace before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannels('');
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.message, 'Authentication token is required.');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await fetchSellerChannels('   ');
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.message, 'Authentication token is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should throw ApiError with 401 when server returns unauthorized response', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Invalid or expired token',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannels('expired-token');
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.message, 'Invalid or expired token');
          return true;
        }
      );
    });

    it('should throw ApiError with 500 when server response is missing channels array', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Success',
            data: { channels: null },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannels(testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 500);
          assert.equal(err.message, 'Unexpected response format from TubeX server.');
          return true;
        }
      );
    });

    it('should throw ApiError on network connection failure without leaking details', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannels(testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 0);
          assert.equal(
            err.message,
            'Unable to connect to TubeX server. Please check your network connection.'
          );
          return true;
        }
      );
    });

    it('should propagate AbortError when request is cancelled via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannels(testToken, { signal: controller.signal });
        },
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal(err.name, 'AbortError');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // fetchSellerChannelById
  // =========================================================================
  describe('fetchSellerChannelById', () => {
    it('should call GET /channels/mine/:id with Bearer token and return channel', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedHeaders: HeadersInit | undefined;

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = input.toString();
        capturedMethod = init?.method ?? 'GET';
        capturedHeaders = init?.headers;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Channel retrieved successfully.',
            data: { channel: mockSellerChannel },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await fetchSellerChannelById(testChannelId, testToken);

      assert.equal(capturedUrl, `${API_BASE_URL}/channels/mine/${testChannelId}`);
      assert.equal(capturedMethod, 'GET');

      const headers = capturedHeaders as Record<string, string>;
      assert.equal(headers['Authorization'], `Bearer ${testToken}`);

      assert.equal(res.success, true);
      assert.equal(res.data.channel.id, testChannelId);
      assert.equal(res.data.channel.name, 'Tech Frontier');
    });

    it('should safely URL-encode the channel ID', async () => {
      let capturedUrl = '';
      globalThis.fetch = async (input: RequestInfo | URL) => {
        capturedUrl = input.toString();
        return new Response(
          JSON.stringify({
            success: true,
            message: 'OK',
            data: { channel: mockSellerChannel },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await fetchSellerChannelById('id with/special&chars', testToken);
      assert.ok(capturedUrl.includes('/channels/mine/id%20with%2Fspecial%26chars'));
    });

    it('should reject with 400 if channel ID is empty before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannelById('', testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.message, 'Channel ID is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should reject with 401 if token is empty before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannelById(testChannelId, '');
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.message, 'Authentication token is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should throw ApiError with 404 when channel is not found', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Channel not found',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannelById(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 404);
          assert.equal(err.message, 'Channel not found');
          return true;
        }
      );
    });

    it('should throw ApiError with 403 when server returns forbidden', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Forbidden: Access denied to channel',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannelById(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 403);
          assert.ok(err.message.includes('Forbidden'));
          return true;
        }
      );
    });

    it('should throw ApiError with 500 when server response is missing channel object', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'OK',
            data: { channel: null },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannelById(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 500);
          assert.equal(err.message, 'Unexpected response format from TubeX server.');
          return true;
        }
      );
    });

    it('should throw ApiError on network connection failure without leaking details', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannelById(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 0);
          assert.equal(
            err.message,
            'Unable to connect to TubeX server. Please check your network connection.'
          );
          return true;
        }
      );
    });

    it('should propagate AbortError when single-channel request is cancelled via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await fetchSellerChannelById(testChannelId, testToken, { signal: controller.signal });
        },
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal(err.name, 'AbortError');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // createSellerChannel
  // =========================================================================
  describe('createSellerChannel', () => {
    it('should call POST /channels/mine with body, Bearer token, and return 201 created channel', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedHeaders: HeadersInit | undefined;
      let capturedBody = '';

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = input.toString();
        capturedMethod = init?.method ?? 'GET';
        capturedHeaders = init?.headers;
        capturedBody = init?.body as string;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Channel listing created successfully.',
            data: { channel: mockSellerChannel },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await createSellerChannel(validCreatePayload, testToken);

      assert.equal(capturedUrl, `${API_BASE_URL}/channels/mine`);
      assert.equal(capturedMethod, 'POST');

      const headers = capturedHeaders as Record<string, string>;
      assert.equal(headers['Content-Type'], 'application/json');
      assert.equal(headers['Authorization'], `Bearer ${testToken}`);

      const parsedBody = JSON.parse(capturedBody);
      assert.equal(parsedBody.name, validCreatePayload.name);
      assert.equal(parsedBody.priceUsd, validCreatePayload.priceUsd);

      assert.equal(res.success, true);
      assert.equal(res.data.channel.id, testChannelId);
      assert.equal(res.data.channel.status, 'DRAFT');
    });

    it('should omit monthlyViewsCount from request body when undefined and accept null in response', async () => {
      let capturedBody = '';

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Channel listing created successfully.',
            data: { channel: { ...mockSellerChannel, monthlyViewsCount: null } },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const payloadWithoutViews: CreateChannelPayload = {
        name: 'Tech Frontier',
        handle: '@techfrontier',
        niche: 'Technology & Gadgets',
        subscribersCount: 150000,
        monetized: false,
        priceUsd: 1000,
        description: 'Testing channel creation with omitted views',
      };

      const res = await createSellerChannel(payloadWithoutViews, testToken);
      const parsedBody = JSON.parse(capturedBody);

      assert.equal('monthlyViewsCount' in parsedBody, false);
      assert.equal(res.data.channel.monthlyViewsCount, null);
    });

    it('should reject with 401 if token is empty before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await createSellerChannel(validCreatePayload, '');
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.message, 'Authentication token is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should throw ApiError with 400 when server rejects invalid input payload', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Price cannot be negative',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await createSellerChannel({ ...validCreatePayload, priceUsd: -50 }, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.message, 'Price cannot be negative');
          return true;
        }
      );
    });

    it('should throw ApiError with 401 when server returns unauthorized', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Unauthorized',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await createSellerChannel(validCreatePayload, 'bad-token');
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.message, 'Unauthorized');
          return true;
        }
      );
    });

    it('should throw ApiError with 500 when server response is malformed', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Success',
            data: { channel: null },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await createSellerChannel(validCreatePayload, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 500);
          assert.equal(err.message, 'Unexpected response format from TubeX server.');
          return true;
        }
      );
    });

    it('should throw ApiError on network connection failure without leaking details', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      await assert.rejects(
        async () => {
          await createSellerChannel(validCreatePayload, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 0);
          assert.equal(
            err.message,
            'Unable to connect to TubeX server. Please check your network connection.'
          );
          return true;
        }
      );
    });

    it('should propagate AbortError when create request is cancelled via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await createSellerChannel(validCreatePayload, testToken, { signal: controller.signal });
        },
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal(err.name, 'AbortError');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // updateSellerChannel
  // =========================================================================
  describe('updateSellerChannel', () => {
    it('should call PATCH /channels/mine/:id with body, Bearer token, and return updated channel', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedHeaders: HeadersInit | undefined;
      let capturedBody = '';

      const updatedChannel = { ...mockSellerChannel, name: 'Tech Frontier Pro' };

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = input.toString();
        capturedMethod = init?.method ?? 'GET';
        capturedHeaders = init?.headers;
        capturedBody = init?.body as string;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Channel listing updated successfully.',
            data: { channel: updatedChannel },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const updatePayload: UpdateChannelPayload = { name: 'Tech Frontier Pro' };
      const res = await updateSellerChannel(testChannelId, updatePayload, testToken);

      assert.equal(capturedUrl, `${API_BASE_URL}/channels/mine/${testChannelId}`);
      assert.equal(capturedMethod, 'PATCH');

      const headers = capturedHeaders as Record<string, string>;
      assert.equal(headers['Content-Type'], 'application/json');
      assert.equal(headers['Authorization'], `Bearer ${testToken}`);

      const parsedBody = JSON.parse(capturedBody);
      assert.equal(parsedBody.name, 'Tech Frontier Pro');

      assert.equal(res.success, true);
      assert.equal(res.data.channel.name, 'Tech Frontier Pro');
    });

    it('should omit monthlyViewsCount from update request body when undefined', async () => {
      let capturedBody = '';

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Channel listing updated successfully.',
            data: { channel: { ...mockSellerChannel, monthlyViewsCount: null } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const updatePayloadWithoutViews: UpdateChannelPayload = {
        name: 'Updated Name Only',
      };

      const res = await updateSellerChannel(testChannelId, updatePayloadWithoutViews, testToken);
      const parsedBody = JSON.parse(capturedBody);

      assert.equal('monthlyViewsCount' in parsedBody, false);
      assert.equal(res.data.channel.monthlyViewsCount, null);
    });

    it('should reject with 400 if channel ID is empty before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await updateSellerChannel('', { name: 'Test' }, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.message, 'Channel ID is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should reject with 401 if token is empty before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await updateSellerChannel(testChannelId, { name: 'Test' }, '');
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.message, 'Authentication token is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should throw ApiError with 400 when server rejects update to non-DRAFT channel', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Cannot update channel in status "AVAILABLE". Only DRAFT channels can be edited.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await updateSellerChannel(testChannelId, { name: 'Attempt' }, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 400);
          assert.ok(err.message.includes('Only DRAFT channels can be edited'));
          return true;
        }
      );
    });

    it('should throw ApiError with 403 when non-owner attempts to update', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Forbidden: You do not have permission to update this channel',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await updateSellerChannel(testChannelId, { name: 'Attempted Edit' }, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 403);
          assert.equal(
            err.message,
            'Forbidden: You do not have permission to update this channel'
          );
          return true;
        }
      );
    });

    it('should throw ApiError with 404 when channel is not found', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Channel not found',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await updateSellerChannel(testChannelId, { name: 'Edit' }, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 404);
          assert.equal(err.message, 'Channel not found');
          return true;
        }
      );
    });

    it('should throw ApiError with 500 when server response is malformed', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'OK',
            data: { channel: null },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await updateSellerChannel(testChannelId, { name: 'Edit' }, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 500);
          assert.equal(err.message, 'Unexpected response format from TubeX server.');
          return true;
        }
      );
    });

    it('should throw ApiError on network failure during update', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      await assert.rejects(
        async () => {
          await updateSellerChannel(testChannelId, { name: 'Edit' }, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 0);
          return true;
        }
      );
    });

    it('should propagate AbortError when update request is cancelled via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await updateSellerChannel(testChannelId, { name: 'Edit' }, testToken, {
            signal: controller.signal,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal(err.name, 'AbortError');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // submitChannelForReview
  // =========================================================================
  describe('submitChannelForReview', () => {
    it('should call POST /channels/mine/:id/submit with Bearer token and return updated channel', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedHeaders: HeadersInit | undefined;

      const reviewedChannel = { ...mockSellerChannel, status: 'PENDING_REVIEW' as const };

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = input.toString();
        capturedMethod = init?.method ?? 'GET';
        capturedHeaders = init?.headers;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Channel submitted for review successfully.',
            data: { channel: reviewedChannel },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await submitChannelForReview(testChannelId, testToken);

      assert.equal(capturedUrl, `${API_BASE_URL}/channels/mine/${testChannelId}/submit`);
      assert.equal(capturedMethod, 'POST');

      const headers = capturedHeaders as Record<string, string>;
      assert.equal(headers['Authorization'], `Bearer ${testToken}`);

      assert.equal(res.success, true);
      assert.equal(res.data.channel.status, 'PENDING_REVIEW');
    });

    it('should reject with 400 if channel ID is empty before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await submitChannelForReview('', testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.message, 'Channel ID is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should reject with 401 if token is empty before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await submitChannelForReview(testChannelId, '');
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.message, 'Authentication token is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should throw ApiError with 400 when channel is not in eligible DRAFT status', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Cannot submit channel with status "AVAILABLE" for review. Only DRAFT channels can be submitted.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await submitChannelForReview(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 400);
          assert.ok(err.message.includes('Only DRAFT channels can be submitted'));
          return true;
        }
      );
    });

    it('should throw ApiError with 403 when user does not own the channel', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Forbidden: You do not have permission to submit this channel for review',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await submitChannelForReview(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 403);
          assert.ok(err.message.includes('Forbidden'));
          return true;
        }
      );
    });

    it('should throw ApiError with 404 when channel is not found', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Channel not found',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await submitChannelForReview(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 404);
          assert.equal(err.message, 'Channel not found');
          return true;
        }
      );
    });

    it('should throw ApiError with 500 when server response is malformed', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'OK',
            data: { channel: null },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await submitChannelForReview(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 500);
          assert.equal(err.message, 'Unexpected response format from TubeX server.');
          return true;
        }
      );
    });

    it('should throw ApiError on network connection failure during submit', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      await assert.rejects(
        async () => {
          await submitChannelForReview(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 0);
          return true;
        }
      );
    });

    it('should propagate AbortError when submit request is cancelled via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await submitChannelForReview(testChannelId, testToken, { signal: controller.signal });
        },
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal(err.name, 'AbortError');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // unpublishSellerChannel
  // =========================================================================
  describe('unpublishSellerChannel', () => {
    it('should call POST /channels/mine/:id/unpublish with Bearer token and return delisted channel', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedHeaders: HeadersInit | undefined;

      const delistedChannel = {
        ...mockSellerChannel,
        status: 'DELISTED' as const,
        isPublished: false,
      };

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = input.toString();
        capturedMethod = init?.method ?? 'GET';
        capturedHeaders = init?.headers;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Channel unpublished successfully.',
            data: { channel: delistedChannel },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await unpublishSellerChannel(testChannelId, testToken);

      assert.equal(capturedUrl, `${API_BASE_URL}/channels/mine/${testChannelId}/unpublish`);
      assert.equal(capturedMethod, 'POST');

      const headers = capturedHeaders as Record<string, string>;
      assert.equal(headers['Authorization'], `Bearer ${testToken}`);

      assert.equal(res.success, true);
      assert.equal(res.data.channel.status, 'DELISTED');
      assert.equal(res.data.channel.isPublished, false);
    });

    it('should reject with 400 if channel ID is empty before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await unpublishSellerChannel('', testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.message, 'Channel ID is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should reject with 401 if token is empty before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await unpublishSellerChannel(testChannelId, '');
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.message, 'Authentication token is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should throw ApiError with 400 when attempting to unpublish a channel that is under contract or sold', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Cannot unpublish a channel that is under contract or sold.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await unpublishSellerChannel(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 400);
          assert.equal(
            err.message,
            'Cannot unpublish a channel that is under contract or sold.'
          );
          return true;
        }
      );
    });

    it('should throw ApiError with 403 when user does not own the channel', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Forbidden: You do not have permission to unpublish this channel',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await unpublishSellerChannel(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 403);
          assert.ok(err.message.includes('Forbidden'));
          return true;
        }
      );
    });

    it('should throw ApiError with 404 when channel is not found', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Channel not found',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await unpublishSellerChannel(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 404);
          assert.equal(err.message, 'Channel not found');
          return true;
        }
      );
    });

    it('should throw ApiError with 500 when server response is malformed', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'OK',
            data: { channel: null },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await unpublishSellerChannel(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 500);
          assert.equal(err.message, 'Unexpected response format from TubeX server.');
          return true;
        }
      );
    });

    it('should throw ApiError on network connection failure during unpublish', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      await assert.rejects(
        async () => {
          await unpublishSellerChannel(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 0);
          return true;
        }
      );
    });

    it('should propagate AbortError when unpublish request is cancelled via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await unpublishSellerChannel(testChannelId, testToken, { signal: controller.signal });
        },
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal(err.name, 'AbortError');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // deleteSellerChannel
  // =========================================================================
  describe('deleteSellerChannel', () => {
    it('should call DELETE /channels/mine/:id with Bearer token and return success result', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedHeaders: HeadersInit | undefined;

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = input.toString();
        capturedMethod = init?.method ?? 'GET';
        capturedHeaders = init?.headers;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Channel listing deleted successfully.',
            data: { success: true, id: testChannelId },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await deleteSellerChannel(testChannelId, testToken);

      assert.equal(capturedUrl, `${API_BASE_URL}/channels/mine/${testChannelId}`);
      assert.equal(capturedMethod, 'DELETE');

      const headers = capturedHeaders as Record<string, string>;
      assert.equal(headers['Authorization'], `Bearer ${testToken}`);

      assert.equal(res.success, true);
      assert.equal(res.data.success, true);
      assert.equal(res.data.id, testChannelId);
    });

    it('should reject with 400 if channel ID is empty before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await deleteSellerChannel('', testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.message, 'Channel ID is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should reject with 401 if token is empty before making network request', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await deleteSellerChannel(testChannelId, '');
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.message, 'Authentication token is required.');
          return true;
        }
      );

      assert.equal(fetchCalled, false);
    });

    it('should throw ApiError with 400 when attempting to delete a published listing', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message:
              'Cannot delete a published channel. The listing must be unpublished before deletion.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await deleteSellerChannel(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 400);
          assert.ok(err.message.includes('must be unpublished before deletion'));
          return true;
        }
      );
    });

    it('should throw ApiError with 403 when user does not own the listing to delete', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Forbidden: You do not have permission to delete this channel',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await deleteSellerChannel(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 403);
          assert.ok(err.message.includes('Forbidden'));
          return true;
        }
      );
    });

    it('should throw ApiError with 404 when channel is not found', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Channel not found',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await deleteSellerChannel(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 404);
          assert.equal(err.message, 'Channel not found');
          return true;
        }
      );
    });

    it('should throw ApiError with 500 when server response is missing id', async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Deleted',
            data: { success: true }, // missing id
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      await assert.rejects(
        async () => {
          await deleteSellerChannel(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 500);
          assert.equal(err.message, 'Unexpected response format from TubeX server.');
          return true;
        }
      );
    });

    it('should throw ApiError on network connection failure during delete', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      await assert.rejects(
        async () => {
          await deleteSellerChannel(testChannelId, testToken);
        },
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 0);
          return true;
        }
      );
    });

    it('should propagate AbortError when delete request is cancelled via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        return new Response('{}');
      };

      await assert.rejects(
        async () => {
          await deleteSellerChannel(testChannelId, testToken, { signal: controller.signal });
        },
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal(err.name, 'AbortError');
          return true;
        }
      );
    });
  });
});


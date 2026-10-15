import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeApiBaseUrl,
  buildChannelsQueryString,
  fetchChannels,
  fetchChannelById,
  ApiError,
  API_BASE_URL,
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

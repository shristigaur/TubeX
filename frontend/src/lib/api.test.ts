import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiBaseUrl } from './api.ts';

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

import { describe, it, expect } from 'vitest';
import { validateIntegrationTarget } from '../integration/targetValidator.js';

describe('Integration Target Validator (Gate A)', () => {
  const prodUrl = 'mongodb://127.0.0.1:27018/tubex_prod_synthetic';

  describe('Approved Loopback Hosts', () => {
    it('accepts localhost with an ephemeral port and tubex_test_ database', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://localhost:27018/tubex_test_suite1', prodUrl)
      ).not.toThrow();
    });

    it('accepts 127.0.0.1 with an ephemeral port and tubex_test_ database', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27019/tubex_test_suite1', prodUrl)
      ).not.toThrow();
    });

    it('accepts IPv6 loopback [::1] with an ephemeral port and tubex_test_ database', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://[::1]:27020/tubex_test_suite1', prodUrl)
      ).not.toThrow();
    });

    it('rejects 0.0.0.0 as an ambiguous bind address', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://0.0.0.0:27018/tubex_test_suite1', prodUrl)
      ).toThrow('0.0.0.0 is an ambiguous bind address');
    });

    it('rejects remote hostnames and Atlas clusters', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://remote-db.example.com:27018/tubex_test_1', prodUrl)
      ).toThrow('must target an approved loopback host');

      expect(() =>
        validateIntegrationTarget('mongodb://cluster0.mongodb.net:27018/tubex_test_1', prodUrl)
      ).toThrow('must target an approved loopback host');
    });

    it('rejects host suffix attacks mimicking localhost', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://localhost.attacker.com:27018/tubex_test_1', prodUrl)
      ).toThrow('must target an approved loopback host');
    });
  });

  describe('Port Validation (1024 - 65535, non-default)', () => {
    it('rejects default MongoDB port 27017', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27017/tubex_test_suite1', prodUrl)
      ).toThrow('targets default port 27017');
    });

    it('rejects ports below 1024', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:80/tubex_test_suite1', prodUrl)
      ).toThrow('must be an unprivileged ephemeral port between 1024 and 65535');

      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:1023/tubex_test_suite1', prodUrl)
      ).toThrow('must be an unprivileged ephemeral port between 1024 and 65535');
    });

    it('rejects ports above 65535', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:65536/tubex_test_suite1', prodUrl)
      ).toThrow(/FAIL-CLOSED ISOLATION: TEST_DATABASE_URL is malformed or invalid|port must be an unprivileged ephemeral port/);

      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:99999/tubex_test_suite1', prodUrl)
      ).toThrow(/FAIL-CLOSED ISOLATION: TEST_DATABASE_URL is malformed or invalid|port must be an unprivileged ephemeral port/);
    });

    it('rejects missing or empty ports', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1/tubex_test_suite1', prodUrl)
      ).toThrow('has no explicit port');
    });

    it('accepts boundary ports 1024 and 65535', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:1024/tubex_test_min', prodUrl)
      ).not.toThrow();

      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:65535/tubex_test_max', prodUrl)
      ).not.toThrow();
    });
  });

  describe('Database Name Validation (tubex_test_<suffix>)', () => {
    it('accepts valid tubex_test_ names with alphanumeric and underscore/hyphen suffixes', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27018/tubex_test_alpha123', prodUrl)
      ).not.toThrow();

      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27018/tubex_test_run-99_sub', prodUrl)
      ).not.toThrow();
    });

    it('rejects database names without the tubex_test_ prefix', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27018/production', prodUrl)
      ).toThrow('start with "tubex_test_"');

      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27018/tubex_test', prodUrl)
      ).toThrow('start with "tubex_test_"');
    });

    it('rejects empty suffix after tubex_test_', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27018/tubex_test_', prodUrl)
      ).toThrow('start with "tubex_test_" followed by an allowed non-empty suffix');
    });

    it('rejects extra path segments and trailing slashes', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27018/tubex_test_valid/extra', prodUrl)
      ).toThrow('without extra path segments');

      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27018/tubex_test_valid/', prodUrl)
      ).toThrow('without extra path segments');
    });

    it('rejects percent-encoded database names and characters', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27018/tubex_test_%20hack', prodUrl)
      ).toThrow('start with "tubex_test_" followed by an allowed non-empty suffix');

      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27018/tubex_test_valid%2Fsub', prodUrl)
      ).toThrow('start with "tubex_test_" followed by an allowed non-empty suffix');
    });
  });

  describe('Protocol and Multi-Host Rejection', () => {
    it('rejects mongodb+srv: protocol', () => {
      expect(() =>
        validateIntegrationTarget('mongodb+srv://localhost:27018/tubex_test_1', prodUrl)
      ).toThrow('must strictly use the mongodb: protocol');
    });

    it('rejects non-mongodb protocols like http:', () => {
      expect(() =>
        validateIntegrationTarget('http://localhost:27018/tubex_test_1', prodUrl)
      ).toThrow('must strictly use the mongodb: protocol');
    });

    it('rejects multi-host MongoDB connection strings', () => {
      expect(() =>
        validateIntegrationTarget(
          'mongodb://127.0.0.1:27018,127.0.0.1:27019/tubex_test_replica',
          prodUrl
        )
      ).toThrow('Multi-host replica set URIs are not permitted');

      expect(() =>
        validateIntegrationTarget(
          'mongodb://localhost:27018,localhost:27019/tubex_test_replica',
          prodUrl
        )
      ).toThrow('Multi-host replica set URIs are not permitted');
    });
  });

  describe('Collision with Production DATABASE_URL', () => {
    it('rejects test URL identical to production URL', () => {
      expect(() =>
        validateIntegrationTarget(prodUrl, prodUrl)
      ).toThrow('TEST_DATABASE_URL is identical to DATABASE_URL');
    });

    it('rejects test URL resolving to the same host, port, and database as production', () => {
      const prodTarget = 'mongodb://127.0.0.1:27018/tubex_test_shared';
      const testTargetWithQuery = 'mongodb://127.0.0.1:27018/tubex_test_shared?connectTimeoutMS=5000';
      expect(() =>
        validateIntegrationTarget(testTargetWithQuery, prodTarget)
      ).toThrow('resolves to the same host, port, and database as DATABASE_URL');
    });

    it('rejects loopback alias collision when production is localhost and test is 127.0.0.1', () => {
      const prodAlias = 'mongodb://localhost:27018/tubex_test_dev';
      const testAlias = 'mongodb://127.0.0.1:27018/tubex_test_dev';
      expect(() =>
        validateIntegrationTarget(testAlias, prodAlias)
      ).toThrow('resolves to the same host, port, and database as DATABASE_URL');
    });

    it('rejects loopback alias collision in reverse order when production is 127.0.0.1 and test is localhost', () => {
      const prodAlias = 'mongodb://127.0.0.1:27018/tubex_test_dev';
      const testAlias = 'mongodb://localhost:27018/tubex_test_dev';
      expect(() =>
        validateIntegrationTarget(testAlias, prodAlias)
      ).toThrow('resolves to the same host, port, and database as DATABASE_URL');
    });

    it('rejects loopback alias collision across IPv4 and IPv6 loopback', () => {
      const prodAlias = 'mongodb://[::1]:27018/tubex_test_dev';
      const testAlias = 'mongodb://127.0.0.1:27018/tubex_test_dev';
      expect(() =>
        validateIntegrationTarget(testAlias, prodAlias)
      ).toThrow('resolves to the same host, port, and database as DATABASE_URL');
    });

    it('handles invalid or empty production URL gracefully', () => {
      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27019/tubex_test_isolated', undefined)
      ).not.toThrow();

      expect(() =>
        validateIntegrationTarget('mongodb://127.0.0.1:27019/tubex_test_isolated', 'not-a-valid-url')
      ).not.toThrow();
    });
  });

  describe('Credential and URL Privacy in Errors', () => {
    it('never leaks username or password in error messages for invalid remote targets', () => {
      const syntheticSecret = 'SuperSecretToken999!';
      const syntheticUser = 'secretAdmin';
      let thrownMessage = '';

      try {
        validateIntegrationTarget(
          `mongodb://${syntheticUser}:${syntheticSecret}@evil-remote.example.com:27018/tubex_test_1`,
          prodUrl
        );
      } catch (err: any) {
        thrownMessage = err.message;
      }

      expect(thrownMessage).toContain('must target an approved loopback host');
      expect(thrownMessage).not.toContain(syntheticUser);
      expect(thrownMessage).not.toContain(syntheticSecret);
      expect(thrownMessage).not.toContain('evil-remote.example.com');
    });

    it('never leaks credentials for malformed or multi-host targets', () => {
      const syntheticSecret = 'LeakTestPass123';
      let thrownMessage = '';

      try {
        validateIntegrationTarget(
          `mongodb://admin:${syntheticSecret}@127.0.0.1:27018,127.0.0.1:27019/tubex_test_1`,
          prodUrl
        );
      } catch (err: any) {
        thrownMessage = err.message;
      }

      expect(thrownMessage).toContain('Multi-host replica set URIs are not permitted');
      expect(thrownMessage).not.toContain(syntheticSecret);
    });
  });
});

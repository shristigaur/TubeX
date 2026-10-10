# TubeX Backend Testing Setup

This project uses a highly isolated test environment. By default, running `npm test` will run pure unit tests, and **all database access is mocked and blocked** to prevent accidental mutation of development or production databases.

## Default Test Mode

By default, running `npm run test` executes pure unit tests. **All database access is mocked and blocked.** Any attempt to instantiate Prisma or access a database in default mode will safely fail via a Proxy interceptor.

*Limitation:* This proxy isolates tests from databases, but it cannot run database-backed integration tests.

## Integration Testing with a Disposable Database

To run integration tests, you MUST independently verify and orchestrate a **dedicated disposable MongoDB replica set**.

*Important Distinction:* A URL pointing to `localhost` does not prove a database is disposable. It is merely a prerequisite for safety. You, the developer, are responsible for ensuring that the local port genuinely maps to an ephemeral container, not a persistent dev/prod database.

**Production credentials or remote URLs must NEVER be used for testing. The safety gate will aggressively reject them.**

Prisma requires a replica set (even a single node) to support transactions. We recommend using Docker to provide this disposable environment:

```bash
# 1. Start a new MongoDB container with replica set enabled
docker run --name mongo-tubex-test -p 27018:27017 -d mongo --replSet rs0

# 2. Wait a few seconds for the container to start, then INITIALIZE the replica set
docker exec mongo-tubex-test mongosh --eval "rs.initiate()"

# 3. Wait for the primary node to be elected (usually takes 1-2 seconds)
# READINESS CHECK: Ensure the status is PRIMARY before running tests
docker exec mongo-tubex-test mongosh --eval "rs.status().members[0].stateStr"
# Output should be 'PRIMARY'
```

### Step 2: Run Tests with the Safety Gate Unlocked

You must independently verify that the database provisioned above is fully isolated. No integration tests are authorized to run until disposable-database identity is established.

Once verified, explicitly pass `ENABLE_DB_TESTS=true` and provide the precise local `TEST_DATABASE_URL`. The safety gate will parse and validate this URL.

```bash
# Run the tests, pointing to the port you exposed in Docker (27018 in this example)
ENABLE_DB_TESTS=true TEST_DATABASE_URL="mongodb://127.0.0.1:27018/tubex_test?replicaSet=rs0" npm run test:run
```

### Step 3: Cleanup

After testing, destroy the disposable database:

```bash
docker stop mongo-tubex-test
docker rm mongo-tubex-test
```

### Safety Rules

1. The test runner will reject any `TEST_DATABASE_URL` that maps to the exact same host and database path as your production `DATABASE_URL`.
2. The test runner will reject remote hosts (like MongoDB Atlas).
3. If you do not provide `ENABLE_DB_TESTS=true`, all `prisma` method calls will instantly throw an error.

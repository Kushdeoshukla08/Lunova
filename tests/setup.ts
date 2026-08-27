// Global test setup. Deterministic env for anything that reads it.
process.env.TZ = "UTC";
process.env.AUTH_SECRET ||= "test-secret-test-secret-test-secret-1234";
process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5433/test";
// NODE_ENV is set to "test" by Vitest.

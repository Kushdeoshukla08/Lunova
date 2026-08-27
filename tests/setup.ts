// Global test setup.
import { config } from "dotenv";

// Load real env for DB-touching integration tests (guarded by RUN_DB_TESTS).
config({ path: ".env", quiet: true });

process.env.TZ = "UTC";
process.env.AUTH_SECRET ||= "test-secret-test-secret-test-secret-1234";
process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5433/test";
// NODE_ENV is set to "test" by Vitest.

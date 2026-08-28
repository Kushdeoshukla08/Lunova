import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts", "tests/unit/**/*.{test,spec}.ts"],
    setupFiles: ["tests/setup.ts"],
    // The *.integration.test.ts suites all share one Postgres database, so they
    // must not run in parallel with each other. Pure unit tests are unaffected
    // (they don't touch the DB) but the cost of serialising files is small.
    fileParallelism: process.env.RUN_DB_TESTS !== "1",
  },
});

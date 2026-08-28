import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * `prisma generate` (CI, the Docker build stage) runs without a real
 * `DATABASE_URL` — it only reads the schema, it never connects. Using
 * `env("DATABASE_URL")` here made those contexts throw `PrismaConfigEnvError`.
 * Fall back to a syntactically-valid placeholder; commands that actually touch
 * the database (`migrate deploy`, `db push`, `studio`, `seed`) still require a
 * real value and get it from the environment at that point.
 */
const PLACEHOLDER_DB_URL =
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

const datasource: {
  url: string;
  shadowDatabaseUrl?: string;
} = {
  url: process.env.DATABASE_URL ?? PLACEHOLDER_DB_URL,
};

if (process.env.SHADOW_DATABASE_URL) {
  datasource.shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource,
});

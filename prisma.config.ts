import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const datasource: {
  url: string;
  shadowDatabaseUrl?: string;
} = {
  url: env("DATABASE_URL"),
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

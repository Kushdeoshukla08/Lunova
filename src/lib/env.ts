import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Import only from server code (Server Components,
 * route handlers, server actions, scripts). Never expose secrets to the client;
 * client-visible config must use `NEXT_PUBLIC_` and live in `env.client.ts`.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /**
   * The deployment tier, independent of NODE_ENV (staging also builds with
   * NODE_ENV=production). Drives cookie security, log verbosity, seed guards and
   * the visible environment banner. Keep dev/staging/production fully separated:
   * separate databases, secrets, storage buckets and OAuth apps — see
   * docs/ENVIRONMENTS.md.
   */
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SHADOW_DATABASE_URL: z.string().optional(),

  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  REDIS_URL: z.string().optional(),

  // ── Observability ─────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  /** Bearer token guarding GET /api/metrics. Unset ⇒ the endpoint is disabled. */
  METRICS_TOKEN: z.string().optional(),
  /** Error-tracking DSN (e.g. Sentry). Unset ⇒ errors are logged only. */
  SENTRY_DSN: z.string().optional(),

  MUSIC_PROVIDER: z.enum(["internal", "spotify"]).default("internal"),
  MODERATION_PROVIDER: z.string().default("heuristic"),
  MODERATION_API_KEY: z.string().optional(),
  SMS_PROVIDER: z.string().default("console"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  EMAIL_PROVIDER: z.string().default("console"),
  EMAIL_FROM: z.string().default("Lunova <hello@lunova.local>"),
  RESEND_API_KEY: z.string().optional(),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".uploads"),

  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),

  IDV_PROVIDER: z.string().optional(),
  IDV_API_KEY: z.string().optional(),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = load();
export type Env = typeof env;

/** True for staging and production — anything served over real HTTPS to users. */
export const isProdLike = env.APP_ENV !== "development";

/** True only for the real production tier. */
export const isProduction = env.APP_ENV === "production";

import "server-only";
import { env } from "@/lib/env";

/**
 * Structured logging. One JSON object per line to stdout/stderr in production
 * (ready for any log shipper); a compact human line in development.
 *
 * Principles (see docs/OBSERVABILITY.md):
 *  - Operational, not behavioural. We log what the *system* did, not what a
 *    person did. No per-user activity trails live here.
 *  - PII-minimising. Known sensitive keys are dropped before serialisation and
 *    long strings are truncated — a stray `email`/`token` in a field bag never
 *    reaches the log.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const raw = (env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "info" : "debug")) as LogLevel;
  return LEVEL_WEIGHT[raw] ?? LEVEL_WEIGHT.info;
}

export type Fields = Record<string, unknown>;

/** Keys we never want in a log line, matched case-insensitively as substrings. */
const REDACT_KEYS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "email",
  "phone",
  "code",
  "otp",
  "ip",
  "useragent",
  "body",
  "message_body",
  "lat",
  "latitude",
  "lng",
  "longitude",
];

const MAX_STRING = 512;
const MAX_DEPTH = 4;

function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Fields = {};
    for (const [k, v] of Object.entries(value as Fields)) {
      const lk = k.toLowerCase();
      if (REDACT_KEYS.some((r) => lk.includes(r))) {
        out[k] = "[redacted]";
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

function emit(level: LogLevel, msg: string, fields?: Fields): void {
  if (LEVEL_WEIGHT[level] < threshold()) return;

  const base = {
    ts: new Date().toISOString(),
    level,
    msg,
    env: env.NODE_ENV,
    ...(fields ? (redact(fields) as Fields) : {}),
  };

  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (env.NODE_ENV === "development") {
    const extra = fields ? " " + JSON.stringify(redact(fields)) : "";
    sink(`${level.toUpperCase().padEnd(5)} ${msg}${extra}`);
  } else {
    sink(JSON.stringify(base));
  }
}

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  /** Bind fields onto every subsequent line (e.g. a component name). */
  child(bound: Fields): Logger;
  /** Start a timer; call the returned fn to log `${msg} done` with `ms`. */
  timer(msg: string, fields?: Fields): () => void;
}

function make(bound: Fields = {}): Logger {
  const merge = (f?: Fields) => ({ ...bound, ...(f ?? {}) });
  return {
    debug: (m, f) => emit("debug", m, merge(f)),
    info: (m, f) => emit("info", m, merge(f)),
    warn: (m, f) => emit("warn", m, merge(f)),
    error: (m, f) => emit("error", m, merge(f)),
    child: (b) => make({ ...bound, ...b }),
    timer: (m, f) => {
      const start = Date.now();
      return () => emit("info", `${m} done`, merge({ ...f, ms: Date.now() - start }));
    },
  };
}

export const log: Logger = make();

/** Test seam. */
export const __redactForTests = redact;

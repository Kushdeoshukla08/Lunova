/**
 * Locale- and timezone-aware formatting. Pure functions — no request context is
 * read here. Server code resolves a `FormatContext` once (see `getFormatContext`
 * in `./locale`) and threads it down; client components receive the same fields
 * as props. When no options are passed the functions fall back to English and
 * the runtime's own timezone, so they stay safe to call from anywhere.
 */
import {
  DEFAULT_LOCALE,
  intlLocale,
  unitSystemFor,
  type Locale,
  type UnitSystem,
} from "./config";

export interface FormatContext {
  locale: Locale;
  /** IANA timezone, e.g. "Europe/Berlin". */
  timeZone: string;
  units: UnitSystem;
}

export interface FormatOptions {
  locale?: Locale;
  timeZone?: string;
  units?: UnitSystem;
}

function tag(opts?: FormatOptions): string {
  return intlLocale(opts?.locale ?? DEFAULT_LOCALE);
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Y-M-D in a given timezone, for "is this the same calendar day" checks. */
function ymd(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Compact relative time — "now", "3m", "2h", then a weekday, then a date. */
export function formatRelative(
  value: Date | string | number,
  opts?: FormatOptions,
): string {
  const d = toDate(value);
  const diff = Date.now() - d.getTime();
  const min = diff / 60_000;
  if (min < 1) return "now";
  if (min < 60) return `${Math.floor(min)}m`;
  const hr = min / 60;
  if (hr < 24) return `${Math.floor(hr)}h`;
  const day = hr / 24;
  if (day < 7) {
    return new Intl.DateTimeFormat(tag(opts), {
      timeZone: opts?.timeZone,
      weekday: "short",
    }).format(d);
  }
  return new Intl.DateTimeFormat(tag(opts), {
    timeZone: opts?.timeZone,
    day: "numeric",
    month: "short",
  }).format(d);
}

/** Time only, for message bubbles. */
export function formatTime(
  value: Date | string | number,
  opts?: FormatOptions,
): string {
  return new Intl.DateTimeFormat(tag(opts), {
    timeZone: opts?.timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(toDate(value));
}

/** "Today" / "Yesterday" / a full weekday-date heading for a day of messages. */
export function formatDayHeading(
  value: Date | string | number,
  opts?: FormatOptions,
): string {
  const d = toDate(value);
  const tz = opts?.timeZone;
  const now = new Date();
  const todayKey = ymd(now, tz);
  const yestKey = ymd(new Date(now.getTime() - 86_400_000), tz);
  const key = ymd(d, tz);
  if (key === todayKey) return "Today";
  if (key === yestKey) return "Yesterday";
  return new Intl.DateTimeFormat(tag(opts), {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/** A full calendar date, ordered per the locale ("August 28, 2026" / "28 August 2026"). */
export function formatDate(
  value: Date | string | number,
  opts?: FormatOptions,
): string {
  return new Intl.DateTimeFormat(tag(opts), {
    timeZone: opts?.timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toDate(value));
}

export function formatNumber(value: number, opts?: FormatOptions): string {
  return new Intl.NumberFormat(tag(opts)).format(value);
}

const MILES_PER_KM = 0.621371;

/**
 * A coarse, privacy-preserving distance label. Never precise: it rounds hard and
 * collapses anything close to "Nearby" so a viewer can't triangulate a location.
 * Unit follows regional convention (`opts.units`), defaulting to metric.
 */
export function formatDistance(
  km: number | null | undefined,
  opts?: FormatOptions & { precision?: string },
): string | null {
  if (km == null) return null;
  const units = opts?.units ?? "metric";
  const precision = opts?.precision ?? "CITY";

  if (units === "imperial") {
    const mi = km * MILES_PER_KM;
    if (mi < 1) return "Nearby";
    const step = precision === "REGION" ? 15 : precision === "NEIGHBORHOOD" ? 1 : 3;
    const rounded = Math.max(1, Math.round(mi / step) * step);
    return `${formatNumber(rounded, opts)} mi away`;
  }

  if (km < 2) return "Nearby";
  const step = precision === "REGION" ? 25 : precision === "NEIGHBORHOOD" ? 1 : 5;
  const rounded = Math.max(2, Math.round(km / step) * step);
  return `${formatNumber(rounded, opts)} km away`;
}

/** Derive a full context from a locale + optional timezone/country. */
export function formatContext(
  locale: Locale,
  timeZone: string,
  country?: string | null,
): FormatContext {
  return { locale, timeZone, units: unitSystemFor(locale, country) };
}

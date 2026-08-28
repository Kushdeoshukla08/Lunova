import "server-only";
import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  TIMEZONE_COOKIE,
  unitSystemFor,
  type Locale,
} from "./config";
import { formatContext, type FormatContext } from "./format";
import { getDictionary } from "./messages";
import type { Messages } from "./messages/en";

/** Parse an `Accept-Language` header into an ordered list of base language tags. */
function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((x) => x.tag && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag.split("-")[0]);
}

/**
 * Resolve the UI locale for this request: explicit cookie choice wins, then the
 * browser's `Accept-Language`, then the default. Only locales we actually ship
 * (`LOCALES`) are ever returned.
 */
export async function resolveLocale(): Promise<Locale> {
  const jar = await cookies();
  const chosen = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const h = await headers();
  for (const lang of parseAcceptLanguage(h.get("accept-language"))) {
    if (isLocale(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}

const IANA_RE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2}$/;

function validTimeZone(tz: string | undefined | null): tz is string {
  if (!tz || !IANA_RE.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the timezone for date rendering. A caller-supplied preference (the
 * signed-in user's `profile.timezone`) wins; then the `lunova_tz` cookie the
 * client sets from `Intl.DateTimeFormat().resolvedOptions().timeZone`; then UTC.
 * UTC is a safe, explicit fallback — never the server's local zone.
 */
export async function resolveTimeZone(preferred?: string | null): Promise<string> {
  if (validTimeZone(preferred)) return preferred;
  const jar = await cookies();
  const cookieTz = jar.get(TIMEZONE_COOKIE)?.value;
  if (validTimeZone(cookieTz)) return cookieTz;
  return "UTC";
}

export interface I18nContext extends FormatContext {
  dict: Messages;
}

/**
 * One call for a Server Component to get everything formatting-related: the
 * locale, a resolved timezone, the derived unit system, and the message
 * dictionary. Pass `{ timeZone, country }` from the user's profile when known.
 */
export async function getI18n(opts?: {
  timeZone?: string | null;
  country?: string | null;
}): Promise<I18nContext> {
  const [locale, timeZone] = await Promise.all([
    resolveLocale(),
    resolveTimeZone(opts?.timeZone),
  ]);
  return {
    ...formatContext(locale, timeZone, opts?.country),
    dict: getDictionary(locale),
  };
}

/** Just the formatting context, when the dictionary isn't needed. */
export async function getFormatContext(opts?: {
  timeZone?: string | null;
  country?: string | null;
}): Promise<FormatContext> {
  const [locale, timeZone] = await Promise.all([
    resolveLocale(),
    resolveTimeZone(opts?.timeZone),
  ]);
  return formatContext(locale, timeZone, opts?.country);
}

export { unitSystemFor };

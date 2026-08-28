/**
 * i18n configuration — the single source of truth for which locales exist and
 * how regional conventions are derived. English is the only shipped locale
 * today; everything here is built so that adding a locale is a data change
 * (a new message catalog + an entry in `LOCALES`), never a code change.
 */

export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie names owned by the i18n layer. */
export const LOCALE_COOKIE = "lunova_locale";
export const TIMEZONE_COOKIE = "lunova_tz";

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

/**
 * Human label for a locale, shown in the language picker. Rendered in the
 * locale's own language ("English", "Français", …) so it's recognisable
 * regardless of the current UI language.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
};

export type UnitSystem = "metric" | "imperial";

/**
 * Regions (ISO 3166-1 alpha-2) that use miles for everyday distance. Deliberately
 * small and explicit — the rest of the world gets kilometres. Distance unit is a
 * regional convention, not a language one: `en` is spoken across mostly-metric
 * countries, so an unknown country falls back to **metric**, never to a
 * language-implied guess. Imperial is only chosen when we actually know the
 * country.
 */
const IMPERIAL_COUNTRIES = new Set(["US", "GB", "LR", "MM"]);

// Reserved: when a future locale genuinely implies a region (e.g. a country-
// specific catalog), map it here. Empty today — no locale assumes a country.
const LOCALE_DEFAULT_COUNTRY: Partial<Record<Locale, string>> = {};

export function unitSystemFor(locale: Locale, country?: string | null): UnitSystem {
  const cc = (country ?? LOCALE_DEFAULT_COUNTRY[locale] ?? "").toUpperCase();
  return IMPERIAL_COUNTRIES.has(cc) ? "imperial" : "metric";
}

/**
 * A BCP-47 tag for `Intl.*`. Today locale === language tag, but this indirection
 * means a future "pt-BR" catalog keyed as "pt_br" still maps cleanly.
 */
export function intlLocale(locale: Locale): string {
  return locale;
}

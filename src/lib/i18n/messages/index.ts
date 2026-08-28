import { DEFAULT_LOCALE, type Locale } from "../config";
import { en, type Messages } from "./en";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * Registered catalogs. `en` is complete; others are partial and merged over `en`
 * so an untranslated key always renders *something* in English rather than a raw
 * key. Add a locale by importing its catalog and listing it here.
 */
const CATALOGS: Record<Locale, DeepPartial<Messages>> = {
  en,
};

function deepMerge<T>(base: T, override: DeepPartial<T>): T {
  const out = { ...base } as T;
  for (const key of Object.keys(override) as (keyof T)[]) {
    const o = override[key] as unknown;
    const b = out[key] as unknown;
    if (o && b && typeof o === "object" && typeof b === "object" && !Array.isArray(o)) {
      out[key] = deepMerge(b, o as DeepPartial<typeof b>) as T[keyof T];
    } else if (o !== undefined) {
      out[key] = o as T[keyof T];
    }
  }
  return out;
}

const cache = new Map<Locale, Messages>();

export function getDictionary(locale: Locale): Messages {
  const hit = cache.get(locale);
  if (hit) return hit;
  const merged =
    locale === DEFAULT_LOCALE ? en : deepMerge(en, CATALOGS[locale] ?? {});
  cache.set(locale, merged);
  return merged;
}

/** Dot-path keys into the dictionary, e.g. `"nav.discover"`. */
type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never;
type Paths<T> = {
  [K in keyof T]: T[K] extends object ? Join<K, Paths<T[K]>> : K & string;
}[keyof T];

export type MessageKey = Paths<Messages>;

/**
 * Resolve a dot-path key against a dictionary, interpolating `{var}` tokens.
 * Falls back to the English string, then the key itself, so a bad key is
 * visible in dev without throwing in production.
 */
export function t(
  dict: Messages,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const read = (d: unknown): string | undefined => {
    let cur: unknown = d;
    for (const part of key.split(".")) {
      if (cur && typeof cur === "object" && part in cur) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return typeof cur === "string" ? cur : undefined;
  };

  const raw = read(dict) ?? read(en) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

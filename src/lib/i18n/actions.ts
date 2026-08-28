"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE, TIMEZONE_COOKIE } from "./config";
import { isProdLike } from "@/lib/env";

const ONE_YEAR = 60 * 60 * 24 * 365;

export type LocaleResult = { ok: true } | { ok: false; error: string };

/**
 * Persist the user's language choice in a first-party cookie. Not httpOnly — a
 * language preference is not a secret and the client benefits from reading it —
 * but SameSite=Lax and not exposed in any URL.
 */
export async function setLocaleAction(
  _prev: LocaleResult | null,
  fd: FormData,
): Promise<LocaleResult> {
  const value = String(fd.get("locale") ?? "");
  if (!isLocale(value)) return { ok: false, error: "That language isn't available yet." };

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, value, {
    maxAge: ONE_YEAR,
    sameSite: "lax",
    secure: isProdLike,
    path: "/",
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const IANA_RE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2}$/;

/**
 * Called once from the client with the browser's resolved IANA timezone so the
 * server can render dates in the viewer's zone before we have a saved profile.
 * Silently ignores anything that isn't a plausible IANA name.
 */
export async function setTimeZoneAction(tz: string): Promise<void> {
  if (!IANA_RE.test(tz)) return;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    return;
  }
  const jar = await cookies();
  if (jar.get(TIMEZONE_COOKIE)?.value === tz) return;
  jar.set(TIMEZONE_COOKIE, tz, { maxAge: ONE_YEAR, sameSite: "lax", secure: isProdLike, path: "/" });
}

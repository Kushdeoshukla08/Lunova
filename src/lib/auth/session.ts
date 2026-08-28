import "server-only";
import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { env, isProdLike } from "@/lib/env";
import { generateToken, hashToken } from "./tokens";

const COOKIE = "lunova_session";
const TTL_MS = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
/** Only touch `lastUsedAt` at most this often, to avoid a write per request. */
const SLIDE_THROTTLE_MS = 60 * 60 * 1000;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure on any real deployment (staging + production are HTTPS); plain
    // http://localhost dev is the only exception.
    secure: isProdLike,
    path: "/",
    expires,
  };
}

async function requestContext() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const userAgent = h.get("user-agent") ?? null;
  return { ip, userAgent };
}

function uaFingerprint(userAgent: string | null, ip: string | null): string {
  return createHash("sha256")
    .update(`${userAgent ?? ""}|${ip ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

/** Create a session row + set the cookie. Call only from a Server Action / Route Handler. */
export async function createSession(userId: string): Promise<void> {
  const { ip, userAgent } = await requestContext();
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + TTL_MS);

  const device = await db.device.upsert({
    where: { userId_uaHash: { userId, uaHash: uaFingerprint(userAgent, ip) } },
    update: { lastSeenAt: new Date() },
    create: {
      userId,
      uaHash: uaFingerprint(userAgent, ip),
      label: shortUaLabel(userAgent),
    },
  });

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip,
      userAgent,
      deviceId: device.id,
    },
  });

  const store = await cookies();
  store.set(COOKIE, token, cookieOptions(expiresAt));
}

export type SessionRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
};

/** Resolve the current session row from the cookie, or null. Does not throw. */
export async function readSession(): Promise<SessionRecord | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true, lastUsedAt: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  if (Date.now() - session.lastUsedAt.getTime() > SLIDE_THROTTLE_MS) {
    // best-effort sliding activity timestamp
    db.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return { id: session.id, userId: session.userId, expiresAt: session.expiresAt };
}

/** Revoke the current session and clear the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (raw) {
    await db.session
      .updateMany({
        where: { tokenHash: hashToken(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => {});
  }
  store.delete(COOKIE);
}

/** Revoke every session for a user (password change, ban, "log out everywhere"). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null, id: exceptSessionId ? { not: exceptSessionId } : undefined },
    data: { revokedAt: new Date() },
  });
}

function shortUaLabel(ua: string | null): string | undefined {
  if (!ua) return undefined;
  const browser = /Firefox\/[\d.]+/.test(ua)
    ? "Firefox"
    : /Edg\//.test(ua)
      ? "Edge"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iOS/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "device";
  return `${browser} on ${os}`;
}

"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimiter, RATE_RULES } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/security/client-ip";
import { hashPassword, verifyPasswordConstantTime } from "./password";
import { createSession, destroySession } from "./session";
import { getCurrentUser } from "./dal";
import { generateNumericCode, hashToken, MAX_OTP_ATTEMPTS } from "./tokens";
import { sendEmailBestEffort } from "@/lib/providers/email";
import {
  recordLoginAttempt,
  recordSafetyEvent,
  recentFailedLogins,
} from "@/lib/safety/events";
import { logInSchema, signUpSchema, verifyCodeSchema } from "@/lib/validation/auth";
import { metrics } from "@/lib/observability/metrics";

function authMetric(action: string, outcome: string): void {
  metrics.increment(
    "lunova_auth_attempts_total",
    { action, outcome },
    "Authentication attempts by action and outcome",
  );
}

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  notice?: string;
};

const CODE_TTL_MS = 15 * 60 * 1000;

async function clientIp(): Promise<string> {
  return clientIpFrom(await headers(), { trustedProxyHops: env.TRUSTED_PROXY_HOPS });
}

async function issueEmailCode(userId: string, email: string): Promise<{ ok: boolean }> {
  const code = generateNumericCode(6);
  await db.verificationToken.create({
    data: {
      userId,
      kind: "EMAIL",
      target: email,
      codeHash: hashToken(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  // Best-effort: an email-provider outage must not fail signup. The code row
  // exists; the user can hit "resend". `resendVerificationAction` surfaces a
  // hard failure to the user.
  return sendEmailBestEffort({
    to: email,
    subject: "Your Lunova verification code",
    text: `Welcome to Lunova.\n\nYour verification code is ${code}\nIt expires in 15 minutes.\n\nIf you didn't create an account, you can ignore this email.`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = await clientIp();

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    birthdate: formData.get("birthdate"),
    acceptTerms: formData.get("acceptTerms"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { email, password, birthdate } = parsed.data;

  const [ipLimit, emailLimit] = await Promise.all([
    rateLimiter.check(`signup:ip:${ip}`, RATE_RULES.signup),
    rateLimiter.check(`signup:email:${email}`, RATE_RULES.resendCode),
  ]);
  if (!ipLimit.ok || !emailLimit.ok) {
    return { error: "Too many attempts. Try again in a little while." };
  }

  // Always spend the hashing cost, before the existence check, so the response
  // time doesn't reveal whether the email is already registered.
  const passwordHash = await hashPassword(password);

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return {
      notice:
        "If that email is available, your account is ready — check your inbox for a code.",
    };
  }
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      birthdate,
      ageVerifiedAt: new Date(),
      status: "PENDING",
      preference: { create: {} },
      privacy: { create: {} },
      trust: { create: {} },
      notificationPref: { create: {} },
    },
    select: { id: true },
  });

  await recordSafetyEvent({
    userId: user.id,
    type: "SIGNUP",
    source: "auth",
    metadata: { ip },
  });
  await issueEmailCode(user.id, email);
  await createSession(user.id);

  redirect("/verify");
}

// ─────────────────────────────────────────────────────────────────────────────

export async function logInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = await clientIp();
  const h = await headers();
  const userAgent = h.get("user-agent");

  const parsed = logInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { email, password } = parsed.data;

  const [ipLimit, emailLimit] = await Promise.all([
    rateLimiter.check(`login:ip:${ip}`, RATE_RULES.login),
    rateLimiter.check(`login:email:${email}`, RATE_RULES.loginPerEmail),
  ]);
  if (!ipLimit.ok || !emailLimit.ok) {
    authMetric("login", "rate_limited");
    return { error: "Too many sign-in attempts. Please wait a few minutes." };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, status: true, emailVerifiedAt: true },
  });

  const ok = await verifyPasswordConstantTime(password, user?.passwordHash);

  if (!user || !ok) {
    await recordLoginAttempt({
      email,
      success: false,
      reason: user ? "bad_password" : "no_user",
      userId: user?.id,
      ip,
      userAgent,
    });
    if (user) {
      const fails = await recentFailedLogins(email);
      if (fails >= 5) {
        await recordSafetyEvent({
          userId: user.id,
          type: "SUSPICIOUS_LOGIN",
          severity: "MEDIUM",
          source: "auth",
          metadata: { ip, recentFailures: fails },
        });
      }
    }
    authMetric("login", user ? "bad_password" : "no_user");
    return { error: "That email or password doesn't look right." };
  }

  if (user.status === "BANNED") {
    await recordLoginAttempt({ email, success: false, reason: "banned", userId: user.id, ip, userAgent });
    authMetric("login", "banned");
    return { error: "This account has been permanently closed." };
  }

  await recordLoginAttempt({ email, success: true, reason: "ok", userId: user.id, ip, userAgent });
  authMetric("login", "success");
  await db.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });
  await createSession(user.id);

  if (user.status === "SUSPENDED") redirect("/account/hold");
  if (!user.emailVerifiedAt) redirect("/verify");
  if (user.status === "PENDING") redirect("/onboarding");
  redirect("/discover");
}

// ─────────────────────────────────────────────────────────────────────────────

export async function logOutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function resendVerificationAction(): Promise<AuthFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) redirect("/discover");

  const limit = await rateLimiter.check(`resend:${user.id}`, RATE_RULES.resendCode);
  if (!limit.ok) {
    return { error: "You've asked for a few codes already — try again in an hour." };
  }
  const sent = await issueEmailCode(user.id, user.email);
  if (!sent.ok) {
    return { error: "We couldn't send the email just now. Try again in a moment." };
  }
  return { notice: "New code sent. Check your inbox." };
}

export async function verifyEmailAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) redirect("/onboarding");

  const limit = await rateLimiter.check(`verify:${user.id}`, RATE_RULES.verifyCode);
  if (!limit.ok) {
    return { error: "Too many tries. Request a fresh code in a few minutes." };
  }

  const parsed = verifyCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const token = await db.verificationToken.findFirst({
    where: {
      userId: user.id,
      kind: "EMAIL",
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!token || token.codeHash !== hashToken(parsed.data.code)) {
    if (token) {
      const updated = await db.verificationToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      if (updated.attempts >= MAX_OTP_ATTEMPTS) {
        // Burn the code — too many wrong guesses. A fresh one must be requested.
        await db.verificationToken.update({
          where: { id: token.id },
          data: { consumedAt: new Date() },
        });
      }
    }
    return { fieldErrors: { code: ["That code isn't right or has expired."] } };
  }

  await db.$transaction([
    db.verificationToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    }),
    db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    }),
    db.trustProfile.update({
      where: { userId: user.id },
      data: { emailVerified: true },
    }),
  ]);
  await recordSafetyEvent({
    userId: user.id,
    type: "EMAIL_VERIFIED",
    source: "auth",
  });

  redirect("/onboarding");
}

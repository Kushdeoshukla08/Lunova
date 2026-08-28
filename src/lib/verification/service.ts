import "server-only";
import { db } from "@/lib/db";
import { generateNumericCode, hashToken, MAX_OTP_ATTEMPTS } from "@/lib/auth/tokens";
import { sendSmsBestEffort } from "@/lib/providers/sms";
import { storage } from "@/lib/providers/storage";
import { idv } from "./provider";
import { isRetryableHttp, withRetry } from "@/lib/providers/resilience";
import { recordSafetyEvent } from "@/lib/safety/events";
import { notify } from "@/lib/notifications/service";

const CODE_TTL_MS = 10 * 60 * 1000;

export interface VerificationStatus {
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  photo: "none" | "pending" | "approved" | "rejected";
}

export async function getVerificationStatus(userId: string): Promise<VerificationStatus> {
  const [user, latestPhoto] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true, phone: true, phoneVerifiedAt: true },
    }),
    db.identityCheck.findFirst({
      where: { userId, kind: "PHOTO_SELFIE" },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    }),
  ]);
  return {
    emailVerified: Boolean(user.emailVerifiedAt),
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    photo: !latestPhoto
      ? "none"
      : latestPhoto.status === "APPROVED"
        ? "approved"
        : latestPhoto.status === "REJECTED"
          ? "rejected"
          : "pending",
  };
}

// ─── Phone ───────────────────────────────────────────────────────────────────

export async function startPhoneVerification(
  userId: string,
  phoneE164: string,
): Promise<{ ok: boolean }> {
  // store the (unverified) phone; uniqueness is enforced by the schema
  await db.user.update({ where: { id: userId }, data: { phone: phoneE164 } });
  const code = generateNumericCode(6);
  await db.verificationToken.create({
    data: {
      userId,
      kind: "PHONE",
      target: phoneE164,
      codeHash: hashToken(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return sendSmsBestEffort({
    to: phoneE164,
    text: `Your Lunova code is ${code}. It expires in 10 minutes.`,
  });
}

export async function confirmPhone(
  userId: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = await db.verificationToken.findFirst({
    where: { userId, kind: "PHONE", consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!token || token.codeHash !== hashToken(code)) {
    if (token) {
      const updated = await db.verificationToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      if (updated.attempts >= MAX_OTP_ATTEMPTS) {
        await db.verificationToken.update({
          where: { id: token.id },
          data: { consumedAt: new Date() },
        });
      }
    }
    return { ok: false, error: "That code isn't right or has expired." };
  }
  await db.$transaction([
    db.verificationToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } }),
    db.user.update({
      where: { id: userId },
      data: { phone: token.target, phoneVerifiedAt: new Date() },
    }),
    db.trustProfile.update({ where: { userId }, data: { phoneVerified: true } }),
  ]);
  await recordSafetyEvent({ userId, type: "PHONE_VERIFIED", source: "auth" });
  return { ok: true };
}

// ─── Photo / identity ────────────────────────────────────────────────────────

export async function submitPhotoVerification(
  userId: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ status: "pending" | "approved" | "rejected"; reason?: string }> {
  // transient storage — deleted on decision
  const { key } = await storage.put("verification", bytes, contentType);
  const check = await db.identityCheck.create({
    data: {
      userId,
      kind: "PHOTO_SELFIE",
      status: "PENDING",
      provider: idv.name,
      evidenceKey: key,
    },
    select: { id: true },
  });

  // If the IDV vendor is unreachable, leave the check PENDING for manual review
  // rather than failing the user's submission.
  let result: Awaited<ReturnType<typeof idv.submitPhoto>>;
  try {
    result = await withRetry(
      () => idv.submitPhoto({ userId, selfie: bytes, contentType }),
      { label: `idv.submitPhoto(${idv.name})`, retries: 1, timeoutMs: 12_000, retryable: isRetryableHttp },
    );
  } catch (err) {
    console.error("[idv] submitPhoto failed — leaving check PENDING:", err);
    return { status: "pending" };
  }

  if (result.outcome === "pending") {
    return { status: "pending" };
  }

  const approved = result.outcome === "approved";
  await db.$transaction([
    db.identityCheck.update({
      where: { id: check.id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        providerRef: result.providerRef,
        notes: result.reason,
        decidedAt: new Date(),
        evidenceKey: null, // dropped after decision
      },
    }),
    ...(approved
      ? [db.trustProfile.update({ where: { userId }, data: { photoVerified: true } })]
      : []),
  ]);
  await storage.delete(key);

  if (approved) {
    await recordSafetyEvent({ userId, type: "PHOTO_VERIFIED", source: "system" });
    await notify(userId, "VERIFICATION_COMPLETE", { kind: "photo" });
  } else {
    await notify(userId, "VERIFICATION_REJECTED", { kind: "photo", reason: result.reason });
  }
  return { status: approved ? "approved" : "rejected", reason: result.reason };
}

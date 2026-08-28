"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { rateLimiter, RATE_RULES } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import {
  MAX_IMAGE_BYTES,
  checkImageUpload,
  imageRejectionMessage,
} from "@/lib/media/image";
import {
  confirmPhone,
  startPhoneVerification,
  submitPhotoVerification,
} from "./service";

export type VerifyResult = { ok: true; note?: string } | { ok: false; error: string };

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, { error: "Enter a phone number in +country format, e.g. +14155550123." });

const codeSchema = z.string().trim().regex(/^\d{6}$/, { error: "Enter the 6-digit code." });

export async function startPhoneVerificationAction(
  _prev: VerifyResult | null,
  fd: FormData,
): Promise<VerifyResult> {
  const user = await requireOnboardedUser();
  const parsed = phoneSchema.safeParse(fd.get("phone"));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const limit = await rateLimiter.check(`phoneverify:${user.id}`, RATE_RULES.resendCode);
  if (!limit.ok) return { ok: false, error: "Too many attempts — try again later." };

  const taken = await db.user.findFirst({
    where: { phone: parsed.data, id: { not: user.id }, phoneVerifiedAt: { not: null } },
    select: { id: true },
  });
  if (taken) return { ok: false, error: "That number is already in use." };

  const sent = await startPhoneVerification(user.id, parsed.data);
  revalidatePath("/verify/phone");
  if (!sent.ok) {
    return { ok: false, error: "We couldn't send the text just now. Try again in a moment." };
  }
  return { ok: true, note: "Code sent. (Dev: check the server console.)" };
}

export async function confirmPhoneAction(
  _prev: VerifyResult | null,
  fd: FormData,
): Promise<VerifyResult> {
  const user = await requireOnboardedUser();
  const parsed = codeSchema.safeParse(fd.get("code"));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const limit = await rateLimiter.check(`phoneconfirm:${user.id}`, RATE_RULES.verifyCode);
  if (!limit.ok) return { ok: false, error: "Too many tries. Request a fresh code." };

  const res = await confirmPhone(user.id, parsed.data);
  if (!res.ok) return { ok: false, error: res.error! };
  revalidatePath("/verify/phone");
  revalidatePath("/settings");
  return { ok: true, note: "Phone verified." };
}

export async function submitPhotoVerificationAction(
  _prev: VerifyResult | null,
  fd: FormData,
): Promise<VerifyResult> {
  const user = await requireOnboardedUser();
  const file = fd.get("selfie");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Take or choose a selfie to continue." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: imageRejectionMessage("too-large") };
  }

  const limit = await rateLimiter.check(`photoverify:${user.id}`, RATE_RULES.resendCode);
  if (!limit.ok) return { ok: false, error: "Too many submissions — try again later." };

  const bytes = Buffer.from(await file.arrayBuffer());
  // Same byte-level identification as profile photos — a selfie upload is not a
  // second, weaker door into the object store.
  const check = checkImageUpload(bytes, file.type);
  if (!check.ok) return { ok: false, error: imageRejectionMessage(check.reason) };

  const res = await submitPhotoVerification(user.id, bytes, check.info.mime);
  revalidatePath("/verify/photo");
  revalidatePath("/settings");
  if (res.status === "approved") return { ok: true, note: "You're verified." };
  if (res.status === "pending") return { ok: true, note: "Submitted — we'll let you know shortly." };
  return { ok: false, error: "That photo didn't pass. Good light, face clearly visible, try again." };
}

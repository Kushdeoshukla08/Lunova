"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/dal";
import { destroySession, revokeAllSessions } from "@/lib/auth/session";
import { readSession } from "@/lib/auth/session";
import { storage } from "@/lib/providers/storage";
import { Visibility, ProfileVisibility } from "@/generated/prisma/enums";

export type SettingsResult = { ok: true } | { ok: false; error: string };

// ─── Notifications ───────────────────────────────────────────────────────────

const notifBool = (fd: FormData, k: string) => fd.get(k) === "on";

export async function updateNotificationPrefsAction(
  _prev: SettingsResult | null,
  fd: FormData,
): Promise<SettingsResult> {
  const user = await requireUser();
  await db.notificationPreference.update({
    where: { userId: user.id },
    data: {
      newLike: notifBool(fd, "newLike"),
      newMatch: notifBool(fd, "newMatch"),
      newMessage: notifBool(fd, "newMessage"),
      safety: true, // safety alerts can't be turned off
      security: true,
      product: notifBool(fd, "product"),
      channelEmail: notifBool(fd, "channelEmail"),
      channelPush: notifBool(fd, "channelPush"),
    },
  });
  revalidatePath("/settings/notifications");
  return { ok: true };
}

// ─── Privacy ─────────────────────────────────────────────────────────────────

const privacySchema = z.object({
  profileVisibility: z.enum(ProfileVisibility),
  musicVisibility: z.enum(Visibility),
  activityVisibility: z.enum(Visibility),
  distanceVisibility: z.enum(Visibility),
  showAgeExact: z.boolean(),
});

export async function updatePrivacyAction(
  _prev: SettingsResult | null,
  fd: FormData,
): Promise<SettingsResult> {
  const user = await requireUser();
  const parsed = privacySchema.safeParse({
    profileVisibility: fd.get("profileVisibility"),
    musicVisibility: fd.get("musicVisibility"),
    activityVisibility: fd.get("activityVisibility"),
    distanceVisibility: fd.get("distanceVisibility"),
    showAgeExact: fd.get("showAgeExact") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Something looked off — try again." };
  await db.privacySetting.update({ where: { userId: user.id }, data: parsed.data });
  revalidatePath("/settings/privacy");
  return { ok: true };
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function revokeSessionAction(sessionId: string): Promise<SettingsResult> {
  const user = await requireUser();
  const current = await readSession();
  await db.session.updateMany({
    where: { id: sessionId, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/settings/security");
  if (current?.id === sessionId) {
    await destroySession();
    redirect("/login");
  }
  return { ok: true };
}

export async function signOutEverywhereAction(): Promise<void> {
  const user = await requireUser();
  await revokeAllSessions(user.id);
  await destroySession();
  redirect("/login");
}

// ─── Account deletion (irreversible — anonymises) ─────────────────────────────

export async function deleteAccountAction(
  _prev: SettingsResult | null,
  fd: FormData,
): Promise<SettingsResult> {
  const user = await requireUser();
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { ok: false, error: 'Type DELETE to confirm.' };
  }

  const photos = await db.photo.findMany({
    where: { profile: { userId: user.id } },
    select: { storageKey: true },
  });

  await db.$transaction(async (tx) => {
    // close any live matches
    await tx.match.updateMany({
      where: {
        closedAt: null,
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
      data: { closedAt: new Date(), closeReason: "ACCOUNT_REMOVED" },
    });
    // drop profile + all its children (cascade), preferences, privacy, sessions
    await tx.profile.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.device.deleteMany({ where: { userId: user.id } });
    await tx.like.deleteMany({
      where: { OR: [{ actorId: user.id }, { targetId: user.id }] },
    });
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.verificationToken.deleteMany({ where: { userId: user.id } });
    // scrub the content of messages this user sent — the other party keeps a
    // tombstone, not the words.
    await tx.message.updateMany({
      where: { senderId: user.id, deletedAt: null },
      data: { body: "", deletedAt: new Date() },
    });
    // anonymise the account shell (kept for referential integrity of others' data)
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: `deleted+${user.id}@lunova.invalid`,
        phone: null,
        passwordHash: "",
        status: "DELETED",
        deletedAt: new Date(),
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      },
    });
  });

  await Promise.all(photos.map((p) => storage.delete(p.storageKey)));
  await destroySession();
  redirect("/?goodbye=1");
}

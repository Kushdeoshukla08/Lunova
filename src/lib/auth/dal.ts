import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "./session";
import type { Role } from "@/generated/prisma/enums";

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  status: string;
  emailVerifiedAt: Date | null;
  onboardingComplete: boolean;
  displayName: string | null;
  primaryPhotoKey: string | null;
};

/**
 * The Data Access Layer. Every route/component that needs identity goes through
 * here — authorization is checked on the server, close to the data, not in the UI
 * or in `proxy.ts` (which is only an optimistic redirect). Memoized per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      deletedAt: true,
      profile: {
        select: {
          displayName: true,
          onboardingStep: true,
          photos: {
            where: { isPrimary: true },
            select: { storageKey: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!user || user.deletedAt) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    onboardingComplete: user.status !== "PENDING" && !user.profile?.onboardingStep,
    displayName: user.profile?.displayName ?? null,
    primaryPhotoKey: user.profile?.photos[0]?.storageKey ?? null,
  };
});

/** Require a signed-in, non-removed account. Redirects otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    // A cookie that no longer resolves to a live session → clear it, don't loop.
    const stale = (await cookies()).has("lunova_session");
    redirect(stale ? "/session-expired" : "/login");
  }
  if (user.status === "BANNED" || user.status === "SUSPENDED") redirect("/account/hold");
  if (user.status === "DELETED") redirect("/session-expired");
  return user;
}

/** Require a fully onboarded account (for the main product surface). */
export async function requireOnboardedUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.onboardingComplete) redirect("/onboarding");
  return user;
}

/** Require a staff role for moderation/admin surfaces. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/discover");
  return user;
}

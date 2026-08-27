"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/dal";

export type ToggleResult = { ok: true; value: boolean } | { ok: false; error: string };

/** Pause / resume appearing in other people's discovery feeds. */
export async function setDiscoveryPausedAction(paused: boolean): Promise<ToggleResult> {
  const user = await requireUser();
  await db.privacySetting.update({
    where: { userId: user.id },
    data: { discoveryPaused: paused },
  });
  revalidatePath("/profile");
  revalidatePath("/settings");
  return { ok: true, value: paused };
}

/** Incognito — only people you've liked can see you. */
export async function setIncognitoAction(on: boolean): Promise<ToggleResult> {
  const user = await requireUser();
  await db.privacySetting.update({
    where: { userId: user.id },
    data: { incognito: on },
  });
  revalidatePath("/profile");
  revalidatePath("/settings");
  return { ok: true, value: on };
}

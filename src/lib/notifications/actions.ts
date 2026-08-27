"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { markNotificationsRead } from "./service";

export async function markNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markNotificationsRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/(app)", "layout");
}

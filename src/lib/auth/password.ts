import bcrypt from "bcryptjs";

/**
 * Password hashing. bcrypt with a work factor of 12 — a deliberate CPU cost so
 * that a leaked hash table is expensive to attack. Swap for argon2id if a native
 * build step becomes available.
 */
const WORK_FACTOR = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, WORK_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** Cheap pre-check so we reject absurd inputs before spending a bcrypt round. */
export function isPlausiblePassword(plain: string): boolean {
  return typeof plain === "string" && plain.length >= 8 && plain.length <= 200;
}

import bcrypt from "bcryptjs";

/**
 * Password hashing. bcrypt with a work factor of 12 — a deliberate CPU cost so
 * that a leaked hash table is expensive to attack. Swap for argon2id if a native
 * build step becomes available.
 */
const WORK_FACTOR = 12;

/**
 * A real bcrypt hash of a random decoy string. Compare against this on the
 * "no such account" path so login/verify responses take the same time whether
 * or not the account exists (defeats a timing oracle for account enumeration).
 */
export const DECOY_PASSWORD_HASH =
  "$2b$12$v9GDRXZ96ZnVDv2NW.pFSue7t9DE1KuU1JguBiGUlyrCL.xJ//Y1S";

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

/**
 * Timing-safe verify: when `hash` is missing (no such user) still spend a bcrypt
 * round against the decoy so the response time doesn't reveal account existence.
 */
export async function verifyPasswordConstantTime(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  const ok = await verifyPassword(plain, hash ?? DECOY_PASSWORD_HASH);
  return hash ? ok : false;
}

/** Cheap pre-check so we reject absurd inputs before spending a bcrypt round. */
export function isPlausiblePassword(plain: string): boolean {
  return typeof plain === "string" && plain.length >= 8 && plain.length <= 200;
}

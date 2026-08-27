import "server-only";
import { env } from "@/lib/env";

export interface IdvSubmission {
  userId: string;
  selfie: Buffer;
  contentType: string;
}

export interface IdvResult {
  /** "approved" | "rejected" resolve now; "pending" means the vendor will call back. */
  outcome: "approved" | "rejected" | "pending";
  providerRef?: string;
  reason?: string;
}

export interface IdentityVerificationProvider {
  readonly name: string;
  submitPhoto(s: IdvSubmission): Promise<IdvResult>;
}

/**
 * DEV provider — approves any non-trivial image immediately so the verified
 * badge and gated flows are exercisable locally. A real vendor (selfie liveness
 * / doc check) plugs in here via IDV_PROVIDER; those are asynchronous and would
 * leave the IdentityCheck PENDING until a webhook resolves it.
 */
class LocalAutoApproveIdv implements IdentityVerificationProvider {
  readonly name = "local-auto";
  async submitPhoto({ selfie, contentType }: IdvSubmission): Promise<IdvResult> {
    if (!contentType.startsWith("image/") || selfie.length < 1024) {
      return { outcome: "rejected", reason: "unreadable_image" };
    }
    return { outcome: "approved", providerRef: `local-${Date.now()}` };
  }
}

function build(): IdentityVerificationProvider {
  switch (env.IDV_PROVIDER) {
    // case "persona": return new PersonaIdv(env.IDV_API_KEY!);
    default:
      return new LocalAutoApproveIdv();
  }
}

const g = globalThis as unknown as { idv?: IdentityVerificationProvider };
export const idv: IdentityVerificationProvider = g.idv ?? (g.idv = build());

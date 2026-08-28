import "server-only";
import { loadCompatInput } from "./load";
import { explainCompatibility, type CompatibilityExplanation } from "./engine";

/**
 * Internal "why this person?" for operators. Loads both members and returns the
 * per-signal breakdown behind their ranking. Never exposed to members.
 */
export async function explainPair(
  viewerId: string,
  candidateId: string,
): Promise<CompatibilityExplanation | { error: string }> {
  if (viewerId === candidateId) return { error: "Pick two different members." };
  const [viewer, candidate] = await Promise.all([
    loadCompatInput(viewerId),
    loadCompatInput(candidateId),
  ]);
  if (!viewer) return { error: `No profile for viewer ${viewerId}.` };
  if (!candidate) return { error: `No profile for candidate ${candidateId}.` };
  return explainCompatibility(viewer, candidate);
}

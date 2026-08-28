import "server-only";
import { createHash } from "node:crypto";
import { metrics } from "@/lib/observability/metrics";
import { log } from "@/lib/observability/logger";
import { EXPERIMENTS, type ExperimentId } from "./registry";

/**
 * Deterministic variant assignment: a stable hash of `${experimentId}:${unitId}`
 * mapped onto the variants' weight buckets. Same inputs → same variant, forever,
 * with no stored assignment table. Salting by experiment id means enrolling in
 * one experiment tells you nothing about another.
 */
function bucket(experimentId: string, unitId: string): number {
  const h = createHash("sha256").update(`${experimentId}:${unitId}`).digest();
  // first 4 bytes → [0, 1)
  const n = h.readUInt32BE(0) / 0xffffffff;
  return n;
}

export function assignVariant(experimentId: ExperimentId, unitId: string): string {
  const exp = EXPERIMENTS[experimentId];
  if (!exp.enabled || !unitId) return exp.variants[0].id;

  const total = exp.variants.reduce((s, v) => s + v.weight, 0);
  let point = bucket(experimentId, unitId) * total;
  for (const v of exp.variants) {
    point -= v.weight;
    if (point < 0) return v.id;
  }
  return exp.variants[exp.variants.length - 1].id;
}

export function variantConfig<T = Record<string, unknown>>(
  experimentId: ExperimentId,
  variantId: string,
): T {
  const exp = EXPERIMENTS[experimentId];
  const v = exp.variants.find((x) => x.id === variantId) ?? exp.variants[0];
  return v.config as T;
}

/**
 * Assign + record the exposure. Call once per request where the variant is
 * actually applied. Exposure is a counter only — no per-user event row.
 */
export function exposeVariant<T = Record<string, unknown>>(
  experimentId: ExperimentId,
  unitId: string,
): { variant: string; config: T } {
  const variant = assignVariant(experimentId, unitId);
  const exp = EXPERIMENTS[experimentId];
  if (exp.enabled) {
    metrics.increment(
      "lunova_experiment_exposure_total",
      { experiment: experimentId, variant },
      "Experiment exposures by variant",
    );
    log.debug("experiment exposure", { experiment: experimentId, variant });
  }
  return { variant, config: variantConfig<T>(experimentId, variant) };
}

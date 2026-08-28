/**
 * Experiment registry. Deliberately tiny: an experiment is an id, a unit of
 * assignment, and a set of weighted variants each carrying a plain config
 * object. No database, no admin UI, no targeting rules — assignment is a pure
 * function of (experimentId, unitId), so a variant can always be recomputed
 * after the fact (see `assign.ts`, docs/EXPERIMENTS.md).
 *
 * Hard rule: an experiment may tune ranking inputs. It may never surface a
 * number to a member. The compatibility score stays server-side.
 */
import type { WeightOverride } from "@/lib/compatibility/engine";

export type ExperimentUnit = "user";

export interface Variant<C = Record<string, unknown>> {
  id: string;
  /** Relative weight in the split. Need not sum to anything. */
  weight: number;
  config: C;
}

export interface Experiment<C = Record<string, unknown>> {
  id: string;
  description: string;
  unit: ExperimentUnit;
  /** When false, everyone gets `variants[0]` and no exposure is recorded. */
  enabled: boolean;
  variants: [Variant<C>, ...Variant<C>[]];
}

/** Config shape for the discovery-weight experiments. */
export interface WeightConfig {
  weights: WeightOverride;
}

/**
 * `discovery_music_weight_v1` — does leaning harder on music taste produce more
 * *meaningful* connections, or just more matches? Control is the shipped model.
 * `music_heavy` pushes music from 0.22 → 0.30 and trims interests/personality to
 * keep the six weights summing to 1.
 */
export const EXPERIMENTS = {
  discovery_music_weight_v1: {
    id: "discovery_music_weight_v1",
    description:
      "Discovery ranking: music weight 0.22 (control) vs 0.30 (music_heavy). Outcome: Meaningful Connection Rate, watched against report/block rate.",
    unit: "user",
    enabled: false, // flip on in staging once there is traffic
    variants: [
      { id: "control", weight: 1, config: { weights: {} } },
      {
        id: "music_heavy",
        weight: 1,
        config: {
          weights: {
            music: 0.3,
            interests: 0.17,
            activity: 0.19,
            intent: 0.15,
            distance: 0.13,
            personality: 0.06,
          },
        },
      },
    ],
  } satisfies Experiment<WeightConfig>,
} as const;

export type ExperimentId = keyof typeof EXPERIMENTS;

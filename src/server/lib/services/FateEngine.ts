import { createHash } from 'node:crypto';

import {
  normalizeFate as normalizeSharedFate,
  normalizeFates as normalizeSharedFates,
} from '@shared/lib/fates';
import type {
  Cultivator,
  FateGenerationCategory,
  PreHeavenFate,
} from '@shared/types/cultivator';
import type { Quality } from '@shared/types/constants';
import {
  FATE_CANDIDATE_COUNT,
  FATE_DUAL_SIDED_CHANCE,
  FATE_QUALITY_ORDER,
  FATE_QUALITY_WEIGHTS,
  FATE_SLOT_COUNT,
} from './FateConfig';
import {
  buildFallbackFateName,
  buildFateEffectEntry,
  buildPresetFateDescription,
  getFateRollVersion,
  getNegativeFateEffects,
  getPositiveFateEffects,
  isHighQualityFate,
} from './FateFragmentRegistry';

interface FateGenerationOptions {
  candidateCount?: number;
  rng?: () => number;
}

const DUAL_SIDED_PRIMARY_STRENGTH_MULTIPLIER = 1.3;

function randomPickOne<T>(pool: T[], rng: () => number): T | null {
  if (pool.length === 0) return null;

  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[index] ?? null;
}

function randomPickWeightedQuality(rng: () => number): Quality {
  const totalWeight = FATE_QUALITY_ORDER.reduce(
    (sum, quality) => sum + FATE_QUALITY_WEIGHTS[quality],
    0,
  );
  let roll = rng() * totalWeight;

  for (const quality of FATE_QUALITY_ORDER) {
    roll -= FATE_QUALITY_WEIGHTS[quality];
    if (roll <= 0) {
      return quality;
    }
  }

  return FATE_QUALITY_ORDER[FATE_QUALITY_ORDER.length - 1];
}

function createCompositionHash(
  quality: Quality,
  effectIds: string[],
  category: FateGenerationCategory,
): string {
  return createHash('sha1')
    .update(
      JSON.stringify({
        quality,
        category,
        effectIds: [...effectIds].sort(),
      }),
    )
    .digest('hex')
    .slice(0, 12);
}

function shouldGenerateDualSided(
  quality: Quality,
  dualSidedUsed: boolean,
  rng: () => number,
): boolean {
  if (dualSidedUsed || !isHighQualityFate(quality)) {
    return false;
  }

  return rng() < (FATE_DUAL_SIDED_CHANCE[quality] ?? 0);
}

function composeCandidate(
  quality: Quality,
  rng: () => number,
  dualSidedUsed: boolean,
  usedHashes: Set<string>,
): PreHeavenFate | null {
  const positivePool = getPositiveFateEffects();

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const positive = randomPickOne(positivePool, rng);
    if (!positive) {
      return null;
    }

    const wantsDualSided = shouldGenerateDualSided(quality, dualSidedUsed, rng);
    const negativePool = wantsDualSided
      ? getNegativeFateEffects()
          .filter((effect) => effect.family !== positive.family)
      : [];
    const negative = wantsDualSided ? randomPickOne(negativePool, rng) : null;
    const category: FateGenerationCategory =
      wantsDualSided && negative ? 'dual_sided' : 'single_positive';
    const effectIds = negative
      ? [positive.id, negative.id]
      : [positive.id];
    const compositionHash = createCompositionHash(quality, effectIds, category);
    if (usedHashes.has(compositionHash)) {
      continue;
    }

    const effects = [
      buildFateEffectEntry(positive, quality, rng, {
        strengthMultiplier: negative
          ? DUAL_SIDED_PRIMARY_STRENGTH_MULTIPLIER
          : 1,
      }),
      ...(negative ? [buildFateEffectEntry(negative, quality, rng)] : []),
    ];
    const fallbackName = buildFallbackFateName(positive, quality);
    const fallbackDescription = buildPresetFateDescription(
      positive,
      quality,
      effects[0]!,
    );

    usedHashes.add(compositionHash);

    return {
      name: fallbackName,
      quality,
      description: fallbackDescription,
      effects,
      generationModel: {
        version: getFateRollVersion(),
        rollVersion: getFateRollVersion(),
        quality,
        effectIds,
        compositionHash,
        category,
      },
    };
  }

  return null;
}

export const FateEngine = {
  normalizeFate(fate: PreHeavenFate): PreHeavenFate {
    return normalizeSharedFate(fate);
  },

  normalizeFates(fates: PreHeavenFate[]): PreHeavenFate[] {
    return normalizeSharedFates(fates);
  },

  async generateCandidatePool(
    cultivator: Cultivator,
    options: FateGenerationOptions | (() => number) = {},
  ): Promise<PreHeavenFate[]> {
    void cultivator;
    const rng = typeof options === 'function' ? options : options.rng ?? Math.random;
    const candidateCount =
      typeof options === 'function'
        ? FATE_CANDIDATE_COUNT
        : options.candidateCount ?? FATE_CANDIDATE_COUNT;
    const usedHashes = new Set<string>();
    const generated: PreHeavenFate[] = [];
    let dualSidedUsed = false;

    for (let slot = 0; slot < candidateCount; slot += 1) {
      const targetQuality = randomPickWeightedQuality(rng);
      const candidate = composeCandidate(
        targetQuality,
        rng,
        dualSidedUsed,
        usedHashes,
      );

      if (candidate) {
        dualSidedUsed =
          dualSidedUsed ||
          candidate.generationModel?.category === 'dual_sided';
        generated.push(candidate);
      }
    }

    if (generated.length < candidateCount) {
      for (const quality of [...FATE_QUALITY_ORDER].reverse()) {
        if (generated.length >= candidateCount) break;
        const candidate = composeCandidate(
          quality,
          rng,
          dualSidedUsed,
          usedHashes,
        );
        if (candidate) {
          dualSidedUsed =
            dualSidedUsed ||
            candidate.generationModel?.category === 'dual_sided';
          generated.push(candidate);
        }
      }
    }

    return normalizeSharedFates(generated);
  },

  getSelectedFates(fates: PreHeavenFate[]): PreHeavenFate[] {
    return this.normalizeFates(fates).slice(0, FATE_SLOT_COUNT);
  },
};

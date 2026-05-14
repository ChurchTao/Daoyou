import {
  CREATION_MATERIAL_ENERGY,
  CREATION_UNLOCK_SCORE_PROFILE,
} from '../config/CreationBalance';
import {
  MaterialEnergyProfile,
  MaterialFingerprint,
} from '../types';

export function buildMaterialEnergyProfile(
  fingerprints: MaterialFingerprint[],
): MaterialEnergyProfile {
  const baseEnergy = fingerprints.reduce(
    (sum, fingerprint) => sum + fingerprint.energyValue,
    0,
  );
  const diversityBonus = calculateDiversityBonus(fingerprints);
  const coherenceBonus = calculateCoherenceBonus(fingerprints);

  return {
    baseEnergy,
    diversityBonus,
    coherenceBonus,
    effectiveEnergy: baseEnergy + diversityBonus + coherenceBonus,
    unlockScore: calculateUnlockScore(
      fingerprints,
      diversityBonus,
      coherenceBonus,
    ),
  };
}

function calculateDiversityBonus(
  fingerprints: MaterialFingerprint[],
): number {
  const uniqueTypes = new Set(
    fingerprints.map((fingerprint) => fingerprint.materialType),
  ).size;
  const extraTypes = Math.max(0, uniqueTypes - 1);

  return Math.min(
    CREATION_MATERIAL_ENERGY.maxDiversityBonus,
    extraTypes * CREATION_MATERIAL_ENERGY.diversityBonusPerExtraType,
  );
}

function calculateCoherenceBonus(
  fingerprints: MaterialFingerprint[],
): number {
  const semanticTagCounts = new Map<string, number>();

  for (const fingerprint of fingerprints) {
    const uniqueSemanticTags = new Set(fingerprint.semanticTags);
    for (const tag of uniqueSemanticTags) {
      semanticTagCounts.set(tag, (semanticTagCounts.get(tag) ?? 0) + 1);
    }
  }

  let maxShared = 0;
  for (const count of semanticTagCounts.values()) {
    if (count > maxShared) maxShared = count;
  }

  const stacks = Math.max(0, maxShared - 1);
  return Math.min(
    CREATION_MATERIAL_ENERGY.maxCoherenceBonus,
    stacks * CREATION_MATERIAL_ENERGY.coherenceBonusPerStack,
  );
}

function calculateUnlockScore(
  fingerprints: MaterialFingerprint[],
  diversityBonus: number,
  coherenceBonus: number,
): number {
  const weights = CREATION_UNLOCK_SCORE_PROFILE.materialContributionWeights;
  const sortedFingerprints = [...fingerprints].sort((left, right) => {
    if (right.energyValue !== left.energyValue) {
      return right.energyValue - left.energyValue;
    }

    if (right.rarityWeight !== left.rarityWeight) {
      return right.rarityWeight - left.rarityWeight;
    }

    return right.quantity - left.quantity;
  });

  const weightedMaterialScore = sortedFingerprints.reduce(
    (sum, fingerprint, index) =>
      sum +
      fingerprint.energyValue *
        (weights[index] ?? weights[weights.length - 1]),
    0,
  );

  return Math.max(
    0,
    Math.round(
      weightedMaterialScore +
        diversityBonus *
          CREATION_UNLOCK_SCORE_PROFILE.diversityBonusMultiplier +
        coherenceBonus *
          CREATION_UNLOCK_SCORE_PROFILE.coherenceBonusMultiplier,
    ),
  );
}

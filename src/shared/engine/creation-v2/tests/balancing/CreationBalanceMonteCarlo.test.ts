import { buildMaterialEnergyProfile } from '@shared/engine/creation-v2/analysis/MaterialBalanceProfile';
import {
  CREATION_AFFIX_UNLOCK_THRESHOLDS,
  CREATION_INPUT_CONSTRAINTS,
  CREATION_MATERIAL_ENERGY,
  CREATION_RESERVED_ENERGY,
  resolveAffixSlotCount,
} from '@shared/engine/creation-v2/config/CreationBalance';
import { MaterialFingerprint } from '@shared/engine/creation-v2/types';
import { QUALITY_VALUES, Quality } from '@shared/types/constants';

class DeterministicRng {
  constructor(private state: number) {}

  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }
}

const MATERIAL_TYPES = [
  'ore',
  'monster',
  'herb',
  'aux',
  'tcdb',
  'gongfa_manual',
  'skill_manual',
] as const;

const SEMANTIC_TAGS = [
  'Material.Semantic.Blade',
  'Material.Semantic.Flame',
  'Material.Semantic.Guard',
  'Material.Semantic.Spirit',
  'Material.Semantic.Burst',
  'Material.Semantic.Sustain',
] as const;

function calculateEnergyValue(
  rank: Quality,
  quantity: number,
  materialType: MaterialFingerprint['materialType'],
): number {
  const qualityOrder = QUALITY_VALUES.indexOf(rank);
  const qualityWeight =
    CREATION_MATERIAL_ENERGY.qualityWeights[qualityOrder] ??
    CREATION_MATERIAL_ENERGY.qualityWeights[0];
  const typeBonus =
    materialType === 'gongfa_manual' || materialType === 'skill_manual'
      ? CREATION_MATERIAL_ENERGY.specializedManualBonus
      : 0;

  return Math.round(qualityWeight * Math.sqrt(quantity) + typeBonus);
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length * ratio)];
}

function buildRandomFingerprint(
  rng: DeterministicRng,
  sessionIndex: number,
  materialIndex: number,
): MaterialFingerprint {
  const rank = rng.pick(QUALITY_VALUES);
  const quantity =
    CREATION_INPUT_CONSTRAINTS.minQuantityPerMaterial +
    rng.int(CREATION_INPUT_CONSTRAINTS.maxQuantityPerMaterial);
  const materialType = rng.pick(MATERIAL_TYPES);
  const primaryTag = rng.pick(SEMANTIC_TAGS);
  const semanticTags = [primaryTag];

  if (rng.next() < 0.32) {
    semanticTags.push(primaryTag);
  }

  if (rng.next() < 0.2) {
    semanticTags.push(rng.pick(SEMANTIC_TAGS));
  }

  return {
    materialName: `sample-${sessionIndex}-${materialIndex}`,
    materialType,
    rank,
    quantity,
    explicitTags: [],
    semanticTags: Array.from(new Set(semanticTags)),
    recipeTags: [],
    energyValue: calculateEnergyValue(rank, quantity, materialType),
    rarityWeight: QUALITY_VALUES.indexOf(rank) + 1,
  };
}

describe('Creation balance Monte Carlo calibration', () => {
  it('unlock score 与 spendable energy 应维持分轨分布窗口', () => {
    const rng = new DeterministicRng(20260406);
    const iterations = 5000;
    const spendableTotals: number[] = [];
    const unlockScores: number[] = [];
    const unlockHits = {
      skill_variant: 0,
      skill_rare: 0,
    };
    const slotHits: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 };

    for (let index = 0; index < iterations; index++) {
      const kindCount =
        CREATION_INPUT_CONSTRAINTS.minMaterialKinds +
        rng.int(CREATION_INPUT_CONSTRAINTS.maxMaterialKinds);
      const fingerprints = Array.from({ length: kindCount }).map((_, materialIndex) =>
        buildRandomFingerprint(rng, index, materialIndex),
      );
      const profile = buildMaterialEnergyProfile(fingerprints);
      const availableSkillEnergy = Math.max(
        0,
        profile.effectiveEnergy - CREATION_RESERVED_ENERGY.skill,
      );

      spendableTotals.push(profile.effectiveEnergy);
      unlockScores.push(profile.unlockScore);
      slotHits[resolveAffixSlotCount(availableSkillEnergy)] += 1;

      if (profile.unlockScore >= CREATION_AFFIX_UNLOCK_THRESHOLDS.skill_variant) {
        unlockHits.skill_variant += 1;
      }
      if (profile.unlockScore >= CREATION_AFFIX_UNLOCK_THRESHOLDS.skill_rare) {
        unlockHits.skill_rare += 1;
      }
    }

    const spendableP50 = percentile(spendableTotals, 0.5);
    const unlockP50 = percentile(unlockScores, 0.5);
    const rareRate = unlockHits.skill_rare / iterations;
    const variantRate = unlockHits.skill_variant / iterations;
    const fiveSlotRate = slotHits[5] / iterations;

    expect(unlockP50).toBeLessThan(spendableP50);
    expect(spendableP50).toBeGreaterThanOrEqual(100);
    expect(spendableP50).toBeLessThanOrEqual(160);
    expect(unlockP50).toBeGreaterThanOrEqual(80);
    expect(unlockP50).toBeLessThanOrEqual(130);
    expect(variantRate).toBeGreaterThanOrEqual(0.12);
    expect(variantRate).toBeLessThanOrEqual(1.0);
    expect(rareRate).toBeGreaterThanOrEqual(0.02);
    expect(rareRate).toBeLessThanOrEqual(0.85);
    expect(fiveSlotRate).toBeGreaterThanOrEqual(0.24);
    expect(fiveSlotRate).toBeLessThanOrEqual(0.85);
  });
});

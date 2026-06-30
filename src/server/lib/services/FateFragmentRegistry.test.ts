import { describe, expect, it } from 'vitest';
import {
  buildFateEffectEntry,
  getNegativeFateEffects,
  getPositiveFateEffects,
} from './FateFragmentRegistry';

function getPositiveEffect(effectId: string) {
  const effect = getPositiveFateEffects().find((item) => item.id === effectId);
  if (!effect) {
    throw new Error(`Missing positive fate effect: ${effectId}`);
  }
  return effect;
}

function getNegativeEffect(effectId: string) {
  const effect = getNegativeFateEffects().find((item) => item.id === effectId);
  if (!effect) {
    throw new Error(`Missing negative fate effect: ${effectId}`);
  }
  return effect;
}

function createSequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

describe('FateFragmentRegistry', () => {
  it('rolls different persisted values for the same quality and effect within range', () => {
    const definition = getPositiveEffect('retreat-exp-gain');
    const lowRoll = buildFateEffectEntry(definition, '真品', () => 0);
    const highRoll = buildFateEffectEntry(definition, '真品', () => 0.999999);

    expect(lowRoll.value).toBeGreaterThanOrEqual(lowRoll.rollMeta.minValue);
    expect(highRoll.value).toBeLessThanOrEqual(highRoll.rollMeta.maxValue);
    expect(lowRoll.value).not.toBe(highRoll.value);
    expect(lowRoll.rollMeta.roundingStep).toBe(0.01);
  });

  it('scales stronger with higher quality while keeping breakthrough granularity', () => {
    const retreatDefinition = getPositiveEffect('retreat-exp-gain');
    const mortalRoll = buildFateEffectEntry(retreatDefinition, '凡品', () => 0.5);
    const divineRoll = buildFateEffectEntry(retreatDefinition, '神品', () => 0.5);

    expect(divineRoll.value).toBeGreaterThan(mortalRoll.value);

    const breakthroughDefinition = getNegativeEffect('breakthrough-stumble');
    const breakthroughRoll = buildFateEffectEntry(
      breakthroughDefinition,
      '天品',
      () => 0.5,
    );

    expect(breakthroughRoll.rollMeta.roundingStep).toBe(0.001);
    expect(breakthroughRoll.value).toBeLessThan(0);
  });

  it('scales market purchase discount by quality', () => {
    const definition = getPositiveEffect('market-purchase-discount');
    const mortalRoll = buildFateEffectEntry(definition, '凡品', () => 0.5);
    const divineRoll = buildFateEffectEntry(definition, '神品', () => 0.5);

    expect(mortalRoll.effectType).toBe('market_purchase_price_multiplier');
    expect(divineRoll.value).toBeLessThan(mortalRoll.value);
  });

  it('records same-quality variance metadata and varies final strength', () => {
    const definition = getPositiveEffect('retreat-exp-gain');
    const lowVarianceRoll = buildFateEffectEntry(
      definition,
      '玄品',
      createSequenceRng([0.5, 0]),
    );
    const highVarianceRoll = buildFateEffectEntry(
      definition,
      '玄品',
      createSequenceRng([0.5, 0.999999]),
    );

    expect(lowVarianceRoll.rollMeta.variancePercentile).toBe(0);
    expect(lowVarianceRoll.rollMeta.varianceMultiplier).toBe(0.8);
    expect(lowVarianceRoll.rollMeta.strengthMultiplier).toBe(1);
    expect(highVarianceRoll.rollMeta.varianceMultiplier).toBeCloseTo(1.2, 5);
    expect(highVarianceRoll.value).toBeGreaterThan(lowVarianceRoll.value);
    expect(lowVarianceRoll.value).toBeGreaterThanOrEqual(
      lowVarianceRoll.rollMeta.minValue,
    );
    expect(highVarianceRoll.value).toBeLessThanOrEqual(
      highVarianceRoll.rollMeta.maxValue,
    );
  });

  it('keeps adjusted values in their original direction', () => {
    const discount = buildFateEffectEntry(
      getPositiveEffect('market-purchase-discount'),
      '神品',
      createSequenceRng([0.5, 0.999999]),
    );
    const breakthroughBurden = buildFateEffectEntry(
      getNegativeEffect('breakthrough-stumble'),
      '神品',
      createSequenceRng([0.5, 0.999999]),
    );
    const toxicityBurden = buildFateEffectEntry(
      getNegativeEffect('toxicity-burden'),
      '神品',
      createSequenceRng([0.5, 0.999999]),
    );

    expect(discount.value).toBeLessThan(1);
    expect(breakthroughBurden.value).toBeLessThan(0);
    expect(toxicityBurden.value).toBeGreaterThan(1);
  });
});

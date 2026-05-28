import { describe, expect, it } from 'vitest';
import {
  evaluateFateContext,
  getAlchemySpiritStoneMultiplier,
  getInnSpiritStoneMultiplier,
  getRefineSpiritStoneMultiplier,
  scaleFateAdjustedValue,
} from './fates';
import type {
  FateEffectEntry,
  FateEffectPolarity,
  FateEffectType,
  PreHeavenFate,
} from '@shared/types/cultivator';

function createEffect(
  effectType: FateEffectType,
  value: number,
  polarity: FateEffectPolarity = 'boon',
  label = `${effectType}:${value}`,
): FateEffectEntry {
  return {
    id: `${effectType}:${value}:${polarity}`,
    effectId: effectType,
    scope: polarity === 'boon' ? 'daily' : 'drawback',
    polarity,
    effectType,
    value,
    label,
    description: label,
    rollMeta: {
      qualityAnchor: '凡品',
      minValue: value,
      maxValue: value,
      rolledPercentile: 0.5,
      roundingStep: effectType === 'breakthrough_bonus' ? 0.001 : 0.01,
    },
  };
}

function createFate(name: string, effects: FateEffectEntry[]): PreHeavenFate {
  return {
    name,
    effects,
  };
}

describe('fate context evaluation', () => {
  it('stacks each effect family and clamps to the configured bounds', () => {
    const context = evaluateFateContext([
      createFate('厚骨命', [
        createEffect('retreat_exp_multiplier', 1.5),
        createEffect('retreat_insight_multiplier', 0.6),
        createEffect('breakthrough_bonus', 0.08),
        createEffect('natural_recovery_multiplier', 1.4),
        createEffect('toxicity_penalty_multiplier', 0.5),
        createEffect('alchemy_spirit_stone_multiplier', 0.8),
        createEffect('refine_spirit_stone_multiplier', 0.85),
        createEffect('enlightenment_insight_multiplier', 0.7),
        createEffect('inn_cultivation_loss_multiplier', 0.5),
        createEffect('system_spirit_stone_multiplier', 1.2, 'burden'),
      ]),
      createFate('幽骨命', [
        createEffect('retreat_exp_multiplier', 1.5),
        createEffect('retreat_insight_multiplier', 0.9, 'burden'),
        createEffect('breakthrough_bonus', 0.08),
        createEffect('natural_recovery_multiplier', 1.6),
        createEffect('toxicity_penalty_multiplier', 0.8),
        createEffect('alchemy_spirit_stone_multiplier', 0.8),
        createEffect('refine_spirit_stone_multiplier', 0.8),
        createEffect('enlightenment_insight_multiplier', 0.8),
        createEffect('inn_cultivation_loss_multiplier', 0.5),
        createEffect('system_spirit_stone_multiplier', 1.2, 'burden'),
      ]),
    ]);

    expect(context.retreatExpMultiplier).toBe(1.8);
    expect(context.retreatInsightMultiplier).toBe(0.55);
    expect(context.breakthroughChanceBonus).toBe(0.15);
    expect(context.naturalRecoveryMultiplier).toBe(2);
    expect(context.toxicityPenaltyMultiplier).toBe(0.45);
    expect(context.alchemySpiritStoneMultiplier).toBe(0.65);
    expect(context.refineSpiritStoneMultiplier).toBe(0.7);
    expect(context.enlightenmentInsightMultiplier).toBe(0.65);
    expect(context.innCultivationLossMultiplier).toBe(0);
    expect(context.systemSpiritStoneMultiplier).toBe(1.3);
    expect(context.summary).toContain('厚骨命');
    expect(context.summary).toContain('幽骨命');
  });

  it('adds inn loss reductions together and caps the reduction at 100%', () => {
    const stackedContext = evaluateFateContext([
      createFate('稳脉命', [
        createEffect('inn_cultivation_loss_multiplier', 0.85),
      ]),
      createFate('静骨命', [
        createEffect('inn_cultivation_loss_multiplier', 0.9),
      ]),
    ]);
    const cappedContext = evaluateFateContext([
      createFate('归虚命', [
        createEffect('inn_cultivation_loss_multiplier', 0.5),
      ]),
      createFate('止损命', [
        createEffect('inn_cultivation_loss_multiplier', 0.5),
      ]),
    ]);

    expect(stackedContext.innCultivationLossMultiplier).toBeCloseTo(0.75);
    expect(cappedContext.innCultivationLossMultiplier).toBe(0);
  });

  it('combines shared system spirit stone burden with per-system cost multipliers', () => {
    const context = evaluateFateContext([
      createFate('丹心命', [
        createEffect('alchemy_spirit_stone_multiplier', 0.92),
        createEffect('refine_spirit_stone_multiplier', 0.94),
        createEffect('system_spirit_stone_multiplier', 1.08, 'burden'),
      ]),
    ]);

    expect(getAlchemySpiritStoneMultiplier(context)).toBeCloseTo(0.9936);
    expect(getRefineSpiritStoneMultiplier(context)).toBeCloseTo(1.0152);
    expect(getInnSpiritStoneMultiplier(context)).toBe(1.08);
  });

  it('rounds scaled values for spirit stone and loss calculations', () => {
    expect(scaleFateAdjustedValue(5000, 1.08)).toBe(5400);
    expect(scaleFateAdjustedValue(987 * 0.05, 0.85)).toBe(42);
    expect(scaleFateAdjustedValue(-100, 2)).toBe(0);
  });
});

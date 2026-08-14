import { ALCHEMY_EFFECT_BASE_BY_QUALITY } from '@shared/config/alchemyEffectConfig';
import { describe, expect, it } from 'vitest';
import {
  normalizeAlchemyEffectRoute,
  resolveAlchemyEffects,
  validateAlchemyEffectRoute,
} from './alchemyEffectResolver';

describe('alchemy effect resolver v4', () => {
  it('keeps the complete design table in one source', () => {
    expect(ALCHEMY_EFFECT_BASE_BY_QUALITY.神品.cultivationBoost).toBe(8);
    expect(ALCHEMY_EFFECT_BASE_BY_QUALITY.玄品.bodyTrack).toBe(120);
    expect(ALCHEMY_EFFECT_BASE_BY_QUALITY.玄品.lifespan).toBe(60);
    expect(ALCHEMY_EFFECT_BASE_BY_QUALITY.真品.lifespan).toBe(140);
    expect(ALCHEMY_EFFECT_BASE_BY_QUALITY.地品.lifespan).toBe(300);
  });

  it('normalizes duplicate route keys, weights and ordering at creation boundaries', () => {
    expect(
      normalizeAlchemyEffectRoute({
        effects: [
          { key: 'detox', weight: 2 },
          { key: 'body_skin', weight: 5 },
          { key: 'detox', weight: 1 },
          { key: 'insight', weight: 1 },
          { key: 'cultivation', weight: 0.5 },
        ],
      }),
    ).toEqual({
      effects: [
        { key: 'body_skin', weight: 0.5556 },
        { key: 'detox', weight: 0.3333 },
        { key: 'insight', weight: 0.1111 },
      ],
    });
  });

  it('rejects malformed persisted routes instead of silently repairing them', () => {
    expect(() =>
      validateAlchemyEffectRoute({
        effects: [
          { key: 'detox', weight: 0.5 },
          { key: 'body_skin', weight: 0.7 },
        ],
      }),
    ).toThrow('未按权重降序');
    expect(() =>
      validateAlchemyEffectRoute({
        effects: [
          { key: 'detox', weight: 0.5 },
          { key: 'detox', weight: 0.5 },
        ],
      }),
    ).toThrow('重复效果');
    expect(() =>
      validateAlchemyEffectRoute({
        effects: [
          { key: 'detox', weight: 0.4 },
          { key: 'body_skin', weight: 0.3 },
          { key: 'insight', weight: 0.2 },
          { key: 'cultivation', weight: 0.1 },
        ],
      }),
    ).toThrow('一至三个效果');
    expect(() =>
      validateAlchemyEffectRoute({
        effects: [{ key: 'detox', weight: 0.5 }],
      }),
    ).toThrow('权重未归一化');
  });

  it('uses one primary and one reduced secondary effect', () => {
    const result = resolveAlchemyEffects({
      route: {
        effects: [
          { key: 'body_qi_blood', weight: 0.66 },
          { key: 'detox', weight: 0.34 },
        ],
      },
      quality: '玄品',
      appearance: 'middle',
    });
    expect(result.effectBreakdown).toMatchObject([
      { slot: 'primary', finalValue: 120 },
      { slot: 'secondary', finalValue: 15 },
    ]);
    expect(result.operations).toEqual([
      { type: 'advance_track', track: 'body.qi_blood', value: 120 },
      { type: 'change_gauge', gauge: 'pillToxicity', delta: -15 },
    ]);
  });

  it('does not let legacy minimums raise tertiary effects', () => {
    const result = resolveAlchemyEffects({
      route: {
        effects: [
          { key: 'body_skin', weight: 0.5 },
          { key: 'insight', weight: 0.3 },
          { key: 'detox', weight: 0.2 },
        ],
      },
      quality: '凡品',
      appearance: 'low',
      fitMultiplier: 0.85,
    });
    expect(result.effectBreakdown[2]?.finalValue).toBe(1);
    expect(result.operations[2]).toEqual({
      type: 'change_gauge',
      gauge: 'pillToxicity',
      delta: -1,
    });
  });

  it('reduces secondary and tertiary cultivation without a 30% floor', () => {
    const result = resolveAlchemyEffects({
      route: {
        effects: [
          { key: 'body_skin', weight: 0.5 },
          { key: 'cultivation', weight: 0.3 },
          { key: 'insight', weight: 0.2 },
        ],
      },
      quality: '凡品',
      appearance: 'low',
      fitMultiplier: 0.85,
    });
    expect(result.operations[1]).toMatchObject({
      type: 'add_status',
      payload: { boostPercent: 0.1071 },
    });
  });

  it('attenuates discrete support effects outside the primary slot', () => {
    const result = resolveAlchemyEffects({
      route: {
        effects: [
          { key: 'body_skin', weight: 0.5 },
          { key: 'heal_wounds', weight: 0.3 },
          { key: 'clear_mind_support', weight: 0.2 },
        ],
      },
      quality: '神品',
      appearance: 'middle',
    });
    expect(result.operations[1]).toEqual({
      type: 'remove_status',
      status: 'minor_wound',
    });
    expect(result.operations[2]).toMatchObject({
      type: 'add_status',
      status: 'clear_mind',
      usesRemaining: 1,
    });
  });

  it('applies appearance once and clamps fit at the resolver boundary', () => {
    const result = resolveAlchemyEffects({
      route: { effects: [{ key: 'body_skin', weight: 1 }] },
      quality: '玄品',
      appearance: 'perfect',
      fitMultiplier: 2,
    });
    expect(result.effectBreakdown[0]).toMatchObject({
      fitMultiplier: 1.15,
      appearanceMultiplier: 1.3,
      finalValue: 179,
    });
  });

  it('fully restores divine perfect cultivation from the design formula', () => {
    const result = resolveAlchemyEffects({
      route: { effects: [{ key: 'cultivation', weight: 1 }] },
      quality: '神品',
      appearance: 'perfect',
      fitMultiplier: 1.15,
    });
    expect(result.effectBreakdown[0]?.finalValue).toBe(11.96);
    expect(result.operations[0]).toMatchObject({
      type: 'add_status',
      payload: { boostPercent: 11.96, retreatExpMultiplier: 12.96 },
    });
  });

  it('only creates detox when the route explicitly contains detox', () => {
    const positive = resolveAlchemyEffects({
      route: { effects: [{ key: 'body_skin', weight: 1 }] },
      quality: '玄品',
      appearance: 'middle',
    });
    expect(positive.operations.at(-1)).toEqual({
      type: 'change_gauge',
      gauge: 'pillToxicity',
      delta: 30,
    });

    const detox = resolveAlchemyEffects({
      route: { effects: [{ key: 'detox', weight: 1 }] },
      quality: '玄品',
      appearance: 'middle',
    });
    expect(detox.operations).toEqual([
      { type: 'change_gauge', gauge: 'pillToxicity', delta: -45 },
    ]);
  });

  it('is deterministic for identical inputs', () => {
    const input = {
      route: {
        effects: [
          { key: 'body_skin' as const, weight: 0.7 },
          { key: 'detox' as const, weight: 0.3 },
        ],
      },
      quality: '玄品' as const,
      appearance: 'high' as const,
      fitMultiplier: 1.07,
    };
    expect(resolveAlchemyEffects(input)).toEqual(resolveAlchemyEffects(input));
  });
});

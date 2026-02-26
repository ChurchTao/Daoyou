import { EffectType, StatModifierType } from '@/engine/effect/types';
import {
  Artifact,
  Consumable,
  CultivationTechnique,
  Skill,
} from '@/types/cultivator';
import {
  calculateSingleArtifactScore,
  calculateSingleElixirScore,
  calculateSingleSkillScore,
  calculateSingleTechniqueScore,
} from './rankingUtils';

describe('rankingUtils scoring model', () => {
  it('artifact score should increase with stronger effects and higher quality', () => {
    const lowArtifact: Artifact = {
      name: '青铜短刃',
      slot: 'weapon',
      element: '金',
      quality: '凡品',
      required_realm: '炼气',
      effects: [
        {
          type: EffectType.StatModifier,
          params: {
            stat: 'vitality',
            modType: StatModifierType.FIXED,
            value: 6,
          },
        },
      ],
    };

    const highArtifact: Artifact = {
      ...lowArtifact,
      name: '玄雷神刃',
      quality: '地品',
      effects: [
        {
          type: EffectType.StatModifier,
          params: {
            stat: 'critRate',
            modType: StatModifierType.PERCENT,
            value: 0.18,
          },
        },
        {
          type: EffectType.Damage,
          params: {
            multiplier: 2.4,
            critRateBonus: 0.1,
          },
        },
      ],
    };

    expect(calculateSingleArtifactScore(highArtifact)).toBeGreaterThan(
      calculateSingleArtifactScore(lowArtifact),
    );
  });

  it('skill score should reward stronger effects and better efficiency', () => {
    const weakSkill: Skill = {
      name: '炎流术',
      element: '火',
      grade: '玄阶下品',
      cooldown: 3,
      cost: 120,
      effects: [
        {
          type: EffectType.Damage,
          params: { multiplier: 1.2 },
        },
      ],
    };

    const strongSkill: Skill = {
      ...weakSkill,
      name: '焚天诀',
      cooldown: 1,
      cost: 80,
      effects: [
        {
          type: EffectType.Damage,
          params: {
            multiplier: 2.8,
            critRateBonus: 0.12,
            critDamageBonus: 0.3,
          },
        },
        {
          type: EffectType.BonusDamage,
          params: {
            multiplier: 1.4,
          },
        },
      ],
    };

    expect(calculateSingleSkillScore(strongSkill)).toBeGreaterThan(
      calculateSingleSkillScore(weakSkill),
    );
  });

  it('consumable score should reward high-impact utility effects', () => {
    const plainPill: Consumable = {
      name: '回春丹',
      type: '丹药',
      quality: '灵品',
      quantity: 1,
      effects: [],
    };

    const advancedPill: Consumable = {
      ...plainPill,
      name: '悟道玄丹',
      quality: '玄品',
      effects: [
        {
          type: EffectType.ConsumeGainComprehension,
          params: { value: 120 },
        },
        {
          type: EffectType.ConsumeAddBuff,
          params: { buffId: 'draw_gongfa_talisman', maxUses: 1 },
        },
      ],
    };

    expect(calculateSingleElixirScore(advancedPill)).toBeGreaterThan(
      calculateSingleElixirScore(plainPill),
    );
  });

  it('technique score should reward higher grade and richer passive effects', () => {
    const basicTechnique: CultivationTechnique = {
      name: '养气诀',
      grade: '黄阶下品',
      required_realm: '炼气',
      effects: [],
    };

    const advancedTechnique: CultivationTechnique = {
      ...basicTechnique,
      name: '玄天归元经',
      grade: '地阶上品',
      effects: [
        {
          type: EffectType.StatModifier,
          params: {
            stat: 'spirit',
            modType: StatModifierType.PERCENT,
            value: 0.24,
          },
        },
        {
          type: EffectType.ManaRegen,
          params: {
            amount: 80,
          },
        },
      ],
    };

    expect(calculateSingleTechniqueScore(advancedTechnique)).toBeGreaterThan(
      calculateSingleTechniqueScore(basicTechnique),
    );
  });
});

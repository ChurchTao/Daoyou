/**
 * EffectMaterializer 单元测试
 */

import { EffectType, StatModifierType } from '@/engine/effect/types';
import { EffectMaterializer } from './EffectMaterializer';
import type { AffixWeight, MaterializationContext } from './types';

describe('EffectMaterializer', () => {
  // 基础上下文
  const baseContext: MaterializationContext = {
    realm: '筑基',
    quality: '玄品',
  };

  describe('materialize', () => {
    it('应该正确处理固定值参数', () => {
      const affix: AffixWeight = {
        effectType: EffectType.StatModifier,
        trigger: 'ON_STAT_CALC',
        paramsTemplate: {
          stat: 'vitality',
          modType: StatModifierType.FIXED,
          value: 50,
        },
        weight: 100,
        displayName: '体魄加成',
      };

      const result = EffectMaterializer.materialize(affix, baseContext);

      expect(result.type).toBe(EffectType.StatModifier);
      expect(result.trigger).toBe('ON_STAT_CALC');
      expect(result.params).toMatchObject({
        stat: 'vitality',
        modType: StatModifierType.FIXED,
        value: 50,
      });
    });

    it('应该正确处理 realm 缩放值', () => {
      const affix: AffixWeight = {
        effectType: EffectType.StatModifier,
        trigger: 'ON_STAT_CALC',
        paramsTemplate: {
          stat: 'spirit',
          modType: StatModifierType.FIXED,
          value: { base: 10, scale: 'realm', coefficient: 1 },
        },
        weight: 100,
        displayName: '灵力加成',
      };

      // 筑基境界倍率为 2.0
      const result = EffectMaterializer.materialize(affix, {
        ...baseContext,
        realm: '筑基',
      });

      // base 10 * realm 2.0 * coefficient 1 * quality factor (随机 0.2-0.4 for 玄品)
      expect(result.params).toHaveProperty('value');
      const value = (result.params as Record<string, unknown>).value as number;
      expect(value).toBeGreaterThanOrEqual(4); // 最小值：10 * 2 * 0.2 = 4
      expect(value).toBeLessThanOrEqual(50); // 合理上限
    });

    it('应该正确处理 quality 缩放值', () => {
      const affix: AffixWeight = {
        effectType: EffectType.Critical,
        trigger: 'ON_STAT_CALC',
        paramsTemplate: {
          critRateBonus: { base: 0.05, scale: 'quality', coefficient: 1 },
        },
        weight: 100,
        displayName: '暴击率提升',
      };

      // 玄品品质倍率为 1.0
      const result = EffectMaterializer.materialize(affix, {
        ...baseContext,
        quality: '玄品',
      });

      expect(result.params).toHaveProperty('critRateBonus');
      const bonus = (result.params as Record<string, unknown>)
        .critRateBonus as number;
      expect(bonus).toBeGreaterThan(0);
      expect(bonus).toBeLessThan(0.2);
    });

    it('应该正确处理 wisdom 缩放值', () => {
      const affix: AffixWeight = {
        effectType: EffectType.Damage,
        trigger: 'ON_SKILL_HIT',
        paramsTemplate: {
          multiplier: { base: 1.0, scale: 'wisdom', coefficient: 1 },
          element: '火',
          canCrit: true,
        },
        weight: 100,
        displayName: '火焰伤害',
      };

      // 高悟性
      const highWisdomResult = EffectMaterializer.materialize(affix, {
        ...baseContext,
        wisdom: 400,
      });

      // 低悟性
      const lowWisdomResult = EffectMaterializer.materialize(affix, {
        ...baseContext,
        wisdom: 50,
      });

      const highMultiplier = (
        highWisdomResult.params as Record<string, unknown>
      ).multiplier as number;
      const lowMultiplier = (lowWisdomResult.params as Record<string, unknown>)
        .multiplier as number;

      expect(highMultiplier).toBeGreaterThan(lowMultiplier);
    });

    it('应该正确处理元素继承', () => {
      const affix: AffixWeight = {
        effectType: EffectType.Damage,
        trigger: 'ON_SKILL_HIT',
        paramsTemplate: {
          multiplier: 1.0,
          element: 'INHERIT',
          canCrit: true,
        },
        weight: 100,
        displayName: '元素伤害',
      };

      const result = EffectMaterializer.materialize(affix, {
        ...baseContext,
        element: '雷',
      });

      expect((result.params as Record<string, unknown>).element).toBe('雷');
    });
  });

  describe('materializeAll', () => {
    it('应该批量数值化多个词条', () => {
      const affixes: AffixWeight[] = [
        {
          effectType: EffectType.StatModifier,
          trigger: 'ON_STAT_CALC',
          paramsTemplate: {
            stat: 'vitality',
            modType: StatModifierType.FIXED,
            value: 20,
          },
          weight: 100,
          displayName: '体魄加成',
        },
        {
          effectType: EffectType.LifeSteal,
          trigger: 'ON_AFTER_DAMAGE',
          paramsTemplate: {
            stealPercent: 0.05,
          },
          weight: 50,
          displayName: '吸血',
        },
      ];

      const results = EffectMaterializer.materializeAll(affixes, baseContext);

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe(EffectType.StatModifier);
      expect(results[1].type).toBe(EffectType.LifeSteal);
    });
  });

  describe('createStatModifier', () => {
    it('应该快速创建固定值属性修正', () => {
      const result = EffectMaterializer.createStatModifier(
        'spirit',
        10,
        false,
        baseContext,
      );

      expect(result.type).toBe(EffectType.StatModifier);
      expect(result.trigger).toBe('ON_STAT_CALC');
      expect((result.params as Record<string, unknown>).stat).toBe('spirit');
      expect((result.params as Record<string, unknown>).modType).toBe(1); // FIXED
    });

    it('应该快速创建百分比属性修正', () => {
      const result = EffectMaterializer.createStatModifier(
        'vitality',
        0.1,
        true,
        baseContext,
      );

      expect((result.params as Record<string, unknown>).modType).toBe(2); // PERCENT
    });
  });

  describe('不同境界的数值缩放', () => {
    const realmAffix: AffixWeight = {
      effectType: EffectType.StatModifier,
      trigger: 'ON_STAT_CALC',
      paramsTemplate: {
        stat: 'vitality',
        modType: StatModifierType.FIXED,
        value: { base: 10, scale: 'realm', coefficient: 1 },
      },
      weight: 100,
      displayName: '体魄加成',
    };

    it('炼气期数值应该较低', () => {
      const result = EffectMaterializer.materialize(realmAffix, {
        realm: '炼气',
        quality: '凡品',
      });
      const value = (result.params as Record<string, unknown>).value as number;
      expect(value).toBeLessThan(10);
    });

    it('渡劫期数值应该很高', () => {
      const result = EffectMaterializer.materialize(realmAffix, {
        realm: '渡劫',
        quality: '神品',
      });
      const value = (result.params as Record<string, unknown>).value as number;
      expect(value).toBeGreaterThan(200);
    });
  });
});

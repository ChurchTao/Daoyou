/**
 * BuffMaterializer 单元测试
 *
 * 测试 Buff 动态数值化功能
 */

import { EffectType, StatModifierType } from '@/engine/effect/types';
import { BuffMaterializer } from './BuffMaterializer';
import { BuffStackType, BuffTag, type BuffTemplate } from './types';

describe('BuffMaterializer', () => {
  // 测试用的模板
  const burnTemplate: BuffTemplate = {
    id: 'test_burn',
    name: '测试灼烧',
    descriptionTemplate: '每回合受到 {damage} 点火焰伤害',
    maxStacks: 3,
    duration: 3,
    stackType: BuffStackType.STACK,
    tags: [BuffTag.DOT, BuffTag.DEBUFF],
    effectTemplates: [
      {
        type: EffectType.DotDamage,
        paramsTemplate: {
          baseDamage: { base: 20, scale: 'caster_spirit', coefficient: 0.3 },
          element: '火',
          usesCasterStats: true,
        },
      },
    ],
  };

  const shieldTemplate: BuffTemplate = {
    id: 'test_shield',
    name: '测试护盾',
    descriptionTemplate: '获得 {shield} 点护盾',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF],
    effectTemplates: [
      {
        type: EffectType.Shield,
        paramsTemplate: {
          amount: { base: 50, scale: 'quality', coefficient: 1.0 },
        },
      },
    ],
  };

  const stackBuffTemplate: BuffTemplate = {
    id: 'test_stack_buff',
    name: '测试叠层Buff',
    descriptionTemplate: '伤害提升',
    maxStacks: 5,
    duration: 3,
    stackType: BuffStackType.STACK,
    tags: [BuffTag.BUFF],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'spirit',
          modType: StatModifierType.PERCENT,
          value: { base: 0.05, scale: 'stacks', coefficient: 1.0 },
        },
      },
    ],
  };

  const fixedTemplate: BuffTemplate = {
    id: 'test_fixed',
    name: '测试固定值',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'speed',
          modType: StatModifierType.FIXED,
          value: 20, // 固定值，不缩放
        },
      },
    ],
  };

  describe('materialize - 基础功能', () => {
    it('应该正确生成 BuffConfig 的基本字段', () => {
      const config = BuffMaterializer.materialize(burnTemplate, {});

      expect(config.id).toBe('test_burn');
      expect(config.name).toBe('测试灼烧');
      expect(config.maxStacks).toBe(3);
      expect(config.duration).toBe(3);
      expect(config.stackType).toBe(BuffStackType.STACK);
      expect(config.tags).toContain(BuffTag.DOT);
      expect(config.effects).toHaveLength(1);
    });

    it('应该正确处理固定值参数', () => {
      const config = BuffMaterializer.materialize(fixedTemplate, {});
      const params = config.effects[0].params as Record<string, unknown>;

      expect(params.value).toBe(20);
      expect(params.stat).toBe('speed');
    });
  });

  describe('materialize - 施法者属性缩放', () => {
    it('灵力缩放：高灵力施法者应产生更高的伤害', () => {
      const lowSpiritConfig = BuffMaterializer.materialize(burnTemplate, {
        casterSpirit: 50,
      });
      const highSpiritConfig = BuffMaterializer.materialize(burnTemplate, {
        casterSpirit: 200,
      });

      const lowDamage = (
        lowSpiritConfig.effects[0].params as Record<string, unknown>
      ).baseDamage as number;
      const highDamage = (
        highSpiritConfig.effects[0].params as Record<string, unknown>
      ).baseDamage as number;

      expect(highDamage).toBeGreaterThan(lowDamage);
      // 200 灵力应该是 50 灵力的 4 倍
      expect(highDamage / lowDamage).toBeCloseTo(4, 1);
    });

    it('悟性缩放：应该正确基于悟性缩放', () => {
      const wisdomTemplate: BuffTemplate = {
        id: 'test_wisdom',
        name: '测试悟性',
        maxStacks: 1,
        duration: 2,
        stackType: BuffStackType.REFRESH,
        tags: [BuffTag.BUFF],
        effectTemplates: [
          {
            type: EffectType.StatModifier,
            paramsTemplate: {
              stat: 'crit_rate',
              modType: StatModifierType.FIXED,
              value: { base: 0.1, scale: 'caster_wisdom', coefficient: 1.0 },
            },
          },
        ],
      };

      const lowWisdomConfig = BuffMaterializer.materialize(wisdomTemplate, {
        casterWisdom: 50,
      });
      const highWisdomConfig = BuffMaterializer.materialize(wisdomTemplate, {
        casterWisdom: 200,
      });

      const lowValue = (
        lowWisdomConfig.effects[0].params as Record<string, unknown>
      ).value as number;
      const highValue = (
        highWisdomConfig.effects[0].params as Record<string, unknown>
      ).value as number;

      expect(highValue).toBeGreaterThan(lowValue);
    });
  });

  describe('materialize - 品质缩放', () => {
    it('高品质应产生更强的效果', () => {
      const lowQualityConfig = BuffMaterializer.materialize(shieldTemplate, {
        quality: '凡品',
      });
      const highQualityConfig = BuffMaterializer.materialize(shieldTemplate, {
        quality: '天品',
      });

      const lowAmount = (
        lowQualityConfig.effects[0].params as Record<string, unknown>
      ).amount as number;
      const highAmount = (
        highQualityConfig.effects[0].params as Record<string, unknown>
      ).amount as number;

      expect(highAmount).toBeGreaterThan(lowAmount);
    });

    it('品质倍率应符合预期', () => {
      const fanpinConfig = BuffMaterializer.materialize(shieldTemplate, {
        quality: '凡品',
      });
      const xuanpinConfig = BuffMaterializer.materialize(shieldTemplate, {
        quality: '玄品',
      });

      const fanpinAmount = (
        fanpinConfig.effects[0].params as Record<string, unknown>
      ).amount as number;
      const xuanpinAmount = (
        xuanpinConfig.effects[0].params as Record<string, unknown>
      ).amount as number;

      // 玄品(1.0) / 凡品(0.5) = 2
      expect(xuanpinAmount / fanpinAmount).toBeCloseTo(2, 1);
    });
  });

  describe('materialize - 层数缩放', () => {
    it('层数应该影响效果数值', () => {
      const oneStackConfig = BuffMaterializer.materialize(stackBuffTemplate, {
        stacks: 1,
      });
      const threeStackConfig = BuffMaterializer.materialize(stackBuffTemplate, {
        stacks: 3,
      });

      const oneStackValue = (
        oneStackConfig.effects[0].params as Record<string, unknown>
      ).value as number;
      const threeStackValue = (
        threeStackConfig.effects[0].params as Record<string, unknown>
      ).value as number;

      expect(threeStackValue).toBeCloseTo(oneStackValue * 3, 5);
    });
  });

  describe('materialize - 参数覆盖', () => {
    it('应该正确应用参数覆盖', () => {
      const config = BuffMaterializer.materialize(
        burnTemplate,
        { casterSpirit: 100 },
        {
          0: {
            baseDamage: { base: 100, scale: 'none', coefficient: 1.0 },
          },
        },
      );

      const damage = (config.effects[0].params as Record<string, unknown>)
        .baseDamage as number;

      // 使用覆盖的值
      expect(damage).toBe(100);
    });

    it('覆盖的值仍然支持缩放', () => {
      const lowQualityConfig = BuffMaterializer.materialize(
        burnTemplate,
        { quality: '凡品' },
        {
          0: {
            baseDamage: { base: 50, scale: 'quality', coefficient: 1.0 },
          },
        },
      );
      const highQualityConfig = BuffMaterializer.materialize(
        burnTemplate,
        { quality: '天品' },
        {
          0: {
            baseDamage: { base: 50, scale: 'quality', coefficient: 1.0 },
          },
        },
      );

      const lowDamage = (
        lowQualityConfig.effects[0].params as Record<string, unknown>
      ).baseDamage as number;
      const highDamage = (
        highQualityConfig.effects[0].params as Record<string, unknown>
      ).baseDamage as number;

      expect(highDamage).toBeGreaterThan(lowDamage);
    });
  });

  describe('materialize - 描述生成', () => {
    it('应该正确替换描述中的占位符', () => {
      const config = BuffMaterializer.materialize(burnTemplate, {
        casterSpirit: 100,
      });

      // 描述中应该包含具体数值
      expect(config.description).toContain('每回合受到');
      expect(config.description).toContain('点火焰伤害');
    });

    it('没有描述模板时应返回空描述', () => {
      const config = BuffMaterializer.materialize(fixedTemplate, {});

      expect(config.description).toBe('');
    });
  });

  describe('buildContextFromCaster', () => {
    it('应该从施法者对象构建上下文', () => {
      const mockCaster = {
        getAttribute: (key: string) => {
          const attrs: Record<string, number> = {
            spirit: 150,
            wisdom: 120,
            willpower: 100,
            vitality: 80,
          };
          return attrs[key] ?? 0;
        },
      };

      const context = BuffMaterializer.buildContextFromCaster(mockCaster);

      expect(context.casterSpirit).toBe(150);
      expect(context.casterWisdom).toBe(120);
      expect(context.casterWillpower).toBe(100);
      expect(context.casterVitality).toBe(80);
    });

    it('应该合并额外的上下文参数', () => {
      const mockCaster = {
        getAttribute: () => 100,
      };

      const context = BuffMaterializer.buildContextFromCaster(mockCaster, {
        quality: '地品',
        stacks: 3,
      });

      expect(context.casterSpirit).toBe(100);
      expect(context.quality).toBe('地品');
      expect(context.stacks).toBe(3);
    });
  });
});

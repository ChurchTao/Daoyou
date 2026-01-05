import type { BaseEffect } from './BaseEffect';
import { effectEngine } from './EffectEngine';
import { EffectFactory } from './EffectFactory';
import {
  LifeStealEffect,
  ModifyHitRateEffect,
  ReflectDamageEffect,
  ShieldEffect,
} from './effects';
import { AddBuffEffect } from './effects/AddBuffEffect';
import { CriticalEffect } from './effects/CriticalEffect';
import { DamageEffect } from './effects/DamageEffect';
import { DamageReductionEffect } from './effects/DamageReductionEffect';
import { DotDamageEffect } from './effects/DotDamageEffect';
import { HealEffect } from './effects/HealEffect';
import { StatModifierEffect } from './effects/StatModifierEffect';
import {
  EffectTrigger,
  EffectType,
  StatModifierType,
  type EffectConfig,
  type Entity,
} from './types';

describe('Effect Engine', () => {
  // 模拟实体
  const createMockEntity = (attrs: Record<string, number> = {}): Entity => {
    const attributes = new Map<string, number>(Object.entries(attrs));
    const effects: BaseEffect[] = [];

    return {
      id: 'test-entity',
      name: '测试实体',
      getAttribute: (key: string) => attributes.get(key) ?? 0,
      setAttribute: (key: string, value: number) => attributes.set(key, value),
      collectAllEffects: () => effects,
    };
  };

  describe('StatModifierEffect', () => {
    it('应该正确应用固定值加成', () => {
      const effect = new StatModifierEffect({
        stat: 'ATK',
        modType: StatModifierType.FIXED,
        value: 50,
      });

      const ctx = {
        source: createMockEntity({ ATK: 100 }),
        trigger: EffectTrigger.ON_STAT_CALC,
        value: 100,
        metadata: { statName: 'ATK' },
      };

      expect(effect.shouldTrigger(ctx)).toBe(true);

      effect.apply(ctx);
      expect(ctx.value).toBe(150);
    });

    it('应该正确应用百分比加成', () => {
      const effect = new StatModifierEffect({
        stat: 'ATK',
        modType: StatModifierType.PERCENT,
        value: 0.2, // 20%
      });

      const ctx = {
        source: createMockEntity({ ATK: 100 }),
        trigger: EffectTrigger.ON_STAT_CALC,
        value: 100,
        metadata: { statName: 'ATK' },
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(120);
    });

    it('应该只在匹配的属性上触发', () => {
      const effect = new StatModifierEffect({
        stat: 'ATK',
        modType: StatModifierType.FIXED,
        value: 50,
      });

      const ctx = {
        source: createMockEntity(),
        trigger: EffectTrigger.ON_STAT_CALC,
        value: 100,
        metadata: { statName: 'DEF' },
      };

      expect(effect.shouldTrigger(ctx)).toBe(false);
    });

    it('应该支持动态值函数', () => {
      const effect = new StatModifierEffect({
        stat: 'ATK',
        modType: StatModifierType.FIXED,
        value: (ctx) => ctx.source.getAttribute('spirit') * 2,
      });

      const ctx = {
        source: createMockEntity({ spirit: 50 }),
        trigger: EffectTrigger.ON_STAT_CALC,
        value: 100,
        metadata: { statName: 'ATK' },
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(200); // 100 + 50*2
    });
  });

  describe('DamageEffect', () => {
    it('应该正确计算基础伤害', () => {
      const effect = new DamageEffect({
        multiplier: 1.5,
        flatDamage: 10,
      });

      const source = createMockEntity({ spirit: 100 });
      const target = createMockEntity({ HP: 1000 });

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_SKILL_HIT,
        value: 0,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(160); // 100 * 1.5 + 10
    });
  });

  describe('EffectFactory', () => {
    it('应该正确创建 StatModifierEffect', () => {
      const config: EffectConfig = {
        type: EffectType.StatModifier,
        params: {
          stat: 'ATK',
          modType: StatModifierType.FIXED,
          value: 50,
        },
      };

      const effect = EffectFactory.create(config);
      expect(effect).toBeInstanceOf(StatModifierEffect);
    });

    it('应该正确创建 DamageEffect', () => {
      const config: EffectConfig = {
        type: EffectType.Damage,
        params: {
          multiplier: 1.5,
          element: '火',
        },
      };

      const effect = EffectFactory.create(config);
      expect(effect).toBeInstanceOf(DamageEffect);
    });

    it('对未知类型应返回 NoOpEffect', () => {
      const config: EffectConfig = {
        type: 'UnknownType' as EffectType,
        params: {},
      };

      const effect = EffectFactory.create(config);
      expect(effect.id).toBe('NoOp');
    });
  });

  describe('EffectEngine', () => {
    it('应该收集并执行所有匹配效果', () => {
      const engine = effectEngine;

      // 创建带效果的实体
      const effect1 = new StatModifierEffect({
        stat: 'ATK',
        modType: StatModifierType.FIXED,
        value: 20,
      });
      const effect2 = new StatModifierEffect({
        stat: 'ATK',
        modType: StatModifierType.PERCENT,
        value: 0.1,
      });

      const mockEntity: Entity = {
        id: 'test',
        name: '测试',
        getAttribute: () => 100,
        setAttribute: () => {},
        collectAllEffects: () => [effect1, effect2],
      };

      const result = engine.process(
        EffectTrigger.ON_STAT_CALC,
        mockEntity,
        undefined,
        100,
        { statName: 'ATK' },
      );

      // BASE(100) + FIXED(20) = 120, then * 1.1 = 132
      expect(result).toBe(132);
    });

    it('应该按优先级排序执行', () => {
      const engine = effectEngine;

      // 百分比效果 (priority = 2000)
      const percentEffect = new StatModifierEffect({
        stat: 'ATK',
        modType: StatModifierType.PERCENT,
        value: 0.5,
      });

      // 固定值效果 (priority = 1000)
      const fixedEffect = new StatModifierEffect({
        stat: 'ATK',
        modType: StatModifierType.FIXED,
        value: 50,
      });

      const mockEntity: Entity = {
        id: 'test',
        name: '测试',
        getAttribute: () => 100,
        setAttribute: () => {},
        // 故意乱序添加
        collectAllEffects: () => [percentEffect, fixedEffect],
      };

      const result = engine.process(
        EffectTrigger.ON_STAT_CALC,
        mockEntity,
        undefined,
        100,
        { statName: 'ATK' },
      );

      // 应该先执行 FIXED 再执行 PERCENT
      // (100 + 50) * 1.5 = 225
      expect(result).toBe(225);
    });
  });

  describe('ReflectDamageEffect', () => {
    it('应该正确计算反伤', () => {
      const effect = new ReflectDamageEffect({ reflectPercent: 0.2 });

      const source = createMockEntity({ HP: 1000 });
      const target = createMockEntity({ HP: 500 });

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_AFTER_DAMAGE,
        value: 0,
        metadata: { finalDamage: 100 } as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(20); // 100 * 0.2 = 20
      expect(ctx.metadata?.reflectDamage).toBe(20);
    });
  });

  describe('LifeStealEffect', () => {
    it('应该正确计算吸血量', () => {
      const effect = new LifeStealEffect({ stealPercent: 0.15 });

      const source = createMockEntity({ HP: 800 });
      const target = createMockEntity({ HP: 500 });

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_AFTER_DAMAGE,
        value: 0,
        metadata: { finalDamage: 200 } as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(30); // 200 * 0.15 = 30
      expect(ctx.metadata?.lifeSteal).toBe(30);
    });
  });

  describe('ShieldEffect', () => {
    it('应该正确吸收伤害', () => {
      const effect = new ShieldEffect({ amount: 50 });

      const source = createMockEntity();
      const target = createMockEntity();

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_BEFORE_DAMAGE,
        value: 80, // 入站伤害
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(30); // 80 - 50 = 30
      expect(ctx.metadata?.shieldAbsorbed).toBe(50);
    });

    it('护盾不足时应完全吸收', () => {
      const effect = new ShieldEffect({ amount: 100 });

      const ctx = {
        source: createMockEntity(),
        target: createMockEntity(),
        trigger: EffectTrigger.ON_BEFORE_DAMAGE,
        value: 30, // 入站伤害小于护盾
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(0); // 完全吸收
      expect(ctx.metadata?.shieldAbsorbed).toBe(30);
    });
  });

  describe('ModifyHitRateEffect', () => {
    it('应该增加命中率', () => {
      const effect = new ModifyHitRateEffect({
        hitRateBonus: 0.2,
        affectsTarget: false,
      });

      const ctx = {
        source: createMockEntity(),
        target: createMockEntity(),
        trigger: EffectTrigger.ON_CALC_HIT_RATE,
        value: 0.7, // 基础命中率
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBeCloseTo(0.9, 10); // 0.7 + 0.2 = 0.9
    });

    it('目标闪避效果应减少命中率', () => {
      const effect = new ModifyHitRateEffect({
        hitRateBonus: 0.3,
        affectsTarget: true, // 闪避效果
      });

      const ctx = {
        source: createMockEntity(),
        target: createMockEntity(),
        trigger: EffectTrigger.ON_CALC_HIT_RATE,
        value: 1.0, // 基础命中率
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(0.7); // 1.0 - 0.3 = 0.7
    });
  });

  // ============================================================
  // 以下为新增测试：补充缺失效果的单元测试覆盖
  // ============================================================

  describe('HealEffect', () => {
    it('应该正确计算基础治疗量', () => {
      const effect = new HealEffect({
        multiplier: 0.5,
        flatHeal: 20,
        targetSelf: true,
      });

      const source = createMockEntity({ spirit: 100 });
      const target = createMockEntity();

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_SKILL_HIT,
        value: 0,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      // 100 * 0.5 + 20 = 70
      expect(ctx.value).toBe(70);
      expect(ctx.metadata?.targetSelf).toBe(true);
    });

    it('只使用固定治疗量时应正确计算', () => {
      const effect = new HealEffect({
        multiplier: 0,
        flatHeal: 50,
        targetSelf: true,
      });

      const source = createMockEntity({ spirit: 100 });

      const ctx = {
        source,
        trigger: EffectTrigger.ON_SKILL_HIT,
        value: 0,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(50);
    });

    it('治疗他人时应标记 targetSelf 为 false', () => {
      const effect = new HealEffect({
        multiplier: 1.0,
        flatHeal: 0,
        targetSelf: false,
      });

      const source = createMockEntity({ spirit: 100 });
      const target = createMockEntity();

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_SKILL_HIT,
        value: 0,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(100);
      expect(ctx.metadata?.targetSelf).toBe(false);
    });

    it('没有目标且不治疗自身时不应生效', () => {
      const effect = new HealEffect({
        multiplier: 1.0,
        flatHeal: 50,
        targetSelf: false,
      });

      const source = createMockEntity({ spirit: 100 });

      const ctx = {
        source,
        target: undefined,
        trigger: EffectTrigger.ON_SKILL_HIT,
        value: 0,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(0); // 没有目标，治疗无效
    });
  });

  describe('DotDamageEffect', () => {
    it('应该正确计算基础 DOT 伤害', () => {
      const effect = new DotDamageEffect({
        baseDamage: 50,
        usesCasterStats: false,
      });

      const source = createMockEntity();
      const target = createMockEntity();

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_TURN_START,
        value: 0,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(50);
    });

    it('使用施法者属性加成时应增加伤害', () => {
      const effect = new DotDamageEffect({
        baseDamage: 50,
        usesCasterStats: true,
      });

      const ctx = {
        source: createMockEntity(),
        trigger: EffectTrigger.ON_TURN_START,
        value: 0,
        metadata: {
          casterSnapshot: {
            attributes: { spirit: 100 }, // 100 * 0.1 = 10 额外伤害
          },
        },
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(60); // 50 + 10
    });

    it('使用元素亲和加成时应增加伤害', () => {
      const effect = new DotDamageEffect({
        baseDamage: 50,
        element: '火',
        usesCasterStats: true,
      });

      const ctx = {
        source: createMockEntity(),
        trigger: EffectTrigger.ON_TURN_START,
        value: 0,
        metadata: {
          casterSnapshot: {
            attributes: { spirit: 100 },
            elementMultipliers: { 火: 1.2 },
          },
        },
      };

      effect.apply(ctx);
      // (50 + 10) * 1.2 = 72
      expect(ctx.value).toBe(72);
    });

    it('只在正确触发时机触发', () => {
      const effect = new DotDamageEffect({ baseDamage: 50 });

      const ctx = {
        source: createMockEntity(),
        trigger: EffectTrigger.ON_SKILL_HIT, // 错误的触发时机
        value: 0,
        metadata: {} as Record<string, unknown>,
      };

      expect(effect.shouldTrigger(ctx)).toBe(false);
    });
  });

  describe('CriticalEffect', () => {
    it('应该在高智慧时增加暴击率', () => {
      const effect = new CriticalEffect({
        critRateBonus: 0.1,
        critDamageMultiplier: 1.5,
      });

      const source = createMockEntity({ wisdom: 250 }); // 250/500 = 50% 基础暴击率
      const target = createMockEntity();

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_BEFORE_DAMAGE,
        value: 100,
        metadata: {} as Record<string, unknown>,
      };

      // 模拟必定暴击
      const originalRandom = Math.random;
      Math.random = () => 0.4; // 小于 50% + 10% = 60%

      effect.apply(ctx);

      Math.random = originalRandom;

      expect(ctx.metadata?.isCritical).toBe(true);
      expect(ctx.metadata?.critProcessed).toBe(true);
      expect(ctx.value).toBe(150); // 100 * 1.5
    });

    it('暴击未触发时伤害不应改变', () => {
      const effect = new CriticalEffect({
        critRateBonus: 0,
        critDamageMultiplier: 1.5,
      });

      const source = createMockEntity({ wisdom: 100 }); // 100/500 = 20% 基础暴击率
      const target = createMockEntity();

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_BEFORE_DAMAGE,
        value: 100,
        metadata: {} as Record<string, unknown>,
      };

      // 模拟必定不暴击
      const originalRandom = Math.random;
      Math.random = () => 0.8; // 大于 20%

      effect.apply(ctx);

      Math.random = originalRandom;

      expect(ctx.metadata?.isCritical).toBe(false);
      expect(ctx.value).toBe(100); // 伤害不变
    });

    it('已处理过暴击时不应重复判定', () => {
      const effect = new CriticalEffect({ critDamageMultiplier: 2.0 });

      const ctx = {
        source: createMockEntity({ wisdom: 500 }), // 100% 暴击率
        target: createMockEntity(),
        trigger: EffectTrigger.ON_BEFORE_DAMAGE,
        value: 100,
        metadata: { critProcessed: true }, // 已处理过
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(100); // 不应改变
    });
  });

  describe('DamageReductionEffect', () => {
    it('应该正确计算百分比减伤', () => {
      const effect = new DamageReductionEffect({
        percentReduction: 0.2,
        flatReduction: 0,
        maxReduction: 0.75,
      });

      const source = createMockEntity();
      const target = createMockEntity({ vitality: 0 }); // 无基础减伤

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_BEFORE_DAMAGE,
        value: 100,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(80); // 100 * (1 - 0.2)
      expect(ctx.metadata?.reductionPercent).toBe(0.2);
    });

    it('应该正确计算固定减伤', () => {
      const effect = new DamageReductionEffect({
        percentReduction: 0,
        flatReduction: 30,
        maxReduction: 0.75,
      });

      const target = createMockEntity({ vitality: 0 });

      const ctx = {
        source: createMockEntity(),
        target,
        trigger: EffectTrigger.ON_BEFORE_DAMAGE,
        value: 100,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(70); // 100 - 30
    });

    it('应该应用减伤上限', () => {
      const effect = new DamageReductionEffect({
        percentReduction: 0.5,
        flatReduction: 0,
        maxReduction: 0.3, // 上限 30%
      });

      const target = createMockEntity({ vitality: 0 });

      const ctx = {
        source: createMockEntity(),
        target,
        trigger: EffectTrigger.ON_BEFORE_DAMAGE,
        value: 100,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(70); // 100 * (1 - 0.3)，受上限限制
      expect(ctx.metadata?.reductionPercent).toBe(0.3);
    });

    it('体魄属性应提供基础减伤', () => {
      const effect = new DamageReductionEffect({
        percentReduction: 0,
        flatReduction: 0,
        maxReduction: 0.75,
      });

      // 200 体魄 = 200/400 = 50% 基础减伤
      const target = createMockEntity({ vitality: 200 });

      const ctx = {
        source: createMockEntity(),
        target,
        trigger: EffectTrigger.ON_BEFORE_DAMAGE,
        value: 100,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(50); // 100 * (1 - 0.5)
    });

    it('百分比和固定减伤应叠加计算', () => {
      const effect = new DamageReductionEffect({
        percentReduction: 0.2,
        flatReduction: 10,
        maxReduction: 0.75,
      });

      const target = createMockEntity({ vitality: 0 });

      const ctx = {
        source: createMockEntity(),
        target,
        trigger: EffectTrigger.ON_BEFORE_DAMAGE,
        value: 100,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      // 先百分比: 100 * 0.8 = 80,
      // 再固定: 80 - 10 = 70
      expect(ctx.value).toBe(70);
    });

    it('减伤后伤害不应为负', () => {
      const effect = new DamageReductionEffect({
        percentReduction: 0.5,
        flatReduction: 100, // 固定减伤 > 减伤后伤害
        maxReduction: 0.75,
      });

      const target = createMockEntity({ vitality: 0 });

      const ctx = {
        source: createMockEntity(),
        target,
        trigger: EffectTrigger.ON_BEFORE_DAMAGE,
        value: 100,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);
      // 100 * 0.5 = 50, 50 - 100 = -50 -> 0
      expect(ctx.value).toBe(0);
    });
  });

  describe('AddBuffEffect', () => {
    it('100% 概率时应该施加 Buff', () => {
      const effect = new AddBuffEffect({
        buffId: 'test_buff',
        chance: 1.0,
        targetSelf: false,
        initialStacks: 1,
      });

      const source = createMockEntity();
      const target = createMockEntity();

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_SKILL_HIT,
        value: 0,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);

      const buffsToApply = ctx.metadata?.buffsToApply as Array<{
        buffId: string;
        applied: boolean;
        resisted: boolean;
      }>;

      expect(buffsToApply).toBeDefined();
      expect(buffsToApply.length).toBe(1);
      expect(buffsToApply[0].buffId).toBe('test_buff');
      expect(buffsToApply[0].applied).toBe(true);
      expect(buffsToApply[0].resisted).toBe(false);
    });

    it('0% 概率时应该被抵抗', () => {
      const effect = new AddBuffEffect({
        buffId: 'test_buff',
        chance: 0, // 0% 概率
        targetSelf: false,
      });

      const source = createMockEntity();
      const target = createMockEntity();

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_SKILL_HIT,
        value: 0,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);

      const buffsToApply = ctx.metadata?.buffsToApply as Array<{
        resisted: boolean;
        applied: boolean;
      }>;

      expect(buffsToApply[0].resisted).toBe(true);
      expect(buffsToApply[0].applied).toBe(false);
    });

    it('目标自身时应正确设置 targetId', () => {
      const effect = new AddBuffEffect({
        buffId: 'self_buff',
        chance: 1.0,
        targetSelf: true,
      });

      const source = createMockEntity({ spirit: 100 });
      source.id = 'source-id';

      const target = createMockEntity();
      target.id = 'target-id';

      const ctx = {
        source,
        target,
        trigger: EffectTrigger.ON_SKILL_HIT,
        value: 0,
        metadata: {} as Record<string, unknown>,
      };

      effect.apply(ctx);

      const buffsToApply = ctx.metadata?.buffsToApply as Array<{
        targetId: string;
      }>;

      expect(buffsToApply[0].targetId).toBe('source-id'); // 应该是施法者自己
    });
  });
});

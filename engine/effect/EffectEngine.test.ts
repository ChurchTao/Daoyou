import type { BaseEffect } from './BaseEffect';
import { effectEngine } from './EffectEngine';
import { EffectFactory } from './EffectFactory';
import {
  LifeStealEffect,
  ModifyHitRateEffect,
  ReflectDamageEffect,
  ShieldEffect,
} from './effects';
import { DamageEffect } from './effects/DamageEffect';
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
        metadata: {},
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
        metadata: {},
      };

      effect.apply(ctx);
      expect(ctx.value).toBe(0.7); // 1.0 - 0.3 = 0.7
    });
  });
});

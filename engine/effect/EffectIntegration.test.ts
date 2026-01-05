/**
 * 效果集成测试
 * 验证效果在战斗链路中的组合表现
 */
import { effectEngine } from './EffectEngine';
import { CriticalEffect } from './effects/CriticalEffect';
import { DamageEffect } from './effects/DamageEffect';
import { DamageReductionEffect } from './effects/DamageReductionEffect';
import { DotDamageEffect } from './effects/DotDamageEffect';
import { HealEffect } from './effects/HealEffect';
import { LifeStealEffect } from './effects/LifeStealEffect';
import { ReflectDamageEffect } from './effects/ReflectDamageEffect';
import { ShieldEffect } from './effects/ShieldEffect';
import { StatModifierEffect } from './effects/StatModifierEffect';
import { contextBuilder, createMockEntity, withMockRandom } from './testUtils';
import { EffectTrigger, StatModifierType, type EffectContext } from './types';

describe('效果集成测试', () => {
  // ============================================================
  // 伤害链路验证
  // DamageEffect → CriticalEffect → DamageReductionEffect → ShieldEffect
  // ============================================================

  describe('伤害链路验证', () => {
    it('完整伤害链路: 基础伤害 → 暴击 → 减伤 → 护盾', () => {
      // 创建攻击者，有暴击效果
      const critEffect = new CriticalEffect({
        critRateBonus: 1.0, // 100% 必定暴击
        critDamageMultiplier: 2.0,
      });

      const attacker = createMockEntity(
        'attacker',
        '攻击者',
        { spirit: 100, wisdom: 500 },
        [critEffect],
      );

      // 创建防御者，有减伤和护盾
      const reductionEffect = new DamageReductionEffect({
        percentReduction: 0.2,
        flatReduction: 10,
        maxReduction: 0.5,
      });
      const shieldEffect = new ShieldEffect({ amount: 30 });

      const defender = createMockEntity(
        'defender',
        '防御者',
        { HP: 1000, vitality: 0 },
        [reductionEffect, shieldEffect],
      );

      // 1. 计算基础伤害
      const damageEffect = new DamageEffect({
        multiplier: 1.0,
        flatDamage: 0,
      });

      const damageCtx: EffectContext = contextBuilder.forSkillHit(
        attacker,
        defender,
      );

      damageEffect.apply(damageCtx);
      const baseDamage = damageCtx.value!;

      expect(baseDamage).toBe(100);

      // 2. 应用暴击效果 (ON_BEFORE_DAMAGE) - 使用 withMockRandom 确保暴击
      const critCtx: EffectContext = contextBuilder.forBeforeDamage(
        attacker,
        defender,
        baseDamage,
      );

      withMockRandom(0, () => {
        critEffect.apply(critCtx);
      });

      const afterCrit = critCtx.value!;
      expect(afterCrit).toBe(200);
      expect((critCtx.metadata as Record<string, unknown>).isCritical).toBe(
        true,
      );

      // 3. 应用减伤效果
      const reductionCtx: EffectContext = contextBuilder.forBeforeDamage(
        attacker,
        defender,
        afterCrit,
      );

      reductionEffect.apply(reductionCtx);

      const afterReduction = reductionCtx.value!;
      expect(afterReduction).toBe(150);

      // 4. 应用护盾效果
      const shieldCtx: EffectContext = contextBuilder.forBeforeDamage(
        attacker,
        defender,
        afterReduction,
      );

      shieldEffect.apply(shieldCtx);

      const finalDamage = shieldCtx.value!;
      expect(finalDamage).toBe(120);
      expect(
        (shieldCtx.metadata as Record<string, unknown>).shieldAbsorbed,
      ).toBe(30);

      console.log(`
📊 伤害链路测试结果:
  基础伤害: ${baseDamage}
  暴击后: ${afterCrit} (${(critCtx.metadata as Record<string, unknown>).isCritical ? '✅ 暴击' : '未暴击'})
  减伤后: ${afterReduction}
  护盾吸收后: ${finalDamage} (护盾吸收: ${(shieldCtx.metadata as Record<string, unknown>).shieldAbsorbed})
      `);
    });

    it('护盾完全吸收小额伤害', () => {
      const shieldEffect = new ShieldEffect({ amount: 200 });

      const ctx: EffectContext = contextBuilder.forBeforeDamage(
        createMockEntity('a', 'A', {}),
        createMockEntity('b', 'B', {}),
        50, // 小于护盾值
      );

      shieldEffect.apply(ctx);

      expect(ctx.value).toBe(0);
      expect((ctx.metadata as Record<string, unknown>).shieldAbsorbed).toBe(50);
    });
  });

  // ============================================================
  // 吸血/反伤闭环验证
  // ============================================================

  describe('吸血/反伤闭环', () => {
    it('吸血和反伤应正确计算', () => {
      // 攻击者有吸血
      const lifeStealEffect = new LifeStealEffect({ stealPercent: 0.2 });
      const attacker = createMockEntity(
        'attacker',
        '攻击者',
        { HP: 800, spirit: 100 },
        [lifeStealEffect],
      );

      // 防御者有反伤
      const reflectEffect = new ReflectDamageEffect({ reflectPercent: 0.1 });
      const defender = createMockEntity('defender', '防御者', { HP: 1000 }, [
        reflectEffect,
      ]);

      const finalDamage = 200;

      // 1. 触发吸血
      const lifeStealCtx: EffectContext = contextBuilder.forAfterDamage(
        attacker,
        defender,
        finalDamage,
      );

      lifeStealEffect.apply(lifeStealCtx);

      const healed = lifeStealCtx.value!;
      expect(healed).toBe(40);

      // 2. 触发反伤
      const reflectCtx: EffectContext = contextBuilder.forAfterDamage(
        defender,
        attacker,
        finalDamage,
      );

      reflectEffect.apply(reflectCtx);

      const reflected = reflectCtx.value!;
      expect(reflected).toBe(20);

      console.log(`
📊 吸血/反伤测试结果:
  造成伤害: ${finalDamage}
  吸血恢复: ${healed}
  反伤伤害: ${reflected}
  净收益: ${healed - reflected}
      `);
    });
  });

  // ============================================================
  // DOT 伤害验证
  // ============================================================

  describe('DOT 伤害验证', () => {
    it('DOT 伤害应在回合开始时正确触发', () => {
      const dotEffect = new DotDamageEffect({
        baseDamage: 30,
        element: '火',
        usesCasterStats: true,
      });

      const ctx: EffectContext = contextBuilder.forTurnStart(
        createMockEntity('caster', '施法者', { spirit: 100 }),
        createMockEntity('target', '目标', { HP: 1000 }),
        {
          casterSnapshot: {
            attributes: { spirit: 100 },
            elementMultipliers: { 火: 1.5 },
          },
        },
      );

      dotEffect.apply(ctx);

      // 30 + (100 * 0.1) = 40, 然后 * 1.5 = 60
      expect(ctx.value).toBe(60);
      expect((ctx.metadata as Record<string, unknown>).dotElement).toBe('火');

      console.log(`
📊 DOT 伤害测试结果:
  基础伤害: 30
  灵力加成: +${100 * 0.1}
  元素加成: x1.5
  最终伤害: ${ctx.value}
      `);
    });

    it('多个 DOT 效果应叠加', () => {
      const burnDot = new DotDamageEffect({ baseDamage: 20, element: '火' });
      const iceDot = new DotDamageEffect({ baseDamage: 15, element: '冰' });

      const target = createMockEntity('target', '目标', { HP: 1000 });

      const ctx: EffectContext = contextBuilder.forTurnStart(target, target);

      burnDot.apply(ctx);
      iceDot.apply(ctx);

      expect(ctx.value).toBe(35); // 20 + 15
    });
  });

  // ============================================================
  // 属性修正链路验证
  // ============================================================

  describe('属性修正链路验证', () => {
    it('多层属性修正应按正确顺序计算', () => {
      // 固定值加成 (+50)
      const fixedBuff = new StatModifierEffect({
        stat: 'ATK',
        modType: StatModifierType.FIXED,
        value: 50,
      });

      // 百分比加成 (+30%)
      const percentBuff = new StatModifierEffect({
        stat: 'ATK',
        modType: StatModifierType.PERCENT,
        value: 0.3,
      });

      // 最终修正 (+20)
      const finalBuff = new StatModifierEffect({
        stat: 'ATK',
        modType: StatModifierType.FINAL,
        value: 20,
      });

      const entity = createMockEntity(
        'unit',
        '单位',
        { ATK: 100 },
        [percentBuff, fixedBuff, finalBuff], // 故意乱序
      );

      // 使用 effectEngine 处理（自动按优先级排序）
      const result = effectEngine.process(
        EffectTrigger.ON_STAT_CALC,
        entity,
        undefined,
        100, // 基础 ATK
        { statName: 'ATK' },
      );

      // 计算顺序: BASE(100) → FIXED(+50=150) → PERCENT(*1.3=195) → FINAL(+20=215)
      expect(result).toBe(215);

      console.log(`
📊 属性修正链路测试结果:
  基础值: 100
  +固定值(50): 150
  x百分比(1.3): 195
  +最终修正(20): 215
      `);
    });
  });

  // ============================================================
  // 治疗效果验证
  // ============================================================

  describe('治疗效果验证', () => {
    it('治疗自身应正确计算', () => {
      const healEffect = new HealEffect({
        multiplier: 0.8,
        flatHeal: 50,
        targetSelf: true,
      });

      const healer = createMockEntity('healer', '治疗者', { spirit: 200 });

      const ctx: EffectContext = contextBuilder.forSkillHit(
        healer,
        createMockEntity('ally', '队友', {}),
      );

      healEffect.apply(ctx);

      // 200 * 0.8 + 50 = 210
      expect(ctx.value).toBe(210);
      expect((ctx.metadata as Record<string, unknown>).targetSelf).toBe(true);
    });

    it('治疗他人应正确计算', () => {
      const healEffect = new HealEffect({
        multiplier: 1.0,
        flatHeal: 100,
        targetSelf: false,
      });

      const healer = createMockEntity('healer', '治疗者', { spirit: 150 });
      const ally = createMockEntity('ally', '队友', { HP: 500 });

      const ctx: EffectContext = contextBuilder.forSkillHit(healer, ally);

      healEffect.apply(ctx);

      // 150 * 1.0 + 100 = 250
      expect(ctx.value).toBe(250);
      expect((ctx.metadata as Record<string, unknown>).targetSelf).toBe(false);
    });
  });

  // ============================================================
  // 边界条件验证
  // ============================================================

  describe('边界条件验证', () => {
    it('零属性时效果应正确处理', () => {
      const damageEffect = new DamageEffect({
        multiplier: 1.5,
        flatDamage: 10,
      });

      const attacker = createMockEntity('attacker', '攻击者', { spirit: 0 });
      const target = createMockEntity('target', '目标', { HP: 100 });

      const ctx: EffectContext = contextBuilder.forSkillHit(attacker, target);

      damageEffect.apply(ctx);

      // 0 * 1.5 + 10 = 10
      expect(ctx.value).toBe(10);
    });

    it('超高减伤应被上限限制', () => {
      const reductionEffect = new DamageReductionEffect({
        percentReduction: 0.9, // 尝试 90% 减伤
        flatReduction: 0,
        maxReduction: 0.75, // 上限 75%
      });

      const ctx: EffectContext = contextBuilder.forBeforeDamage(
        createMockEntity('a', 'A', {}),
        createMockEntity('b', 'B', { vitality: 0 }),
        100,
      );

      reductionEffect.apply(ctx);

      expect(ctx.value).toBe(25); // 100 * (1 - 0.75)
      expect((ctx.metadata as Record<string, unknown>).reductionPercent).toBe(
        0.75,
      );
    });

    it('效果不满足触发条件时不应生效', () => {
      const dotEffect = new DotDamageEffect({ baseDamage: 50 });

      // 错误的触发时机
      const ctx: EffectContext = {
        source: createMockEntity('a', 'A', {}),
        trigger: EffectTrigger.ON_SKILL_HIT, // DOT 应该在 ON_TURN_START 触发
        value: 0,
        metadata: {},
      };

      expect(dotEffect.shouldTrigger(ctx)).toBe(false);
    });
  });
});

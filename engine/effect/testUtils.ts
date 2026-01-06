import type { BaseEffect } from './BaseEffect';
import { AddBuffEffect } from './effects/AddBuffEffect';
import type { CriticalEffectParams } from './effects/CriticalEffect';
import { CriticalEffect } from './effects/CriticalEffect';
import { DamageEffect } from './effects/DamageEffect';
import type { DamageReductionParams } from './effects/DamageReductionEffect';
import { DamageReductionEffect } from './effects/DamageReductionEffect';
import { DotDamageEffect } from './effects/DotDamageEffect';
import { HealEffect } from './effects/HealEffect';
import { LifeStealEffect } from './effects/LifeStealEffect';
import { ModifyHitRateEffect } from './effects/ModifyHitRateEffect';
import { ReflectDamageEffect } from './effects/ReflectDamageEffect';
import { ShieldEffect } from './effects/ShieldEffect';
import { StatModifierEffect } from './effects/StatModifierEffect';
import {
  EffectTrigger,
  StatModifierType,
  type AddBuffParams,
  type DamageParams,
  type DotDamageParams,
  type EffectContext,
  type Entity,
  type HealParams,
  type LifeStealParams,
  type ReflectDamageParams,
  type ShieldParams,
} from './types';

// ============================================================
// Mock Entity 工厂
// ============================================================

export interface MockEntityAttrs {
  HP?: number;
  spirit?: number;
  wisdom?: number;
  vitality?: number;
  willpower?: number;
  speed?: number;
  [key: string]: number | undefined;
}

/**
 * 创建 Mock Entity
 * @param id 实体 ID
 * @param name 实体名称
 * @param attrs 初始属性
 * @param effects 初始效果列表
 */
export function createMockEntity(
  id: string = 'test-entity',
  name: string = '测试实体',
  attrs: MockEntityAttrs = {},
  effects: BaseEffect[] = [],
): Entity {
  const attributes = new Map<string, number>();

  // 设置默认属性
  const defaults: MockEntityAttrs = {
    HP: 1000,
    spirit: 100,
    wisdom: 100,
    vitality: 100,
    willpower: 100,
    speed: 100,
  };

  // 合并默认属性和自定义属性
  Object.entries({ ...defaults, ...attrs }).forEach(([key, value]) => {
    if (value !== undefined) {
      attributes.set(key, value);
    }
  });

  return {
    id,
    name,
    getAttribute: (key: string) => attributes.get(key) ?? 0,
    setAttribute: (key: string, value: number) => attributes.set(key, value),
    collectAllEffects: () => effects,
  };
}

/**
 * 创建简单 Mock Entity（快捷方式）
 */
export function createSimpleEntity(attrs: MockEntityAttrs = {}): Entity {
  return createMockEntity('entity', '实体', attrs);
}

// ============================================================
// 效果配置构建器
// ============================================================

export const effectBuilder = {
  /**
   * 创建 StatModifierEffect
   */
  statModifier: (
    stat: string,
    modType: StatModifierType,
    value: number,
  ): StatModifierEffect => {
    return new StatModifierEffect({ stat, modType, value });
  },

  /**
   * 创建 DamageEffect
   */
  damage: (params: Partial<DamageParams> = {}): DamageEffect => {
    return new DamageEffect({
      multiplier: params.multiplier ?? 1.0,
      element: params.element,
      flatDamage: params.flatDamage ?? 0,
      canCrit: params.canCrit ?? true,
      ignoreDefense: params.ignoreDefense ?? false,
    });
  },

  /**
   * 创建 HealEffect
   */
  heal: (params: Partial<HealParams> = {}): HealEffect => {
    return new HealEffect({
      multiplier: params.multiplier ?? 1.0,
      flatHeal: params.flatHeal ?? 0,
      targetSelf: params.targetSelf ?? true,
    });
  },

  /**
   * 创建 AddBuffEffect
   */
  addBuff: (
    buffId: string,
    params: Partial<AddBuffParams> = {},
  ): AddBuffEffect => {
    return new AddBuffEffect({
      buffId,
      chance: params.chance ?? 1.0,
      durationOverride: params.durationOverride,
      initialStacks: params.initialStacks ?? 1,
      targetSelf: params.targetSelf ?? false,
    });
  },

  /**
   * 创建 DotDamageEffect
   */
  dotDamage: (params: Partial<DotDamageParams> = {}): DotDamageEffect => {
    return new DotDamageEffect({
      baseDamage: params.baseDamage ?? 50,
      element: params.element,
      usesCasterStats: params.usesCasterStats ?? false,
    });
  },

  /**
   * 创建 ShieldEffect
   */
  shield: (params: Partial<ShieldParams> = {}): ShieldEffect => {
    return new ShieldEffect({
      amount: params.amount ?? 100,
      duration: params.duration,
      absorbElement: params.absorbElement,
    });
  },

  /**
   * 创建 LifeStealEffect
   */
  lifeSteal: (params: Partial<LifeStealParams> = {}): LifeStealEffect => {
    return new LifeStealEffect({
      stealPercent: params.stealPercent ?? 0.15,
    });
  },

  /**
   * 创建 ReflectDamageEffect
   */
  reflectDamage: (
    params: Partial<ReflectDamageParams> = {},
  ): ReflectDamageEffect => {
    return new ReflectDamageEffect({
      reflectPercent: params.reflectPercent ?? 0.2,
    });
  },

  /**
   * 创建 CriticalEffect
   */
  critical: (params: Partial<CriticalEffectParams> = {}): CriticalEffect => {
    return new CriticalEffect({
      critRateBonus: params.critRateBonus ?? 0,
      critDamageBonus: params.critDamageBonus ?? 1.5,
    });
  },

  /**
   * 创建 DamageReductionEffect
   */
  damageReduction: (
    params: Partial<DamageReductionParams> = {},
  ): DamageReductionEffect => {
    return new DamageReductionEffect({
      flatReduction: params.flatReduction ?? 0,
      percentReduction: params.percentReduction ?? 0,
      maxReduction: params.maxReduction ?? 0.75,
    });
  },

  /**
   * 创建 ModifyHitRateEffect
   */
  modifyHitRate: (
    hitRateBonus: number,
    affectsTarget: boolean = false,
  ): ModifyHitRateEffect => {
    return new ModifyHitRateEffect({ hitRateBonus, affectsTarget });
  },
};

// ============================================================
// 上下文构建器
// ============================================================

export const contextBuilder = {
  /**
   * 创建 ON_SKILL_HIT 触发上下文
   */
  forSkillHit: (
    source: Entity,
    target: Entity,
    initialValue: number = 0,
    metadata: Record<string, unknown> = {},
  ): EffectContext => ({
    source,
    target,
    trigger: EffectTrigger.ON_SKILL_HIT,
    value: initialValue,
    metadata,
  }),

  /**
   * 创建 ON_BEFORE_DAMAGE 触发上下文
   */
  forBeforeDamage: (
    source: Entity,
    target: Entity,
    incomingDamage: number,
    metadata: Record<string, unknown> = {},
  ): EffectContext => ({
    source,
    target,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    value: incomingDamage,
    metadata,
  }),

  /**
   * 创建 ON_AFTER_DAMAGE 触发上下文
   */
  forAfterDamage: (
    source: Entity,
    target: Entity,
    finalDamage: number,
    metadata: Record<string, unknown> = {},
  ): EffectContext => ({
    source,
    target,
    trigger: EffectTrigger.ON_AFTER_DAMAGE,
    value: 0,
    metadata: { finalDamage, ...metadata },
  }),

  /**
   * 创建 ON_TURN_START 触发上下文
   */
  forTurnStart: (
    source: Entity,
    target?: Entity,
    metadata: Record<string, unknown> = {},
  ): EffectContext => ({
    source,
    target,
    trigger: EffectTrigger.ON_TURN_START,
    value: 0,
    metadata,
  }),

  /**
   * 创建 ON_TURN_END 触发上下文
   */
  forTurnEnd: (
    source: Entity,
    target?: Entity,
    metadata: Record<string, unknown> = {},
  ): EffectContext => ({
    source,
    target,
    trigger: EffectTrigger.ON_TURN_END,
    value: 0,
    metadata,
  }),

  /**
   * 创建 ON_STAT_CALC 触发上下文
   */
  forStatCalc: (
    source: Entity,
    statName: string,
    currentValue: number,
  ): EffectContext => ({
    source,
    trigger: EffectTrigger.ON_STAT_CALC,
    value: currentValue,
    metadata: { statName },
  }),

  /**
   * 创建 ON_CALC_HIT_RATE 触发上下文
   */
  forCalcHitRate: (
    source: Entity,
    target: Entity,
    baseHitRate: number,
  ): EffectContext => ({
    source,
    target,
    trigger: EffectTrigger.ON_CALC_HIT_RATE,
    value: baseHitRate,
    metadata: {},
  }),
};

// ============================================================
// Mock Random 工具
// ============================================================

/**
 * 替换 Math.random 以实现可预测的测试
 * @param mockValue 模拟值 (0-1)
 * @returns 恢复函数
 */
export function mockRandom(mockValue: number): () => void {
  const originalRandom = Math.random;
  Math.random = () => mockValue;
  return () => {
    Math.random = originalRandom;
  };
}

/**
 * 在测试中使用固定随机值执行回调
 */
export function withMockRandom<T>(mockValue: number, callback: () => T): T {
  const restore = mockRandom(mockValue);
  try {
    return callback();
  } finally {
    restore();
  }
}

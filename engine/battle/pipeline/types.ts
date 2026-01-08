import type { Skill } from '@/types/cultivator';
import type { BattleUnit } from '../BattleUnit';

// ============================================================
// Stage 优先级常量
// ============================================================

/**
 * 管道阶段优先级
 * 数字越小越先执行
 */
export const StagePriority = {
  // ===== 伤害管道 =====
  /** 基础伤害计算 */
  BASE_DAMAGE: 100,
  /** 伤害前处理 (暴击/减伤/护盾/斩杀) - 调用 EffectEngine */
  BEFORE_DAMAGE: 200,
  /** 应用伤害 */
  APPLY_DAMAGE: 300,
  /** 后续处理 (吸血/反伤) - 调用 EffectEngine */
  AFTER_DAMAGE: 400,

  // ===== 治疗管道 =====
  /** 基础治疗量计算 */
  BASE_HEAL: 100,
  /** 治疗处理 - 调用 EffectEngine */
  BEFORE_HEAL: 200,
  /** 应用治疗 */
  APPLY_HEAL: 300,

  // ===== 通用效果管道 =====
  /** 执行效果 */
  EXECUTE_EFFECT: 100,
} as const;

// ============================================================
// 伤害管道上下文
// ============================================================

/**
 * 伤害管道上下文
 * 在管道各阶段之间传递数据
 */
export interface DamagePipelineContext {
  // ===== 战斗单位 =====
  readonly caster: BattleUnit;
  readonly target: BattleUnit;
  readonly skill: Skill;
  readonly currentTurn: number;

  // ===== 伤害数据 =====
  baseDamage: number;
  damage: number;
  actualDamage: number;

  // ===== 状态标志 =====
  isEvaded: boolean;
  isCritical: boolean;
  critMultiplier: number;
  shieldAbsorbed: number;
  shouldContinue: boolean;

  // ===== 元数据 =====
  element?: string;
  ignoreDefense: boolean;
  ignoreShield: boolean;
  canCrit: boolean;
  /** 暴击率加成 (0-1)，叠加到基础暴击率上 */
  critRateBonus?: number;
  /** 暴击伤害倍率 */
  critDamageBonus?: number;

  // ===== 日志 =====
  logs: string[];
}

/**
 * 创建伤害管道上下文
 */
export function createPipelineContext(
  caster: BattleUnit,
  target: BattleUnit,
  skill: Skill,
  currentTurn: number,
): DamagePipelineContext {
  return {
    caster,
    target,
    skill,
    currentTurn,

    baseDamage: 0,
    damage: 0,
    actualDamage: 0,

    isEvaded: false,
    isCritical: false,
    critMultiplier: 1.5,
    shieldAbsorbed: 0,
    shouldContinue: true,

    element: undefined,
    ignoreDefense: false,
    ignoreShield: false,
    canCrit: true,
    critRateBonus: 0,
    critDamageBonus: 0,

    logs: [],
  };
}

// ============================================================
// 治疗管道上下文
// ============================================================

/**
 * 治疗管道上下文
 */
export interface HealPipelineContext {
  readonly caster: BattleUnit;
  readonly target: BattleUnit;
  readonly skill: Skill;
  readonly currentTurn: number;

  baseHeal: number;
  heal: number;
  actualHeal: number;

  shouldContinue: boolean;
  logs: string[];
}

/**
 * 创建治疗管道上下文
 */
export function createHealPipelineContext(
  caster: BattleUnit,
  target: BattleUnit,
  skill: Skill,
  currentTurn: number,
): HealPipelineContext {
  return {
    caster,
    target,
    skill,
    currentTurn,
    baseHeal: 0,
    heal: 0,
    actualHeal: 0,
    shouldContinue: true,
    logs: [],
  };
}

// ============================================================
// 通用效果管道上下文
// ============================================================

/**
 * 通用效果管道上下文
 */
export interface EffectPipelineContext {
  readonly caster: BattleUnit;
  readonly target: BattleUnit;
  readonly skill: Skill;
  readonly currentTurn: number;
  readonly effectConfig: NonNullable<Skill['effects']>[number];

  value: number;
  shouldContinue: boolean;
  logs: string[];
}

/**
 * 创建通用效果管道上下文
 */
export function createEffectPipelineContext(
  caster: BattleUnit,
  target: BattleUnit,
  skill: Skill,
  effectConfig: NonNullable<Skill['effects']>[number],
  currentTurn: number,
): EffectPipelineContext {
  return {
    caster,
    target,
    skill,
    currentTurn,
    effectConfig,
    value: 0,
    shouldContinue: true,
    logs: [],
  };
}

// ============================================================
// 管道阶段接口
// ============================================================

/**
 * 管道阶段接口
 * 使用泛型以支持不同类型的上下文
 */
export interface PipelineStage<T = unknown> {
  readonly name: string;
  readonly priority: number;
  process(ctx: T): void;
}

/**
 * 管道执行结果
 */
export interface PipelineResult {
  success: boolean;
  evaded: boolean;
  actualDamage: number;
  isCritical: boolean;
  shieldAbsorbed: number;
  healing?: number;
  logs: string[];
}

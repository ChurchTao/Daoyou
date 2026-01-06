import type { ElementType } from '@/types/constants';

// ============================================================
// 触发时机 (Trigger)
// 决定效果何时生效
// ============================================================

export enum EffectTrigger {
  // 属性计算
  ON_STAT_CALC = 'ON_STAT_CALC',

  // 战斗流程
  ON_TURN_START = 'ON_TURN_START',
  ON_TURN_END = 'ON_TURN_END',

  // 命中相关
  ON_CALC_HIT_RATE = 'ON_CALC_HIT_RATE',
  ON_DODGE = 'ON_DODGE',

  // 伤害相关
  ON_BEFORE_DAMAGE = 'ON_BEFORE_DAMAGE',
  ON_AFTER_DAMAGE = 'ON_AFTER_DAMAGE',
  ON_SKILL_HIT = 'ON_SKILL_HIT',

  // 系统事件
  ON_BREAKTHROUGH = 'ON_BREAKTHROUGH',
  ON_HEAL = 'ON_HEAL',
}

// ============================================================
// 属性修正阶段 (Stat Modifier Type)
// 决定属性计算的顺序: BASE -> FIXED -> PERCENT -> FINAL
// ============================================================

export enum StatModifierType {
  /** 基础值 (如：武器白字) */
  BASE = 0,
  /** 固定值加成 (如：力量转化攻击，戒指+10攻击) */
  FIXED = 1,
  /** 百分比加成 (如：攻击力+10%) */
  PERCENT = 2,
  /** 最终修正 (如：最终伤害+50，用于极特殊词条) */
  FINAL = 3,
}

// ============================================================
// 运行时上下文 (Effect Context)
// 包含来源、目标、当前数值等信息
// ============================================================

export interface EffectContext {
  /** 施法者/装备持有者 */
  source: Entity;
  /** 目标 (如果是自身强化，target = source) */
  target?: Entity;
  /** 触发时机 */
  trigger: EffectTrigger;
  /** 动态数据：用于管道传递，比如当前攻击力或初始伤害 */
  value?: number;
  /** 额外参数，如技能ID、元素类型、突破等级等 */
  metadata?: Record<string, unknown>;
}

// ============================================================
// 实体接口 (Entity)
// 所有战斗单位需要实现此接口以与 EffectEngine 交互
// ============================================================

export interface Entity {
  id: string;
  name: string;

  /**
   * 获取属性值
   * @param key 属性名
   */
  getAttribute(key: string): number;

  /**
   * 设置属性值
   * @param key 属性名
   * @param value 属性值
   */
  setAttribute(key: string, value: number): void;

  /**
   * 收集该实体所有生效的效果
   * 包括装备、功法、技能被动、命格、Buff 等
   */
  collectAllEffects(): IBaseEffect[];
}

// ============================================================
// 效果基类接口 (用于类型引用，避免循环依赖)
// 实际实现在 BaseEffect.ts 中
// ============================================================

export interface IBaseEffect {
  /** 效果唯一标识 */
  id: string;
  /** 触发时机 */
  trigger: EffectTrigger;
  /** 优先级 (数字越小越先执行) */
  priority: number;

  /** 检查是否满足触发条件 */
  shouldTrigger(ctx: EffectContext): boolean;

  /** 执行效果 */
  apply(ctx: EffectContext): void;
}

// ============================================================
// 效果配置 (Effect Config)
// 用于 JSON 序列化存储
// ============================================================

export interface EffectConfig {
  /** 效果类型 */
  type: EffectType;
  /** 触发时机 (可选) */
  trigger?: EffectTrigger | string;
  /** 效果参数 */
  params?: Record<string, unknown>;
}

/**
 * 效果类型枚举
 * 用于 EffectFactory 创建对应的效果实例
 */
export enum EffectType {
  StatModifier = 'StatModifier',
  Damage = 'Damage',
  Heal = 'Heal',
  AddBuff = 'AddBuff',
  RemoveBuff = 'RemoveBuff',
  DotDamage = 'DotDamage',
  ModifyHitRate = 'ModifyHitRate',
  Shield = 'Shield',
  LifeSteal = 'LifeSteal',
  ReflectDamage = 'ReflectDamage',
  Critical = 'Critical',
  DamageReduction = 'DamageReduction',
  NoOp = 'NoOp',
}

// ============================================================
// 属性修正效果参数
// ============================================================

export interface StatModifierParams {
  /** 要修改的属性名 */
  stat: string;
  /** 修正类型 */
  modType: StatModifierType;
  /** 修正值 (固定值时为具体数值，百分比时为小数如0.1表示10%) */
  value: number;
}

// ============================================================
// 伤害效果参数
// ============================================================

export interface DamageParams {
  /** 伤害倍率 (基于攻击力) */
  multiplier: number;
  /** 元素类型 */
  element?: ElementType;
  /** 固定伤害加成 */
  flatDamage?: number;
  /** 是否可暴击 */
  canCrit?: boolean;
  /** 暴击率加成 (0-1)，叠加到基础暴击率上 */
  critRateBonus?: number;
  /** 暴击伤害倍率 */
  critDamageBonus?: number;
  /** 是否无视防御 */
  ignoreDefense?: boolean;
}

// ============================================================
// 治疗效果参数
// ============================================================

export interface HealParams {
  /** 治疗倍率 (基于灵力) */
  multiplier: number;
  /** 固定治疗量 */
  flatHeal?: number;
  /** 目标自身还是他人 */
  targetSelf?: boolean;
}

// ============================================================
// 施加 Buff 效果参数
// ============================================================

export interface AddBuffParams {
  /** Buff 配置 ID */
  buffId: string;
  /** 触发概率 (0-1) */
  chance?: number;
  /** 持续回合数覆盖 */
  durationOverride?: number;
  /** 初始层数 */
  initialStacks?: number;
  /** 目标自身还是敌人 */
  targetSelf?: boolean;
}

// ============================================================
// DOT 伤害效果参数
// ============================================================

export interface DotDamageParams {
  /** 基础伤害 */
  baseDamage: number;
  /** 元素类型 */
  element?: ElementType;
  /** 是否基于施法者属性 */
  usesCasterStats?: boolean;
}

// ============================================================
// 反伤效果参数
// ============================================================

export interface ReflectDamageParams {
  /** 反伤比例 (0-1) */
  reflectPercent: number;
}

// ============================================================
// 吸血效果参数
// ============================================================

export interface LifeStealParams {
  /** 吸血比例 (0-1) */
  stealPercent: number;
}

// ============================================================
// 护盾效果参数
// ============================================================

export interface ShieldParams {
  /** 护盾值 */
  amount: number;
  /** 持续回合 */
  duration?: number;
  /** 吸收元素类型 (可选，空则吸收所有) */
  absorbElement?: ElementType;
}

// ============================================================
// 暴击效果参数
// ============================================================

export interface CriticalParams {
  /** 暴击率加成 (0-1)，叠加到基础暴击率上 */
  critRateBonus?: number;
  /** 暴击伤害倍率 */
  critDamageBonus?: number;
}

// ============================================================
// 减伤效果参数
// ============================================================

export interface DamageReductionParams {
  /** 固定减伤值 */
  flatReduction?: number;
  /** 百分比减伤 (0-1) */
  percentReduction?: number;
  /** 最大减伤上限 (0-1)，默认 0.75 */
  maxReduction?: number;
}

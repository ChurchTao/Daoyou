import type { BuffEvent } from '@/engine/buff/types';
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
  ON_BATTLE_START = 'ON_BATTLE_START',
  ON_BATTLE_END = 'ON_BATTLE_END',

  // 命中相关
  ON_CALC_HIT_RATE = 'ON_CALC_HIT_RATE',
  ON_DODGE = 'ON_DODGE',
  ON_CRITICAL_HIT = 'ON_CRITICAL_HIT',
  ON_BEING_HIT = 'ON_BEING_HIT',

  // 伤害相关
  ON_BEFORE_DAMAGE = 'ON_BEFORE_DAMAGE',
  ON_AFTER_DAMAGE = 'ON_AFTER_DAMAGE',
  ON_SKILL_HIT = 'ON_SKILL_HIT',
  ON_KILL = 'ON_KILL',

  // 系统事件
  ON_BREAKTHROUGH = 'ON_BREAKTHROUGH',
  ON_HEAL = 'ON_HEAL',
  ON_CONSUME = 'ON_CONSUME',
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
  /** 日志收集器（可选，用于需要生成日志的效果） */
  logCollector?: EffectLogCollector;
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
// 效果日志系统
// 统一收集 Effect 执行过程中产生的日志
// ============================================================

/**
 * 效果日志收集器
 * 统一收集 Effect 执行过程中产生的日志
 */
export class EffectLogCollector {
  private logs: string[] = [];

  /**
   * 添加日志
   */
  addLog(message: string): void {
    this.logs.push(message);
  }

  /**
   * 获取日志消息字符串数组
   */
  getLogMessages(): string[] {
    return [...this.logs];
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * 检查是否有日志
   */
  hasLogs(): boolean {
    return this.logs.length > 0;
  }
}

// ============================================================
// 战斗实体接口 (BattleEntity)
// 继承 Entity，添加战斗所需的修改方法
// ============================================================

/**
 * 战斗实体接口
 * 扩展自 Entity，提供战斗操作方法
 * Effect 可以通过此接口直接修改实体状态
 */
export interface BattleEntity extends Entity {
  // === 生命值操作 ===

  /**
   * 应用伤害
   * @param damage 伤害值
   * @returns 实际伤害值
   */
  applyDamage(damage: number): number;

  /**
   * 应用治疗
   * @param heal 治疗量
   * @returns 实际治疗量
   */
  applyHealing(heal: number): number;

  // === 法力值操作 ===

  /**
   * 消耗法力（用于技能释放等主动消耗）
   * @param cost 消耗量
   * @returns 是否成功（法力足够时返回 true）
   */
  consumeMp(cost: number): boolean;

  /**
   * 恢复法力
   * @param amount 恢复量
   * @returns 实际恢复量
   */
  restoreMp(amount: number): number;

  /**
   * 扣除法力（不经过消耗校验，用于法力吸取等被动效果）
   * @param amount 扣除量
   * @returns 实际扣除量
   */
  drainMp(amount: number): number;

  // === Buff 操作 ===

  /**
   * 添加 Buff
   * @param config Buff 配置
   * @param caster 施法者
   * @param turn 当前回合数
   * @param options 额外选项
   * @returns Buff 事件
   */
  addBuff(
    config: import('@/engine/buff/types').BuffConfig,
    caster: Entity,
    turn: number,
    options?: { durationOverride?: number; initialStacks?: number },
  ): BuffEvent;

  /**
   * 移除 Buff
   * @param buffId Buff ID
   * @returns 移除的数量
   */
  removeBuff(buffId: string): number;

  /**
   * 检查是否有指定 Buff
   * @param buffId Buff ID
   */
  hasBuff(buffId: string): boolean;

  /**
   * 驱散 Buff
   * @param count 驱散数量
   * @param type 驱散类型
   * @param priorityTags 优先驱散的标签
   * @returns 被驱散的 buffId 列表
   */
  dispelBuffs(
    count: number,
    type: 'buff' | 'debuff' | 'all',
    priorityTags?: string[],
  ): string[];

  // === 状态查询 ===

  /**
   * 检查是否存活
   */
  isAlive(): boolean;

  /**
   * 获取当前生命值
   */
  getCurrentHp(): number;

  /**
   * 获取当前法力值
   */
  getCurrentMp(): number;

  /**
   * 获取最大生命值
   */
  getMaxHp(): number;

  /**
   * 获取最大法力值
   */
  getMaxMp(): number;

  // === 辅助 ===

  /**
   * 标记属性为脏状态，触发重新计算
   */
  markAttributesDirty(): void;
}

/**
 * 类型守卫：检查 Entity 是否为 BattleEntity
 * @param entity 实体
 */
export function isBattleEntity(entity: Entity): entity is BattleEntity {
  return (
    'applyDamage' in entity &&
    typeof entity.applyDamage === 'function' &&
    'applyHealing' in entity &&
    typeof entity.applyHealing === 'function'
  );
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
  params?: EffectConfigParam;
}

/**
 * 效果类型枚举
 * 用于 EffectFactory 创建对应的效果实例
 */
export enum EffectType {
  // 基础效果
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

  // === P0: 伤害增幅类 ===
  ElementDamageBonus = 'ElementDamageBonus', // 元素伤害加成

  // === P0: 生存类 ===
  HealAmplify = 'HealAmplify', // 治疗效果增幅

  // === P0: 资源类 ===
  ManaRegen = 'ManaRegen', // 法力回复
  ManaDrain = 'ManaDrain', // 法力吸取

  // === P0: 控制类 ===
  Dispel = 'Dispel', // 驱散效果

  // === P1: 伤害类 ===
  ExecuteDamage = 'ExecuteDamage', // 斩杀伤害
  TrueDamage = 'TrueDamage', // 真实伤害
  CounterAttack = 'CounterAttack', // 反击效果
  BonusDamage = 'BonusDamage', // 额外伤害（造成伤害后附加伤害）

  // === 消耗品效果 ===
  ConsumeStatModifier = 'ConsumeStatModifier', // 消耗品永久属性修正
  ConsumeAddBuff = 'ConsumeAddBuff', // 消耗品添加持久 Buff
}

type EffectConfigParam =
  | StatModifierParams
  | DamageParams
  | BonusDamageParams
  | HealParams
  | AddBuffParams
  | DotDamageParams
  | ShieldParams
  | LifeStealParams
  | ReflectDamageParams
  | CriticalParams
  | DamageReductionParams
  | CounterAttackParams
  | ExecuteDamageParams
  | TrueDamageParams
  | HealAmplifyParams
  | ManaRegenParams
  | ManaDrainParams
  | DispelParams
  | ConsumeStatModifierParams
  | ConsumeAddBuffParams;

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
  /** 是否无视护盾 */
  ignoreShield?: boolean;
}

// ============================================================
// 额外伤害效果参数（BonusDamage）
// 用于在造成伤害后附加额外伤害
// ============================================================

export interface BonusDamageParams {
  /** 伤害倍率 (基于攻击力) */
  multiplier: number;
  /** 元素类型 ('INHERIT' = 继承技能元素) */
  element?: ElementType | 'INHERIT';
  /** 是否可暴击 */
  canCrit?: boolean;
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

import type {
  BuffMaterializationContext,
  BuffParamsOverride,
} from '@/engine/buff/types';

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
  /** Buff 效果参数覆盖 (动态 Buff 系统) */
  paramsOverride?: BuffParamsOverride;
  /** 数值化上下文 (动态 Buff 系统，施法时自动填充) */
  materializationContext?: BuffMaterializationContext;
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

// ============================================================
// 元素伤害加成效果参数 (P0)
// ============================================================

export interface ElementDamageBonusParams {
  /** 目标元素类型 */
  element: ElementType | string;
  /** 伤害加成百分比 (0.1 = 10%) */
  damageBonus: number;
}

// ============================================================
// 治疗增幅效果参数 (P0)
// ============================================================

export interface HealAmplifyParams {
  /** 治疗倍率加成 (可为负数，如 -0.5 表示减少 50%) */
  amplifyPercent: number;
  /** 是否影响施放的治疗 (默认 false = 影响受到的治疗) */
  affectOutgoing?: boolean;
}

// ============================================================
// 法力回复效果参数 (P0)
// ============================================================

export interface ManaRegenParams {
  /** 固定回复量 */
  amount?: number;
  /** 按最大法力百分比回复 (0.1 = 10%) */
  percentOfMax?: number;
}

// ============================================================
// 法力吸取效果参数 (P0)
// ============================================================

export interface ManaDrainParams {
  /** 吸取百分比 (基于目标当前法力) */
  drainPercent?: number;
  /** 固定吸取量 */
  drainAmount?: number;
  /** 是否恢复给自身 (默认 true) */
  restoreToSelf?: boolean;
}

// ============================================================
// 驱散效果参数 (P0)
// ============================================================

export interface DispelParams {
  /** 驱散数量 */
  dispelCount: number;
  /** 驱散类型 */
  dispelType: 'buff' | 'debuff' | 'all';
  /** 目标自身 (默认 false) */
  targetSelf?: boolean;
  /** 优先驱散的标签 (可选) */
  priorityTags?: string[];
}

// ============================================================
// 斩杀伤害效果参数 (P1)
// ============================================================

export interface ExecuteDamageParams {
  /** 生命阈值百分比 (低于此值触发，如 0.3 = 30%) */
  thresholdPercent: number;
  /** 额外伤害倍率 */
  bonusDamage: number;
  /** 是否对护盾有效 */
  affectShield?: boolean;
}

// ============================================================
// 真实伤害效果参数 (P1)
// ============================================================

export interface TrueDamageParams {
  /** 基础伤害 */
  baseDamage: number;
  /** 无视护盾 */
  ignoreShield?: boolean;
  /** 无视减伤 */
  ignoreReduction?: boolean;
}

// ============================================================
// 反击效果参数 (P1)
// ============================================================

export interface CounterAttackParams {
  /** 触发几率 (0-1) */
  chance: number;
  /** 伤害倍率 (基于受到的伤害) */
  damageMultiplier: number;
  /** 元素类型 ('INHERIT' = 继承攻击者元素) */
  element?: ElementType | 'INHERIT';
}

// ============================================================
// 消耗品效果参数
// ============================================================

/**
 * 消耗品永久属性修正参数
 */
export interface ConsumeStatModifierParams {
  /** 要修改的属性名 */
  stat: 'vitality' | 'spirit' | 'wisdom' | 'speed' | 'willpower';
  /** 修正值 (固定值时为具体数值，百分比时为小数如0.1表示10%) */
  value: number;
  /** 修正类型 */
  modType: 'fixed' | 'percent';
}

/**
 * 消耗品添加持久 Buff 参数
 */
export interface ConsumeAddBuffParams {
  /** Buff 配置 ID */
  buffId: string;
  /** 过期时间（分钟） */
  expiryMinutes?: number;
  /** 最大使用次数 */
  maxUses?: number;
  /** 初始层数 */
  initialStacks?: number;
  /** 符箓类型（可选，用于元数据） */
  drawType?: 'gongfa' | 'skill';
}

// ===== 基础类型 =====
export type UnitId = string;
export type AbilityId = string;
export type BuffId = string;
export type EventPriority = number;

// ===== 战斗事件基类 =====
export interface CombatEvent {
  readonly type: string;
  readonly priority: EventPriority;
  readonly timestamp: number;
}

// ===== 战斗阶段枚举 =====
export enum CombatPhase {
  INIT = 'init',
  DESTINY_AWAKEN = 'destiny_awaken',
  ROUND_START = 'round_start',
  ROUND_PRE = 'round_pre',
  TURN_ORDER = 'turn_order',
  ACTION = 'action',
  ROUND_POST = 'round_post',
  VICTORY_CHECK = 'victory_check',
  END = 'end',
}

// ===== 5维属性类型 =====
export enum AttributeType {
  // 基础五维
  SPIRIT = 'spirit',      // 灵力：法系输出、MP、护盾
  VITALITY = 'vitality',  // 体魄：气血、减伤
  SPEED = 'speed',        // 身法：先手、暴击率基础、闪避
  WILLPOWER = 'willpower',// 神识：控制命中/抵抗
  WISDOM = 'wisdom',      // 悟性：暴击率加成、MP上限

  // 二级衍生属性（默认值 0，完全由装备/Buff/命格提供）
  // 攻防相关
  ARMOR_PENETRATION = 'armorPenetration',        // 破防率：降低对手减伤 (0~1)
  CRIT_RESIST = 'critResist',                    // 暴击韧性：降低对手暴击率 (0~1)
  CRIT_DAMAGE_REDUCTION = 'critDamageReduction', // 暴击伤害衰减：降低受到暴击的倍率 (0~0.5)
  // 命中与闪避
  ACCURACY = 'accuracy',                         // 精准度：提高命中、压制闪避 (0~0.5)
  EVASION_MULT = 'evasionMult',                  // 闪避强度：放大自身闪避概率 (≥0)
  // 控制与生存
  RESILIENCE = 'resilience',                     // 矫健：降低控制命中率、缩短受控时间 (≥0)
  DAMAGE_REDUCTION_STR = 'damageReductionStr',   // 减伤强度：强化自身减伤上限 (≥0)
  // 辅助增益
  HEAL_AMPLIFY = 'healAmplify',                  // 治疗增强：强化己方施放的治疗量 (≥0)
}

// ===== 属性修改器类型（6阶段）=====
export enum ModifierType {
  BASE = 'base',
  FIXED = 'fixed',
  ADD = 'add',
  MULTIPLY = 'multiply',
  FINAL = 'final',
  OVERRIDE = 'override',
}

export interface AttributeModifier<TSource = unknown> {
  readonly id: string;
  readonly attrType: AttributeType;
  readonly type: ModifierType;
  readonly value: number;
  readonly source: TSource;
}

// ===== 能力类型 =====
export enum AbilityType {
  ACTIVE_SKILL = 'active_skill',
  PASSIVE_SKILL = 'passive_skill',
  DESTINY = 'destiny',
}

// ===== 效果类型 =====
export enum EffectType {
  DAMAGE = 'damage',
  HEAL = 'heal',
  SHIELD = 'shield',
  ADD_BUFF = 'add_buff',
  REMOVE_BUFF = 'remove_buff',
  STAT_MODIFIER = 'stat_modifier',
}

// ===== BUFF类型 =====
export enum BuffType {
  BUFF = 'buff',
  DEBUFF = 'debuff',
  CONTROL = 'control',
}

// ===== 战斗结果 =====
export interface BattleResult {
  winner: UnitId;
  loser: UnitId;
  turns: number;
  logs: string[];
}

// ===== 回合快照 =====
export interface TurnSnapshot {
  turn: number;
  phase: CombatPhase;
  units: Map<UnitId, UnitSnapshot>;
}

// ===== 单元快照 =====
export interface UnitSnapshot {
  unitId: UnitId;
  name: string;
  attributes: Record<AttributeType, number>;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  buffs: BuffId[];
  isAlive: boolean;
  hpPercent: number;
  mpPercent: number;
}

// ===== 战报日志 =====
export interface CombatLog {
  turn: number;
  phase: CombatPhase;
  message: string;
  highlight: boolean;
}

// ===== 标签系统类型 =====
export type TagPath = string;

// 导出事件类型定义
export * from './events';

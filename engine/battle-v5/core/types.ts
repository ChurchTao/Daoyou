// ===== 基础类型 =====
export type UnitId = string;
export type AbilityId = string;
export type BuffId = string;
export type EventPriority = number;

// ===== 战斗事件基类 =====
export interface CombatEvent {
  readonly type: string;
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
  // ── 主属性（5维）──
  SPIRIT = 'spirit',       // 灵力：法系输出、MP、护盾
  VITALITY = 'vitality',   // 体魄：气血上限、物攻/物防
  SPEED = 'speed',         // 身法：出手顺序、暴击率基础、闪避率
  WILLPOWER = 'willpower', // 神识：控制命中、控制抗性、法防
  WISDOM = 'wisdom',       // 悟性：暴击率加成、暴击伤害上限、MP上限

  // ── 派生型二级属性（base 由主属性公式推算，modifier 可叠加）──
  ATK = 'atk',                                 // 物理攻击：VITALITY×5
  DEF = 'def',                                 // 物理防御：VITALITY×3
  MAGIC_ATK = 'magicAtk',                      // 法术攻击：SPIRIT×5
  MAGIC_DEF = 'magicDef',                      // 法术防御：WILLPOWER×3
  CRIT_RATE = 'critRate',                       // 暴击率 (0~0.60)：0.05 + SPEED×0.002 + WISDOM×0.001
  CRIT_DAMAGE_MULT = 'critDamageMult',          // 暴击伤害倍率 (1.25~2.00)：1.25 + WISDOM×0.005
  EVASION_RATE = 'evasionRate',                 // 闪避率 (0~0.50)：SPEED×0.003
  CONTROL_HIT = 'controlHit',                   // 控制命中 (0~0.80)：WILLPOWER×0.003
  CONTROL_RESISTANCE = 'controlResistance',     // 控制抗性 (0~0.80)：WILLPOWER×0.003

  // ── 外部注入型二级属性（base=0，完全由装备/Buff/命格提供）──
  ARMOR_PENETRATION = 'armorPenetration',        // 破防：抵消目标减伤率 (0~1)
  MAGIC_PENETRATION = 'magicPenetration',        // 法术穿透：削减目标法防 (0~1)
  CRIT_RESIST = 'critResist',                    // 暴击韧性：降低对手暴击率 (0~1)
  CRIT_DAMAGE_REDUCTION = 'critDamageReduction', // 暴击减伤：降低受到暴击倍率 (0~0.5)
  ACCURACY = 'accuracy',                         // 精准：抵消目标闪避率 (0~0.5)
  HEAL_AMPLIFY = 'healAmplify',                  // 治疗增强 (≥0)
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

// ===== 伤害类型 =====
export enum DamageType {
  PHYSICAL = 'physical',
  MAGICAL = 'magical',
  TRUE = 'true',
  DOT = 'dot',
}

// ===== 伤害来源 =====
export enum DamageSource {
  DIRECT = 'direct',
  REFLECT = 'reflect',
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
  currentShield: number;
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

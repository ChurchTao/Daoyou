// ===== Buff 状态视图 =====
export interface BuffStateView {
  id: string;
  name: string;
  type: 'buff' | 'debuff' | 'control';
  layers: number;
  /** 剩余回合数；-1 表示永久 */
  remaining: number;
  isPermanent: boolean;
}

// ===== 技能冷却状态 =====
export interface CooldownStateView {
  skillId: string;
  skillName: string;
  /** 当前剩余冷却回合；0 = 可用 */
  current: number;
  /** 技能最大冷却回合 */
  max: number;
  /** 灵力消耗 */
  mpCost: number;
}

// ===== 属性状态视图 =====
export interface AttrsStateView {
  // 5 维主属性
  spirit: number;
  vitality: number;
  speed: number;
  willpower: number;
  wisdom: number;
  // 派生型二级属性（实际小数值，如 0.35 表示 35%）
  atk: number;
  def: number;
  magicAtk: number;
  magicDef: number;
  /** 暴击率 0-0.60 */
  critRate: number;
  /** 暴击伤害倍率 1.25-2.00 */
  critDamageMult: number;
  /** 闪避率 0-0.50 */
  evasionRate: number;
  /** 控制命中 0-0.80 */
  controlHit: number;
  /** 控制抗性 0-0.80 */
  controlResistance: number;
  // 外部注入型二级属性
  armorPenetration: number;
  magicPenetration: number;
  critResist: number;
  critDamageReduction: number;
  accuracy: number;
  healAmplify: number;
  // 资源上限
  /** 最大气血 */
  maxHp: number;
  /** 最大真元 */
  maxMp: number;
}

// ===== 单位状态快照 =====
export interface UnitStateSnapshot {
  id: string;
  name: string;
  alive: boolean;
  hp: { current: number; max: number; percent: number };
  mp: { current: number; max: number; percent: number };
  /** 当前护盾值 */
  shield: number;
  attrs: AttrsStateView;
  baseAttrs: AttrsStateView;
  buffs: BuffStateView[];
  cooldowns: CooldownStateView[];
  /** 是否可行动（存活且未被控制）*/
  canAct: boolean;
}

// ===== 单位状态变化（Delta）=====
// 仅包含相较上一帧的变化字段，便于前端只展示差异
export interface UnitStateDelta {
  id: string;
  name: string;
  hp?: { from: number; to: number; change: number };
  mp?: { from: number; to: number; change: number };
  shield?: { from: number; to: number; change: number };
  /** 仅包含发生变化的属性 */
  attrs?: Partial<Record<keyof AttrsStateView, { from: number; to: number }>>;
  baseAttrs?: Partial<Record<keyof AttrsStateView, { from: number; to: number }>>;
  buffsAdded?: BuffStateView[];
  buffsRemoved?: Array<{ id: string; name: string }>;
  buffsUpdated?: Array<{
    id: string;
    name: string;
    /** 正数=叠层，负数=减层 */
    layerChange?: number;
    /** 正数=续时，负数=消耗 */
    remainingChange?: number;
  }>;
  cooldownsChanged?: Array<{
    skillId: string;
    skillName: string;
    from: number;
    to: number;
  }>;
  canActChanged?: { from: boolean; to: boolean };
  aliveChanged?: { from: boolean; to: boolean };
}

// ===== 状态帧类型 =====
export type StateFramePhase =
  | 'battle_init'
  | 'action_pre'
  | 'action_post'
  | 'battle_end';

// ===== 战斗状态帧 =====
export interface BattleStateFrame {
  /** 全局递增帧 ID */
  frameId: number;
  turn: number;
  phase: StateFramePhase;
  /** 当前行动者 ID（action_pre / action_post 时有效）*/
  actorId?: string;
  /**
   * 关联的日志 Span ID，用于前端联动（e.g. 点击日志高亮状态帧）。
   * action_pre 对应同 actor 的 action_pre span；
   * action_post 对应同 actor 的 action span。
   */
  sourceSpanId?: string;
  /** 双方单位完整快照，key = unitId */
  units: Record<string, UnitStateSnapshot>;
  /**
   * 相较上一帧的 delta，key = unitId。
   * 若无变化则不含该 unitId；若整个字段为 undefined 则本帧无任何变化。
   */
  deltas?: Record<string, UnitStateDelta>;
}

// ===== 战斗状态时间线 =====
export interface BattleStateTimeline {
  frames: BattleStateFrame[];
  unitIds: string[];
  /** unitId → name 映射，方便前端渲染 */
  unitNames: Record<string, string>;
}

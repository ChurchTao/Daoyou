import type { AttributeType, DamageType, DamageSource } from '@shared/engine/battle-v5/core/types';

// ===== 队伍与位置 =====

export type TeamSide = 'A' | 'B';
export type Position = 'front' | 'back';

// ===== 技能类型 =====

export type TeamAbilityKind = 'aura' | 'chance_trigger' | 'conditional_response' | 'active' | 'pursuit' | 'basic';

// ===== 目标策略 =====

export type TargetTeamFilter = 'enemy' | 'ally' | 'self';
export type TargetScope = 'single' | 'aoe' | 'random';
export type TargetFilter = 'front_first' | 'back_first' | 'lowest_hp' | 'highest_hp' | 'fastest';

export interface TeamTargetPolicy {
  team: TargetTeamFilter;
  scope: TargetScope;
  filter?: TargetFilter;
  maxTargets?: number;
}

// ===== 伤害载荷 =====

export interface DamagePayload {
  attribute: AttributeType;
  coefficient: number;
  damageType: DamageType;
  source: DamageSource;
  isCounter?: boolean;
  isFollowUp?: boolean;
  /** 若设置，跳过属性×系数计算，直接以此值作为攻击基数（蓄力固定伤害用） */
  fixedAmount?: number;
}

export interface DamageResult {
  missed: boolean;
  critical: boolean;
  amount: number;
  absorbed: number;
  hpLost: number;
  lethal: boolean;
}

// ===== 引擎内部事件（abilities 订阅） =====

export type TeamBattleInternalEvent =
  | { type: 'BattleStarted'; units: TeamUnitRef[] }
  | { type: 'RoundStarted'; round: number }
  | { type: 'UnitActing'; actor: TeamUnitRef; round: number }
  | { type: 'BeforeDealDamage'; source: TeamUnitRef; target: TeamUnitRef; ability: TeamAbilityRef | null; damage: number }
  | { type: 'AfterDealDamage'; source: TeamUnitRef; target: TeamUnitRef; ability: TeamAbilityRef | null; damage: number; lethal: boolean; isCounter: boolean; isFollowUp: boolean }
  | { type: 'UnitDamaged'; target: TeamUnitRef; source: TeamUnitRef | null; damage: number; afterHp: number; isCounter: boolean; isFollowUp: boolean }
  | { type: 'UnitDied'; unit: TeamUnitRef; killer: TeamUnitRef | null }
  | { type: 'RoundEnded'; round: number };

/** 引用类型（避免循环依赖，用接口声明结构） */
export interface TeamUnitRef {
  readonly id: string;
  readonly name: string;
  readonly side: TeamSide;
  readonly position: Position;
  isAlive(): boolean;
  getHpPercent(): number;
}

export interface TeamAbilityRef {
  readonly id: string;
  readonly name: string;
  readonly kind: TeamAbilityKind;
}

// ===== 蓄力技能状态 =====

/** 蓄力技能释放时的载荷（固定伤害，不走属性计算） */
export interface ChargeReleasePayload {
  targetPolicy: TeamTargetPolicy;
  damage: number;
  damageType: DamageType;
  attribute: AttributeType;
}

/** 单位身上的待释放蓄力状态 */
export interface PendingCast {
  abilityId: string;
  abilityName: string;
  releaseRound: number;
  payload: ChargeReleasePayload;
}

// ===== 前端可见的战斗记录 =====

export type TeamBattleLogEvent =
  | { seq: number; round: number; kind: 'battle_start'; text: string }
  | { seq: number; round: number; kind: 'round_start'; text: string }
  | { seq: number; round: number; actorId: string; abilityId: string; abilityName: string; kind: 'action'; text: string }
  | { seq: number; round: number; actorId: string; targetId: string; amount: number; kind: 'damage'; text: string; critical: boolean }
  | { seq: number; round: number; actorId: string; targetId: string; amount: number; kind: 'dodge'; text: string }
  | { seq: number; round: number; actorId: string; targetId: string; amount: number; kind: 'heal'; text: string }
  | { seq: number; round: number; actorId: string; abilityId: string; kind: 'aura_apply'; text: string }
  | { seq: number; round: number; actorId: string; abilityId: string; reason: 'death' | 'expired'; kind: 'aura_remove'; text: string }
  | { seq: number; round: number; actorId: string; abilityId: string; kind: 'chance_trigger'; text: string }
  | { seq: number; round: number; actorId: string; targetId: string; abilityId: string; kind: 'counter'; text: string }
  | { seq: number; round: number; actorId: string; abilityId: string; abilityName: string; phase: 'prepare' | 'release'; kind: 'charge'; text: string }
  | { seq: number; round: number; unitId: string; kind: 'death'; text: string }
  | { seq: number; round: number; kind: 'battle_end'; text: string; winningTeam: TeamSide | null };

/**
 * 分布式 Omit：对联合类型每个成员分别 Omit，保留成员特有字段。
 * 普通 Omit<Union, K> 会丢失联合成员的独有字段，只保留共有键。
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends T ? Omit<T, K> : never;

/** recorder.log() 的入参类型：TeamBattleLogEvent 去掉 seq 字段。 */
export type TeamBattleLogEventInput = DistributiveOmit<TeamBattleLogEvent, 'seq'>;

export interface TeamUnitSnapshot {
  unitId: string;
  name: string;
  side: TeamSide;
  position: Position;
  currentHp: number;
  maxHp: number;
  shield: number;
  alive: boolean;
  activeAuras: string[];
  cooldowns: Record<string, number>;
  remainingUses: Record<string, number>;
  pendingCast: PendingCast | null;
  isTaunting: boolean;
}

export interface TeamBattleFrame {
  seq: number;
  round: number;
  units: Record<string, TeamUnitSnapshot>;
}

export interface TeamBattleParticipants {
  teamA: Array<{ id: string; name: string; position: Position }>;
  teamB: Array<{ id: string; name: string; position: Position }>;
}

export interface TeamBattleOutcome {
  winningTeam: TeamSide | null;
  turns: number;
  reachedMaxTurns: boolean;
}

export interface TeamBattleRecord {
  participants: TeamBattleParticipants;
  outcome: TeamBattleOutcome;
  events: TeamBattleLogEvent[];
  stateTimeline: {
    frames: TeamBattleFrame[];
    unitIds: string[];
    unitNames: Record<string, string>;
  };
  finalSnapshots: Record<string, TeamUnitSnapshot>;
}

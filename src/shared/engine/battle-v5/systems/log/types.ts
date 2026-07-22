// ===== LogEntryType =====
export type LogEntryType =
  | 'damage'
  | 'heal'
  | 'shield'
  | 'mana_shield_absorb'
  | 'buff_apply'
  | 'buff_remove'
  | 'buff_immune'
  | 'damage_immune'
  | 'dodge'
  | 'resist'
  | 'death'
  | 'mana_burn'
  | 'resource_drain'
  | 'dispel'
  | 'tag_trigger'
  | 'death_prevent'
  | 'skill_interrupt'
  | 'cooldown_modify'
  | 'control_skip'
  | 'resource_change'
  | 'action_state'
  | 'mechanic';

export interface LogSourceRef {
  unitId?: string;
  unitName?: string;
  abilityId?: string;
  abilityName?: string;
  buffId?: string;
  buffName?: string;
}

export interface LogCauseRef {
  kind: 'ability' | 'buff' | 'mechanic';
  id: string;
  displayName: string;
}

export interface LogDisplayRef {
  id: string;
  displayName: string;
}

export interface MechanicTriggerBasisRef {
  left: LogDisplayRef;
  relation: LogDisplayRef;
  right: LogDisplayRef;
}

// ===== Entry Data Interfaces =====
export interface DamageEntryData {
  value: number;
  beforeHp: number;
  remainHp: number;
  isCritical: boolean;
  targetName: string;
  sourceBuff?: string;
  damageSource?: 'direct' | 'reflect' | 'counter' | 'follow_up' | 'delayed';
  reflectSourceName?: string;
  shieldAbsorbed?: number;
  remainShield?: number;
  damageType?: 'physical' | 'magical' | 'true' | 'dot';
  sourceUnitId?: string;
  sourceUnitName?: string;
  sourceAbilityId?: string;
  sourceAbilityName?: string;
  source?: LogSourceRef;
  cause?: LogCauseRef;
}

export interface HealEntryData {
  value: number;
  remainHp: number;
  remainMp?: number;
  targetName: string;
  sourceBuff?: string;
  healType?: 'hp' | 'mp';
  source?: LogSourceRef;
}

export interface ShieldEntryData {
  value: number;
  targetName: string;
  remainShield?: number;
  source?: LogSourceRef;
}

export interface ManaShieldAbsorbEntryData {
  targetName: string;
  absorbedDamage: number;
  mpConsumed: number;
  remainDamage: number;
}

export interface BuffApplyEntryData {
  buffName: string;
  buffType: 'buff' | 'debuff' | 'control';
  targetName: string;
  layers?: number;
  duration: number;
  durationUnit?: 'owner_action' | 'round';
  visibility?: 'player' | 'debug';
  source?: LogSourceRef;
}

export interface BuffRemoveEntryData {
  buffName: string;
  targetName: string;
  reason: 'manual' | 'expired' | 'dispel' | 'replace';
}

export interface BuffImmuneEntryData {
  buffName: string;
  targetName: string;
  immuneTag?: string;
}

export interface DamageImmuneEntryData {
  targetName: string;
  blockedDamage: number;
  matchedTag: string;
}

export interface DodgeEntryData {
  targetName: string;
}

export interface ResistEntryData {
  targetName: string;
}

export interface DeathEntryData {
  targetName: string;
  killerName?: string;
}

export interface ManaBurnEntryData {
  value: number;
  targetName: string;
  source?: LogSourceRef;
}

export interface ResourceDrainEntryData {
  value: number;
  drainType: 'hp' | 'mp';
  targetName: string;
  source?: LogSourceRef;
}

export interface DispelEntryData {
  buffs: string[];
  targetName: string;
}

export interface TagTriggerEntryData {
  tag: string;
  displayName?: string;
  targetName: string;
}

export interface DeathPreventEntryData {
  targetName: string;
  sourceKey?: string;
  sourceName?: string;
}

export interface SkillInterruptEntryData {
  skillName: string;
  targetName: string;
  reason: string;
}

export interface CooldownModifyEntryData {
  value: number;
  affectedSkillName: string;
  targetName: string;
}

export interface ControlSkipEntryData {
  unitName: string;
  /** 触发跳过的 GameplayTag 路径，如 'Status.Control.NoAction' / 'Status.Stunned' */
  controlTag: string;
}

export interface MechanicEntryData {
  mechanic:
    | 'memory_record'
    | 'memory_release'
    | 'ability_transform'
    | 'damage_defer'
    | 'hp_sacrifice'
    | 'buff_layer'
    | 'combat_resource'
    | 'status_spread'
    | 'named_trigger'
    | 'status_transition';
  targetName: string;
  sourceName?: string;
  name: string;
  displayName?: string;
  internalKey?: string;
  value?: number;
  detail?: string;
  operation?: 'apply' | 'refresh' | 'replace' | 'consume';
  previousDisplayName?: string;
  triggerBasis?: MechanicTriggerBasisRef;
  visibility?: 'player' | 'debug';
  source?: LogSourceRef;
}

export interface ResourceChangeEntryData {
  targetName: string;
  resourceId: string;
  resourceName: string;
  resourceMax: number;
  operation: 'add' | 'subtract' | 'set' | 'consume_all' | 'decay';
  reason?: 'gain' | 'spend' | 'refund' | 'decay';
  requested: number;
  applied: number;
  overflow: number;
  before: number;
  after: number;
  sourceAbilityId?: string;
  sourceAbilityName?: string;
  isInitial?: boolean;
  source?: LogSourceRef;
}

export interface ActionStateEntryData {
  unitName: string;
  stateType: 'rest' | 'queued_action' | 'ability_mode';
  phase: 'entered' | 'triggered' | 'cancelled' | 'skipped';
  name: string;
  remainingActions: number;
  sourceAbilityName?: string;
  abilityName?: string;
  reason?: string;
}

// ===== EntryDataMap =====
export interface EntryDataMap {
  damage: DamageEntryData;
  heal: HealEntryData;
  shield: ShieldEntryData;
  mana_shield_absorb: ManaShieldAbsorbEntryData;
  buff_apply: BuffApplyEntryData;
  buff_remove: BuffRemoveEntryData;
  buff_immune: BuffImmuneEntryData;
  damage_immune: DamageImmuneEntryData;
  dodge: DodgeEntryData;
  resist: ResistEntryData;
  death: DeathEntryData;
  mana_burn: ManaBurnEntryData;
  resource_drain: ResourceDrainEntryData;
  dispel: DispelEntryData;
  tag_trigger: TagTriggerEntryData;
  death_prevent: DeathPreventEntryData;
  skill_interrupt: SkillInterruptEntryData;
  cooldown_modify: CooldownModifyEntryData;
  control_skip: ControlSkipEntryData;
  resource_change: ResourceChangeEntryData;
  action_state: ActionStateEntryData;
  mechanic: MechanicEntryData;
}

export type PresentedLogPartKind =
  | 'text'
  | 'unit'
  | 'ability'
  | 'number'
  | 'resource'
  | 'buff'
  | 'critical'
  | 'status';

export interface PresentedLogPart {
  kind: PresentedLogPartKind;
  text: string;
}

export interface PresentedLogLine {
  role?:
    | 'header'
    | 'primary'
    | 'trigger'
    | 'secondary'
    | 'resource'
    | 'state'
    | 'system';
  parts: PresentedLogPart[];
}

// ===== LogEntry =====
export interface LogEntry<T extends LogEntryType = LogEntryType> {
  id: string;
  type: T;
  data: EntryDataMap[T];
  timestamp: number;
}

// ===== LogSpanType =====
export type LogSpanType =
  | 'action'
  | 'action_pre'
  | 'action_after'
  | 'round_start'
  | 'battle_init'
  | 'battle_end';

// ===== LogSpan =====
export interface LogSpan {
  id: string;
  type: LogSpanType;
  turn: number;
  actor?: { id: string; name: string };
  ability?: { id: string; name: string };
  entries: LogEntry[];
  timestamp: number;
}

// ===== 辅助类型 =====
export interface CombatLogSummary {
  totalDamage: number;
  totalHeal: number;
  criticalCount: number;
  deaths: string[];
  turns: number;
}

export interface CombatLogAIView {
  spans: Array<{
    turn: number;
    type: LogSpanType;
    actor?: { id: string; name: string };
    ability?: { id: string; name: string };
    entries: Array<{ type: LogEntryType; data: unknown }>;
    description: string[];
  }>;
  summary: CombatLogSummary;
}

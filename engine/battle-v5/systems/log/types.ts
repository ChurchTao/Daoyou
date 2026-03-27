// ===== LogEntryType =====
export type LogEntryType =
  | 'damage'
  | 'heal'
  | 'shield'
  | 'buff_apply'
  | 'buff_remove'
  | 'buff_immune'
  | 'dodge'
  | 'resist'
  | 'death'
  | 'mana_burn'
  | 'resource_drain'
  | 'dispel'
  | 'tag_trigger'
  | 'death_prevent'
  | 'skill_interrupt'
  | 'cooldown_modify';

// ===== Entry Data Interfaces =====
export interface DamageEntryData {
  value: number;
  remainHp: number;
  isCritical: boolean;
  targetName: string;
  sourceBuff?: string;
  damageSource?: 'direct' | 'reflect';
  reflectSourceName?: string;
  shieldAbsorbed?: number;
  remainShield?: number;
}

export interface HealEntryData {
  value: number;
  remainHp: number;
  targetName: string;
  sourceBuff?: string;
}

export interface ShieldEntryData {
  value: number;
  targetName: string;
}

export interface BuffApplyEntryData {
  buffName: string;
  buffType: 'buff' | 'debuff' | 'control';
  targetName: string;
  layers?: number;
  duration: number;
}

export interface BuffRemoveEntryData {
  buffName: string;
  targetName: string;
  reason: 'manual' | 'expired' | 'dispel' | 'replace';
}

export interface BuffImmuneEntryData {
  buffName: string;
  targetName: string;
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
}

export interface ResourceDrainEntryData {
  value: number;
  drainType: 'hp' | 'mp';
  targetName: string;
}

export interface DispelEntryData {
  buffs: string[];
  targetName: string;
}

export interface TagTriggerEntryData {
  tag: string;
  targetName: string;
}

export interface DeathPreventEntryData {
  targetName: string;
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

// ===== EntryDataMap =====
export interface EntryDataMap {
  damage: DamageEntryData;
  heal: HealEntryData;
  shield: ShieldEntryData;
  buff_apply: BuffApplyEntryData;
  buff_remove: BuffRemoveEntryData;
  buff_immune: BuffImmuneEntryData;
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
    description: string;
  }>;
  summary: CombatLogSummary;
}

// ===== 兼容旧 API (将被移除) =====
/**
 * @deprecated 使用新的 LogSpan 和 LogEntry
 */
export interface CombatLogResult {
  battleId: string;
  spans: LogSpan[];
  fullText: string;
  metadata: {
    winner: string;
    loser: string;
    turns: number;
    duration: number;
  };
}

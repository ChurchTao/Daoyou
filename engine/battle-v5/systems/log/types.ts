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
  | 'reflect'
  | 'tag_trigger'
  | 'death_prevent'
  | 'skill_cast'
  | 'skill_interrupt'
  | 'cooldown_modify';

/**
 * 日志条目结构（对应单个事件）
 */
export interface LogEntry {
  id: string;
  type: LogEntryType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  message: string;
  highlight: boolean;
}

export type LogSpanType =
  | 'action'
  | 'action_pre'
  | 'round_start'
  | 'battle_init'
  | 'battle_end';

/**
 * 日志事务单元（Span）
 */
export interface LogSpan {
  id: string;
  type: LogSpanType;
  turn: number;
  source?: { id: string; name: string };
  title: string;
  entries: LogEntry[];
  summary?: string;
  timestamp: number;
}

/**
 * 完整日志输出结果
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

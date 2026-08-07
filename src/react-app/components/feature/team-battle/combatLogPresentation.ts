import type { TeamBattleLogEvent } from '@shared/engine/battle-team';

export interface LogLine {
  seq: number;
  text: string;
  color: string;
  bold?: boolean;
}

/**
 * 将战斗事件映射为显示文本和颜色。
 * 使用项目的墨色战报色系（text-crimson / text-teal / text-wood 等）。
 */
export function presentLogEvent(event: TeamBattleLogEvent): LogLine {
  const base = { seq: event.seq };

  switch (event.kind) {
    case 'battle_start':
      return { ...base, text: event.text, color: 'text-ink', bold: true };
    case 'round_start':
      return { ...base, text: event.text, color: 'text-ink-secondary', bold: true };
    case 'action':
      return { ...base, text: event.text, color: 'text-ink' };
    case 'damage':
      return {
        ...base,
        text: event.text,
        color: 'text-crimson',
        bold: event.critical,
      };
    case 'dodge':
      return { ...base, text: event.text, color: 'text-teal' };
    case 'heal':
      return { ...base, text: event.text, color: 'text-teal' };
    case 'aura_apply':
      return { ...base, text: event.text, color: 'text-wood' };
    case 'aura_remove':
      return { ...base, text: event.text, color: 'text-ink-secondary' };
    case 'chance_trigger':
      return { ...base, text: event.text, color: 'text-wood', bold: true };
    case 'charge':
      return {
        ...base,
        text: event.text,
        color: event.phase === 'release' ? 'text-crimson' : 'text-gold',
        bold: true,
      };
    case 'counter':
      return { ...base, text: event.text, color: 'text-wood', bold: true };
    case 'death':
      return { ...base, text: event.text, color: 'text-ink-secondary', bold: true };
    case 'battle_end':
      return { ...base, text: event.text, color: 'text-crimson', bold: true };
    default:
      return { ...base, text: '未知事件', color: 'text-ink-secondary' };
  }
}

import type { MysteryLogEntry } from '@daoyou/game-domain/dungeon/mystery';

/** 调查日志的一行：线索、物品、对话、突发、预兆与提示各有标记。 */
export function MysteryLogLine({ entry }: { entry: MysteryLogEntry }) {
  if (entry.kind === 'clue' || entry.kind === 'item') {
    return (
      <p className="border-crimson/40 bg-crimson/5 border-l-2 px-3 py-2 text-sm leading-7">
        <span className="text-crimson mr-2 font-semibold">
          {entry.kind === 'clue' ? '获得线索' : '获得物品'}
        </span>
        {entry.text}
        <span className="text-ink-secondary ml-1">（已记入案情板）</span>
      </p>
    );
  }
  if (entry.kind === 'speech') {
    return (
      <p className="leading-8">
        <span className="text-ink font-semibold">{entry.speaker}：</span>
        {entry.text}
      </p>
    );
  }
  if (entry.kind === 'hint') {
    return (
      <p className="border-wood/50 bg-wood/5 border-l-2 px-3 py-2 text-sm leading-7">
        <span className="text-wood mr-2 font-semibold">提示</span>
        {entry.text}
      </p>
    );
  }
  if (entry.kind === 'event') {
    return (
      <p className="border-ink/40 bg-ink/5 border-l-2 px-3 py-2 text-sm leading-7">
        <span className="text-ink mr-2 font-semibold">突发</span>
        {entry.text}
      </p>
    );
  }
  if (entry.kind === 'omen') {
    return (
      <p className="text-crimson/90 text-sm leading-7">
        <span className="mr-2 font-semibold">预兆</span>
        {entry.text}
      </p>
    );
  }
  if (entry.kind === 'system') {
    return <p className="text-ink-secondary text-sm leading-7">{entry.text}</p>;
  }
  return <p className="text-ink leading-8">{entry.text}</p>;
}

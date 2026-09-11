import type { CombatV6HistoryItem } from '@shared/contracts/combatV6Replay';
import { Link } from 'react-router';

import { combatV6HistorySources } from './presentation';
const outcomes = {
  victory: '胜利',
  defeat: '落败',
  draw: '平局',
  aborted: '已结束',
};

export function CombatV6HistoryList({
  items,
}: {
  items: CombatV6HistoryItem[];
}) {
  return (
    <ul className="divide-ink/10 divide-y">
      {items.map((record) => (
        <li key={record.battleId}>
          <Link
            className="hover:bg-ink/5 focus-visible:outline-ink block space-y-2 py-4"
            to={`/game/battle/${record.battleId}`}
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>
                {combatV6HistorySources[
                  record.sourceType as keyof typeof combatV6HistorySources
                ] ?? '战斗'}
              </span>
              <strong
                className={
                  record.outcome === 'victory'
                    ? 'text-cinnabar'
                    : 'text-ink-secondary'
                }
              >
                {outcomes[record.outcome]}
              </strong>
            </div>
            <p className="text-sm leading-6 break-words">
              {record.sides[0].join('、') || '我方'}{' '}
              <span className="text-ink-secondary">对阵</span>{' '}
              {record.sides[1].join('、') || '敌方'}
            </p>
            <div className="text-ink-secondary flex flex-wrap justify-between gap-2 text-xs">
              <time dateTime={record.finishedAt}>
                {new Date(record.finishedAt).toLocaleString('zh-CN', {
                  hour12: false,
                })}
              </time>
              <span>
                {record.roundCount} 回合 ·{' '}
                查看回放 →
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

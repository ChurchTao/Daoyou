import type { CombatV6HistoryItem } from '@shared/contracts/combatV6Replay';
import { cn } from '@shared/lib/cn';
import { Link } from 'react-router';

import { combatV6HistorySources } from './presentation';

const outcomes = {
  victory: '胜利',
  defeat: '落败',
  draw: '平局',
  aborted: '中止',
};
const historyDate = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const historyTime = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function CombatV6HistoryList({
  items,
  compact = false,
}: {
  items: CombatV6HistoryItem[];
  compact?: boolean;
}) {
  return (
    <ul className="divide-ink/10 divide-y">
      {items.map((record) => {
        const finishedAt = new Date(record.finishedAt);
        const source =
          combatV6HistorySources[
            record.sourceType as keyof typeof combatV6HistorySources
          ] ?? '战斗';
        return (
          <li key={record.battleId}>
            <Link
              className={cn(
                'group hover:bg-ink/4 focus-visible:outline-crimson block min-w-0 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
                compact ? 'py-3' : 'px-1 py-5 sm:px-3',
              )}
              to={`/game/battle/${record.battleId}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3 text-sm">
                  <span
                    className={cn(
                      'shrink-0 px-2 py-0.5 text-xs font-semibold',
                      record.outcome === 'victory'
                        ? 'bg-crimson/8 text-crimson'
                        : 'bg-ink/5 text-ink-secondary',
                    )}
                  >
                    {outcomes[record.outcome]}
                  </span>
                  <span className="text-ink-secondary">{source}</span>
                </div>
                {!compact ? (
                  <span className="text-ink-secondary shrink-0 text-xs">
                    <span className="font-mono">{record.roundCount}</span> 回合
                  </span>
                ) : null}
              </div>

              {compact ? (
                <p className="mt-2 text-sm leading-6 break-words">
                  <span className="text-ink-secondary mr-2 text-xs">对阵</span>
                  {record.sides[1].join('、') || '敌方'}
                </p>
              ) : (
                <div className="mt-4 grid min-w-0 gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start sm:gap-5">
                  <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-2 sm:block">
                    <div className="text-ink-secondary text-xs leading-6">
                      我方
                    </div>
                    <p className="leading-6 break-words">
                      {record.sides[0].join('、') || '我方'}
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="text-ink/30 hidden pt-6 text-xs sm:block"
                  >
                    对阵
                  </span>
                  <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-2 sm:block">
                    <div className="text-ink-secondary text-xs leading-6">
                      敌方
                    </div>
                    <p className="leading-6 break-words">
                      {record.sides[1].join('、') || '敌方'}
                    </p>
                  </div>
                </div>
              )}

              <div className="text-ink-secondary mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                <time dateTime={record.finishedAt} className="font-mono">
                  {historyDate.format(finishedAt)}{' '}
                  {historyTime.format(finishedAt)}
                </time>
                {compact ? (
                  <span>
                    <span className="font-mono">{record.roundCount}</span> 回合{' '}
                    <span aria-hidden="true">→</span>
                  </span>
                ) : (
                  <span className="group-hover:text-crimson">
                    查看回放 <span aria-hidden="true">→</span>
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

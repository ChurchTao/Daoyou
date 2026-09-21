import { manualRule } from '@shared/engine/combat-v6/manuals/content';
import type { CharacterManualDefV1 } from '@shared/engine/combat-v6/manuals/types';
import { Fragment } from 'react';

export function ManualProgress({
  manual,
  level,
  unlockedLevel,
  compact = false,
}: {
  manual: CharacterManualDefV1;
  level: number;
  unlockedLevel: number;
  compact?: boolean;
}) {
  const rule = manualRule(manual);
  return (
    <div
      aria-label={`已参悟${level}层，共${rule.maxLevel}层，已开放至${unlockedLevel}层`}
      className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}
    >
      {Array.from({ length: rule.maxLevel }, (_, i) => {
        const n = i + 1;
        return (
          <Fragment key={n}>
            {rule.bottlenecks.includes(i) ? (
              <span
                aria-hidden="true"
                className={`shrink-0 ${compact ? 'border-ink/20 h-2 border-l' : 'text-ink-secondary text-xs'}`}
              >
                {compact ? null : unlockedLevel <= i ? '锁' : '·'}
              </span>
            ) : null}
            <span
              aria-hidden="true"
              className={`${compact ? 'h-1 w-1 shrink-0' : 'flex h-7 min-w-0 flex-1 items-center justify-center font-mono text-xs'} rounded-sm border transition-colors duration-500 motion-reduce:transition-none ${n === level ? 'border-crimson bg-crimson text-paper' : n < level ? 'border-ink/70 bg-ink/70 text-paper' : n <= unlockedLevel ? 'border-ink/25 text-ink-secondary' : 'border-ink/10 text-ink/25'}`}
            >
              {compact ? null : n}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

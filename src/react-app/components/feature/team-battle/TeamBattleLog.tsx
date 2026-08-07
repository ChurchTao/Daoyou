import { useEffect, useRef } from 'react';
import type { TeamBattleRecord } from '@shared/engine/battle-team';
import { presentLogEvent } from './combatLogPresentation';

interface TeamBattleLogProps {
  record: TeamBattleRecord;
  currentSeq: number;
}

export function TeamBattleLog({ record, currentSeq }: TeamBattleLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const lines = record.events.map(presentLogEvent);
  const visibleLines = lines.filter((l) => l.seq <= currentSeq);

  // 自动滚动到当前行
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentSeq]);

  return (
    <div
      ref={containerRef}
      className="battle-scroll border-ink/15 border-dashed border bg-bgpaper/50 h-64 overflow-y-auto p-3"
    >
      <div className="space-y-0.5 font-mono text-xs">
        {visibleLines.map((line) => (
          <div
            key={line.seq}
            ref={line.seq === currentSeq ? activeRef : undefined}
            className={[
              'px-1.5 py-0.5',
              line.seq === currentSeq ? 'bg-ink/5' : '',
              line.color,
              line.bold ? 'font-semibold' : '',
            ].join(' ')}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

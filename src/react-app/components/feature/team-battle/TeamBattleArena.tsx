import type { TeamBattleFrame, TeamBattleRecord } from '@shared/engine/battle-team';
import { TeamUnitCard } from './TeamUnitCard';

interface TeamBattleArenaProps {
  record: TeamBattleRecord;
  frame: TeamBattleFrame | null;
  currentEventSeq: number;
}

/** 单队超过 2 人时启用紧凑模式（5v5 等） */
function shouldUseCompact(teamSize: number): boolean {
  return teamSize > 2;
}

export function TeamBattleArena({ record, frame, currentEventSeq }: TeamBattleArenaProps) {
  const teamA = record.participants.teamA;
  const teamB = record.participants.teamB;
  const compact = shouldUseCompact(Math.max(teamA.length, teamB.length));

  // 当前出手者
  const currentEvent = record.events.find((e) => e.seq === currentEventSeq);
  const actingUnitId =
    currentEvent && 'actorId' in currentEvent ? currentEvent.actorId : null;

  const renderUnit = (id: string) => {
    const snapshot = frame?.units[id];
    if (!snapshot) return null;
    return (
      <TeamUnitCard
        key={id}
        unit={snapshot}
        isActing={actingUnitId === id}
        compact={compact}
      />
    );
  };

  const renderTeamColumn = (side: 'A' | 'B', participants: typeof teamA) => {
    const front = participants.filter((p) => p.position === 'front');
    const back = participants.filter((p) => p.position === 'back');
    const rowGap = compact ? 'gap-1.5' : 'gap-3';
    const colGap = compact ? 'gap-1.5' : 'gap-3';

    return (
      <div className={`flex flex-col ${colGap} ${side === 'B' ? 'items-start' : 'items-end'}`}>
        {/* 后排在外侧 */}
        <div className={`flex ${rowGap} flex-wrap justify-center`}>
          {back.map((p) => renderUnit(p.id))}
        </div>
        {/* 前排在内侧（靠近中间） */}
        <div className={`flex ${rowGap} flex-wrap justify-center`}>
          {front.map((p) => renderUnit(p.id))}
        </div>
      </div>
    );
  };

  return (
    <div className="border-ink/15 border-dashed border bg-bgpaper/50 overflow-x-auto p-6">
      <div className="flex min-w-fit items-center justify-center gap-4">
        {renderTeamColumn('A', teamA)}

        {/* 中间 VS 标识 */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-ink-secondary/50 font-heading text-2xl">对</span>
          {frame && (
            <span className="text-ink-secondary text-xs">第 {frame.round} 回合</span>
          )}
        </div>

        {renderTeamColumn('B', teamB)}
      </div>
    </div>
  );
}

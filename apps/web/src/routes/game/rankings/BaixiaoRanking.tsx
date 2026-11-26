import { BaixiaoScorecard } from '@app/components/feature/baixiao/BaixiaoScorecard';
import { baixiaoTime } from '@app/components/feature/baixiao/time';
import {
  activityDate,
  weeklyBoardStatus,
} from '@app/components/feature/weekly-activity/schedule';
import { useWeeklyRanking } from '@app/components/feature/weekly-activity/useWeeklyRanking';
import {
  WeeklyBoardPending,
  WeeklyBoardPeriod,
  WeeklyLeaderboard,
} from '@app/components/feature/weekly-activity/WeeklyLeaderboard';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  BaixiaoRankingRow,
  BaixiaoRanking as Ranking,
} from '@daoyou/contracts/baixiao/meet';
import { useState } from 'react';

export function BaixiaoRanking() {
  const player = usePlayerSession();
  const {
    data: ranking,
    previous,
    error,
    retry,
    changePeriod,
  } = useWeeklyRanking<Ranking>('/api/baixiao-meet/ranking', '才子榜');
  const [selection, setSelection] = useState<{
    week: string;
    row: BaixiaoRankingRow;
  } | null>(null);
  const switcher = (
    <WeeklyBoardPeriod
      previous={previous}
      onChange={(value) => {
        setSelection(null);
        changePeriod(value);
      }}
    />
  );

  if (!ranking || error)
    return (
      <>
        {switcher}
        <WeeklyBoardPending name="才子榜" error={error} onRetry={retry} />
      </>
    );

  const { period } = ranking;
  const state = weeklyBoardStatus(period.state, period.closesAt);
  const selected = selection?.week === period.week ? selection?.row : null;
  return (
    <>
      {switcher}
      <WeeklyLeaderboard
        name="才子榜"
        date={activityDate(period.week)}
        place="大晋 · 晋京"
        period={state.label}
        status={state.note}
        emptyTitle="该期无人上榜"
        emptyNote="该期尚无通关成绩。"
        emblem="icon:baixiao-pass"
        href="/game/baixiao-meet"
        action="前往百晓盛会"
        entries={ranking.rows.map((entry) => ({
          ...entry,
          id: entry.cultivatorId,
          score: baixiaoTime(entry.score.totalMs),
          self: player.data?.activeCultivator?.id === entry.cultivatorId,
        }))}
        mine={{
          rank: ranking.mine?.rank ?? null,
          score: ranking.mine
            ? baixiaoTime(ranking.mine.score.totalMs)
            : undefined,
        }}
        onSelect={(id) => {
          const row = ranking.rows.find((entry) => entry.cultivatorId === id);
          if (row) setSelection({ week: period.week, row });
        }}
      />
      {selected && (
        <InkDetailDrawer
          isOpen
          title="成绩明细"
          description={
            <span>
              {selected.name}
              {selected.title && ` · ${selected.title}`} · 第{' '}
              <b className="font-mono">{selected.rank}</b> 名
            </span>
          }
          closeLabel="返回榜单"
          size="md"
          onClose={() => setSelection(null)}
        >
          <BaixiaoScorecard score={selected.score} />
          <p className="text-ink-secondary mt-5 text-sm">
            总用时按十分之一秒比较。同用时答对多者在前，答对数也相同则并列。
          </p>
        </InkDetailDrawer>
      )}
    </>
  );
}

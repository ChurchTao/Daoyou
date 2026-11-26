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
import type {
  ContestRanking,
  ContestRankingEntry,
} from '@daoyou/contracts/alchemy/contest';
import { useState } from 'react';
import './alchemy-ranking.css';
import { AlchemyScoreDetail } from './AlchemyScoreDetail';

export function AlchemyContestRanking() {
  const {
    data: board,
    previous,
    error,
    retry,
    changePeriod,
  } = useWeeklyRanking<ContestRanking>(
    '/api/alchemy-contest/ranking',
    '炼丹榜',
  );
  const [selection, setSelection] = useState<{
    week: string;
    entry: ContestRankingEntry;
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

  if (!board || error)
    return (
      <>
        {switcher}
        <WeeklyBoardPending name="炼丹榜" error={error} onRetry={retry} />
      </>
    );

  const { period, entries, own } = board;
  const selected = selection?.week === period.week ? selection?.entry : null;
  const state = weeklyBoardStatus(period.state, period.closesAt);
  return (
    <>
      {switcher}
      <WeeklyLeaderboard
        name="炼丹榜"
        date={activityDate(period.week)}
        place="乱星海 · 丹塔"
        period={state.label}
        subject={
          board.title === board.pillName
            ? (board.title ?? undefined)
            : [board.title, board.pillName].filter(Boolean).join(' · ')
        }
        status={state.note}
        emptyTitle="该期无人上榜"
        emptyNote="该期尚无达标丹药。"
        emblem="icon:xuanfire-furnace"
        href="/game/alchemy-contest"
        action="前往丹塔"
        entries={entries.map((entry) => ({
          ...entry,
          realm: entry.realm ? entry.realm + (entry.realmStage ?? '') : null,
          score: String(entry.score),
          unit: '分',
          extra:
            entry.rank <= 3 && entry.reputation !== null ? (
              <>
                声望 <b className="font-mono">+{entry.reputation}</b>
              </>
            ) : undefined,
          self: own?.id === entry.id,
        }))}
        mine={{
          rank: own?.rank ?? null,
          score: own ? `${own.score} 分` : undefined,
        }}
        onSelect={(id) => {
          const entry = entries.find((row) => row.id === id);
          if (entry) setSelection({ week: period.week, entry });
        }}
      />
      {selected && (
        <AlchemyScoreDetail
          key={`${period.week}:${selected.id}`}
          week={period.week}
          entry={selected}
          onClose={() => setSelection(null)}
        />
      )}
    </>
  );
}

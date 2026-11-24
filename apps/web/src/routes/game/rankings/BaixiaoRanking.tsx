import { BaixiaoScorecard } from '@app/components/feature/baixiao/BaixiaoScorecard';
import { baixiaoTime } from '@app/components/feature/baixiao/time';
import {
  activityDate,
  activityState,
} from '@app/components/feature/weekly-activity/schedule';
import {
  WeeklyBoardPending,
  WeeklyLeaderboard,
} from '@app/components/feature/weekly-activity/WeeklyLeaderboard';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { requestBaixiao } from '@app/lib/api/baixiao';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  BaixiaoRankingRow,
  BaixiaoStatus,
  BaixiaoRanking as Ranking,
} from '@daoyou/contracts/baixiao/meet';
import { baixiaoWeek } from '@daoyou/game-rules/baixiao/meet';
import { useEffect, useState } from 'react';

function weekSchedule(week: string) {
  return baixiaoWeek(Date.parse(`${week}T00:00:00+08:00`));
}

export function BaixiaoRanking() {
  const player = usePlayerSession();
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [session, setSession] = useState<BaixiaoStatus['session']>(null);
  const [selected, setSelected] = useState<BaixiaoRankingRow | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    const init = { signal: request.signal };
    void requestBaixiao<Ranking>('/api/baixiao-meet/ranking', init)
      .then((result) => {
        if (!request.signal.aborted) setRanking(result);
      })
      .catch(() => {
        if (!request.signal.aborted) setError('才子榜暂时无法读取。');
      });
    void requestBaixiao<BaixiaoStatus>('/api/baixiao-meet', init)
      .then((result) => {
        if (!request.signal.aborted) setSession(result.session);
      })
      .catch(() => {
        if (!request.signal.aborted) setSession(null);
      });
    return () => request.abort();
  }, [reload]);

  if (!ranking || error)
    return (
      <WeeklyBoardPending
        name="才子榜"
        error={error}
        onRetry={() => {
          setError('');
          setReload((v) => v + 1);
        }}
      />
    );

  const clock = weekSchedule(ranking.week);
  const date = weekSchedule(ranking.publishedWeek ?? ranking.week).opensAt;
  const state = activityState(
    ranking.phase,
    clock.opensAt,
    clock.lastStartAt,
    clock.closesAt,
  );
  const previous =
    ranking.publishedWeek && ranking.publishedWeek !== ranking.week;
  return (
    <>
      <WeeklyLeaderboard
        name="才子榜"
        date={activityDate(date)}
        place="大晋 · 晋京"
        period={previous ? '已封榜' : '本期'}
        status={
          ranking.phase === 'open' ? '本期进行中。封榜后公布名次。' : state.note
        }
        emptyTitle={ranking.publishedWeek ? '该期无人上榜' : '首期成绩尚未公布'}
        emptyNote={ranking.publishedWeek ? '该期没有道友通关。' : undefined}
        emblem="icon:baixiao-pass"
        href="/game/baixiao-meet"
        action={
          session
            ? session.finished
              ? '本场成绩'
              : '继续参赛'
            : '前往百晓盛会'
        }
        entries={ranking.rows.map((entry) => ({
          ...entry,
          id: entry.cultivatorId,
          score: baixiaoTime(entry.score.totalMs),
          self: player.data?.activeCultivator?.id === entry.cultivatorId,
        }))}
        mine={
          ranking.publishedWeek
            ? {
                rank: ranking.mine?.rank ?? null,
                score: ranking.mine
                  ? baixiaoTime(ranking.mine.score.totalMs)
                  : undefined,
              }
            : undefined
        }
        onSelect={(id) =>
          setSelected(
            ranking.rows.find((row) => row.cultivatorId === id) ?? null,
          )
        }
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
          onClose={() => setSelected(null)}
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

import {
  activityDate,
  activityState,
} from '@app/components/feature/weekly-activity/schedule';
import {
  WeeklyBoardPending,
  WeeklyLeaderboard,
} from '@app/components/feature/weekly-activity/WeeklyLeaderboard';
import { apiFetch } from '@app/lib/api/fetch';
import type {
  ContestRanking,
  ContestRankingEntry,
} from '@daoyou/contracts/alchemy/contest';
import { useEffect, useState } from 'react';
import './alchemy-ranking.css';
import { AlchemyScoreDetail } from './AlchemyScoreDetail';

export function AlchemyContestRanking() {
  const [board, setBoard] = useState<ContestRanking | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selection, setSelection] = useState<{
    week: string;
    entry: ContestRankingEntry;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await apiFetch('/api/alchemy-contest/ranking', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('炼丹榜暂时无法读取。');
        const fresh = (await response.json()) as ContestRanking;
        if (!controller.signal.aborted) setBoard(fresh);
      } catch {
        if (!controller.signal.aborted) setError('炼丹榜暂时无法读取。');
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  if (!board || error)
    return (
      <WeeklyBoardPending
        name="炼丹榜"
        error={error}
        onRetry={() => {
          setError('');
          setReload((v) => v + 1);
        }}
      />
    );

  const published = board.published;
  const entries = published?.entries ?? [];
  const own = board.own;
  const publishedOwn = entries.find((entry) => entry.id === published?.own?.id);
  const selected =
    selection?.week === published?.week ? selection?.entry : null;
  // The ranking omits lastStartAt. It describes the close, rather than admission.
  const state = activityState(
    board.phase,
    board.opensAt,
    board.closesAt,
    board.closesAt,
  );
  const differentPeriod = published !== null && published.week !== board.week;
  return (
    <>
      <WeeklyLeaderboard
        name="炼丹榜"
        date={activityDate(published?.opensAt ?? board.opensAt)}
        place="乱星海 · 丹塔"
        period={differentPeriod ? '已封榜' : '本期'}
        subject={
          published
            ? published.title === published.pillName
              ? published.title
              : `${published.title} · ${published.pillName}`
            : undefined
        }
        status={
          board.phase === 'open' ? '本期进行中。封榜后公布名次。' : state.note
        }
        emptyTitle={published ? '该期无人上榜' : '首期成绩尚未公布'}
        emptyNote={published ? '该期没有丹药满足炼制要求。' : undefined}
        emblem="icon:xuanfire-furnace"
        href="/game/alchemy-contest"
        action={
          !own || own.otherCharacter
            ? '前往丹塔'
            : own.finished
              ? '本场成绩'
              : '继续炼丹'
        }
        entries={entries.map((entry) => ({
          ...entry,
          realm: entry.realm ? entry.realm + (entry.realmStage ?? '') : null,
          score: String(entry.score),
          unit: '分',
          extra:
            entry.rank <= 3 ? (
              <>
                声望 <b className="font-mono">+{entry.reputation}</b>
              </>
            ) : undefined,
          self: published?.own?.id === entry.id,
        }))}
        mine={
          published
            ? {
                rank: published.own?.rank ?? null,
                score: publishedOwn && `${publishedOwn.score} 分`,
              }
            : undefined
        }
        currentResult={
          own && !own.otherCharacter && published?.week !== board.week
            ? own.score === null
              ? '暂无达标成绩'
              : `${own.score} 分`
            : undefined
        }
        onSelect={(id) => {
          const entry = entries.find((row) => row.id === id);
          if (entry && published) setSelection({ week: published.week, entry });
        }}
      />
      {selected && published && (
        <AlchemyScoreDetail
          key={`${published.week}:${selected.id}`}
          week={published.week}
          entry={selected}
          onClose={() => setSelection(null)}
        />
      )}
    </>
  );
}

import { BaixiaoScorecard } from '@app/components/feature/baixiao/BaixiaoScorecard';
import { baixiaoTime } from '@app/components/feature/baixiao/time';
import { GameLoadingState } from '@app/components/game-shell';
import { InkModal } from '@app/components/layout/InkModal';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkNotice } from '@app/components/ui/InkNotice';
import { requestBaixiao } from '@app/lib/api/baixiao';
import type {
  BaixiaoRankingRow,
  BaixiaoRanking as Ranking,
} from '@daoyou/contracts/baixiao/meet';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

export function BaixiaoRanking() {
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [selected, setSelected] = useState<BaixiaoRankingRow | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const request = new AbortController();
    void requestBaixiao<Ranking>('/api/baixiao-meet/ranking', {
      signal: request.signal,
    })
      .then((result) => {
        if (!request.signal.aborted) setRanking(result);
      })
      .catch((cause: unknown) => {
        if (!request.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : '暂时无法查看才子榜。',
          );
      });
    return () => request.abort();
  }, []);
  if (error) return <InkNotice>{error}</InkNotice>;
  if (!ranking)
    return <GameLoadingState variant="inline" message="正在展卷…" />;

  const heading =
    !ranking.publishedWeek || ranking.publishedWeek === ranking.week
      ? '才子榜'
      : '上期才子榜';
  return (
    <section className="space-y-5 py-4">
      <div className="border-ink/20 flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="text-3xl font-semibold tracking-wider">{heading}</h2>
          <p className="text-ink-secondary mt-1 text-sm">按通关总用时列席</p>
        </div>
        <Link to="/game/baixiao-meet" className="text-crimson underline">
          百晓盛会
        </Link>
      </div>
      {ranking.mine && (
        <p className="text-sm">
          我的名次 <b className="font-mono">{ranking.mine.rank}</b> ·{' '}
          <b className="font-mono">{baixiaoTime(ranking.mine.score.totalMs)}</b>
        </p>
      )}
      {ranking.rows.length ? (
        <ol className="grid gap-2">
          {ranking.rows.map((entry) => {
            const top = entry.rank === 1;
            return (
              <li key={entry.cultivatorId}>
                <button
                  type="button"
                  className={`border-ink/15 hover:border-crimson focus-visible:outline-crimson grid w-full cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 border px-3 text-left sm:gap-4 sm:px-5 ${top ? 'bg-crimson/6 border-crimson/35 py-4' : 'bg-sheet py-2'}`}
                  aria-haspopup="dialog"
                  onClick={() => setSelected(entry)}
                >
                  <span
                    className={`text-crimson w-8 text-center font-semibold ${top ? 'text-lg' : ''}`}
                  >
                    <span className="font-mono">{entry.rank}</span>
                    {top && <span className="block text-xs">榜首</span>}
                  </span>
                  <GameIcon
                    value={
                      entry.gender === '女'
                        ? 'icon:cultivator-female-avatar'
                        : 'icon:cultivator-male-avatar'
                    }
                    purpose="artwork"
                    className={top ? 'size-12 sm:size-16' : 'size-8 sm:size-10'}
                  />
                  <span className="min-w-0">
                    <strong
                      className={`block break-words ${top ? 'text-lg sm:text-2xl' : 'text-base'}`}
                    >
                      {entry.name}
                    </strong>
                    <span className="text-ink-secondary block text-xs break-words sm:text-sm">
                      {entry.title ? `${entry.title} · ` : ''}
                      {entry.realm}
                    </span>
                  </span>
                  <b
                    className={`font-mono ${top ? 'text-xl sm:text-3xl' : ''}`}
                  >
                    {baixiaoTime(entry.score.totalMs)}
                  </b>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <InkNotice>
          {ranking.publishedWeek
            ? '这一期尚无通关者。'
            : '首期成绩尚未封榜。每周四 14:00 开场。'}
        </InkNotice>
      )}
      <InkModal
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.name} · 成绩明细` : undefined}
      >
        {selected && <BaixiaoScorecard score={selected.score} />}
      </InkModal>
    </section>
  );
}

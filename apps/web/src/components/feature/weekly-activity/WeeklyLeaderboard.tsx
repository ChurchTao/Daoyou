import { GameLoadingState } from '@app/components/game-shell';
import { InkButton, InkNotice, InkSelect } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import type { ReactNode } from 'react';
import './weekly-leaderboard.css';

export type WeeklyRankEntry = {
  id: string;
  rank: number;
  name: string;
  title: string | null;
  realm: string | null;
  gender: string | null;
  score: string;
  unit?: string;
  extra?: ReactNode;
  self?: boolean;
};

export function WeeklyBoardPending({
  name,
  error,
  onRetry,
}: {
  name: string;
  error: string;
  onRetry: () => void;
}) {
  return error ? (
    <InkNotice tone="warning">
      {error}{' '}
      <InkButton variant="secondary" onClick={onRetry}>
        重试
      </InkButton>
    </InkNotice>
  ) : (
    <GameLoadingState variant="inline" message={`正在读取${name}…`} />
  );
}

export function WeeklyBoardPeriod({
  previous,
  onChange,
}: {
  previous: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-3 flex justify-end">
      <InkSelect
        label="榜单期次"
        value={previous ? 'previous' : 'current'}
        onChange={onChange}
      >
        <option value="current">本周</option>
        <option value="previous">上周</option>
      </InkSelect>
    </div>
  );
}

type WeeklyBoardHeaderProps = {
  name: string;
  date: string;
  place: string;
  period: '实时排名' | '结算中' | '已封榜' | '暂无赛况';
  subject?: string;
  href: string;
  action: string;
};

export function WeeklyBoardHeader({
  name,
  date,
  place,
  period,
  subject,
  href,
  action,
}: WeeklyBoardHeaderProps) {
  return (
    <header className="weekly-rank-heading">
      <div>
        <p className="weekly-rank-date">
          {date} · {place} · {period}
        </p>
        <h2>{name}</h2>
        {subject && <p className="weekly-rank-subject">{subject}</p>}
      </div>
      <InkButton variant="secondary" href={href}>
        {action}
      </InkButton>
    </header>
  );
}

export function WeeklyBoardEmpty({
  title,
  note,
  emblem,
}: {
  title: string;
  note?: string;
  emblem: string;
}) {
  return (
    <div className="weekly-rank-wait">
      <GameIcon
        value={emblem}
        purpose="artwork"
        className="weekly-rank-furnace"
      />
      <h3>{title}</h3>
      {note && <p>{note}</p>}
    </div>
  );
}

export function WeeklyLeaderboard({
  status,
  emptyTitle,
  emptyNote,
  emblem,
  entries,
  mine,
  currentResult,
  onSelect,
  ...header
}: WeeklyBoardHeaderProps & {
  status: string;
  emptyTitle: string;
  emptyNote?: string;
  emblem: string;
  entries: WeeklyRankEntry[];
  mine?: { rank: number | null; score?: string };
  currentResult?: string;
  onSelect: (id: string) => void;
}) {
  const champions = entries.filter((entry) => entry.rank === 1);
  const runnersUp = entries.filter(
    (entry) => entry.rank > 1 && entry.rank <= 3,
  );
  const others = entries.filter((entry) => entry.rank > 3);
  const counts = new Map<number, number>();
  for (const { rank } of entries) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  function seat(entry: WeeklyRankEntry) {
    const tied = (counts.get(entry.rank) ?? 0) > 1;
    const placeLabel =
      entry.rank === 1 ? (tied ? '并列榜首' : '榜首') : tied ? '并列' : '';
    return (
      <li key={entry.id}>
        <button
          type="button"
          className="weekly-rank-seat"
          data-place={
            entry.rank === 1 ? 'champion' : entry.rank <= 3 ? 'podium' : 'list'
          }
          data-self={entry.self || undefined}
          aria-haspopup="dialog"
          aria-label={`第 ${entry.rank} 名${placeLabel ? `，${placeLabel}` : ''}，${entry.name}${entry.title ? `，${entry.title}` : ''}，${entry.score}${entry.unit ?? ''}，查看成绩明细`}
          onClick={() => onSelect(entry.id)}
        >
          <span className="weekly-rank-place">
            <b className="font-mono">{entry.rank}</b>
            {placeLabel && <small>{placeLabel}</small>}
          </span>
          <GameIcon
            value={
              entry.gender === '女'
                ? 'icon:cultivator-female-avatar'
                : 'icon:cultivator-male-avatar'
            }
            className="weekly-rank-avatar"
            purpose="artwork"
          />
          <span className="weekly-rank-identity">
            <span className="weekly-rank-name">
              {entry.name}
              {entry.self && <small>本人</small>}
            </span>
            {entry.title && (
              <span className="weekly-rank-title">{entry.title}</span>
            )}
            {entry.realm && (
              <span className="weekly-rank-realm">{entry.realm}</span>
            )}
          </span>
          <span className="weekly-rank-points">
            <span>
              <b className="font-mono">{entry.score}</b>
              {entry.unit && ` ${entry.unit}`}
            </span>
            {entry.extra && <small>{entry.extra}</small>}
          </span>
          <span className="weekly-rank-view" aria-hidden="true">
            {entry.rank === 1 && <span>成绩明细</span>} ›
          </span>
        </button>
      </li>
    );
  }

  return (
    <section className="weekly-rank-board" aria-label={header.name}>
      <WeeklyBoardHeader {...header} />
      <p className="weekly-rank-status">{status}</p>
      {entries.length ? (
        <>
          {champions.length > 0 && (
            <ol className="weekly-rank-champions" aria-label="榜首">
              {champions.map(seat)}
            </ol>
          )}
          {runnersUp.length > 0 && (
            <ol className="weekly-rank-podium" aria-label="第二至第三名">
              {runnersUp.map(seat)}
            </ol>
          )}
        </>
      ) : (
        <WeeklyBoardEmpty title={emptyTitle} note={emptyNote} emblem={emblem} />
      )}
      {mine && (
        <div className="weekly-rank-self">
          <span>我的名次</span>
          {mine.rank === null ? (
            <span>未上榜</span>
          ) : (
            <strong>
              第 <b className="font-mono">{mine.rank}</b> 名
              {mine.score && (
                <>
                  {' '}
                  · <b className="font-mono">{mine.score}</b>
                </>
              )}
            </strong>
          )}
        </div>
      )}
      {currentResult && (
        <div className="weekly-rank-self">
          <span>本场得分</span>
          <strong>{currentResult}</strong>
        </div>
      )}
      {others.length > 0 && (
        <section className="weekly-rank-register" aria-label="其余席位">
          <h3>其余席位</h3>
          <ol>{others.map(seat)}</ol>
        </section>
      )}
    </section>
  );
}

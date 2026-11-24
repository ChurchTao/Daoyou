import { GameLoadingState } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { apiFetch } from '@app/lib/api/fetch';
import type {
  ContestRanking,
  ContestRankingEntry,
} from '@daoyou/contracts/alchemy/contest';
import { useEffect, useState } from 'react';
import { AlchemyScoreDetail } from './AlchemyScoreDetail';
import './alchemy-ranking.css';

const rankingPath = '/api/alchemy-contest/ranking';
const dateLabel = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});
const clockLabel = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function RankIdentity({
  entry,
  self,
}: {
  entry: ContestRankingEntry;
  self: boolean;
}) {
  return (
    <span className="alchemy-rank-identity">
      <span className="alchemy-rank-name">
        {entry.name}
        {self && <small>本人</small>}
      </span>
      {entry.title && <span className="alchemy-rank-title">{entry.title}</span>}
      {entry.realm && (
        <span className="alchemy-rank-realm">
          {entry.realm}
          {entry.realmStage}
        </span>
      )}
    </span>
  );
}

function RankingSeat({
  entry,
  ownId,
  sharedFirst,
  onSelect,
}: {
  entry: ContestRankingEntry;
  ownId?: string;
  sharedFirst: boolean;
  onSelect: (entry: ContestRankingEntry) => void;
}) {
  const self = ownId === entry.id;
  const first = entry.rank === 1;
  const place = first && sharedFirst ? '并列榜首' : `第 ${entry.rank} 名`;
  return (
    <button
      type="button"
      className="alchemy-rank-seat"
      data-place={first ? 'champion' : entry.rank <= 3 ? 'podium' : 'list'}
      data-self={self || undefined}
      aria-haspopup="dialog"
      aria-label={`${place} ${entry.name}${entry.title ? `，${entry.title}` : ''}，${entry.score} 分，查看成绩明细`}
      onClick={() => onSelect(entry)}
    >
      <span className="alchemy-rank-place">
        <span className="font-mono">{entry.rank}</span>
        {first && <small>{sharedFirst ? '并列榜首' : '榜首'}</small>}
      </span>
      {entry.rank <= 3 && (
        <GameIcon
          value={
            entry.gender === '女'
              ? 'icon:cultivator-female-avatar'
              : 'icon:cultivator-male-avatar'
          }
          className="alchemy-rank-avatar"
          purpose="artwork"
        />
      )}
      <RankIdentity entry={entry} self={self} />
      <span className="alchemy-rank-points">
        <span>
          <b className="font-mono">{entry.score}</b> 分
        </span>
        {entry.rank <= 3 && (
          <small>
            声望 <span className="font-mono">+{entry.reputation}</span>
          </small>
        )}
      </span>
      <span className="alchemy-rank-view" aria-hidden="true">
        {first && <span>成绩明细</span>} ›
      </span>
    </button>
  );
}

function rankingState(board: ContestRanking) {
  const close = clockLabel.format(new Date(board.closesAt));
  const opening = new Date(board.opensAt);
  return {
    waiting: [
      '静候开炉',
      `本期 ${dateLabel.format(opening)} ${clockLabel.format(opening)} 开赛（北京时间）。`,
    ],
    open: ['炼丹大会进行中', `本期北京时间 ${close} 结束，封榜后公布名次。`],
    closing: ['炼丹大会进行中', `本期入场已截止，北京时间 ${close} 结束。`],
    closed: ['正在结算排名', '本期结果将在封榜后公布。'],
    unavailable: ['本期仍在筹备', '赛期准备就绪后可前往丹塔参赛。'],
    settled: ['本期无人上榜', '本期没有满足炼制目标的成绩。'],
  }[board.phase];
}

function EmptyRanking({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="alchemy-rank-wait">
      <GameIcon
        value="icon:xuanfire-furnace"
        purpose="artwork"
        className="alchemy-rank-furnace"
      />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function AlchemyContestRanking() {
  const [board, setBoard] = useState<ContestRanking | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [selection, setSelection] = useState<{
    week: string;
    entry: ContestRankingEntry;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await apiFetch(rankingPath, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('炼丹榜暂不可用');
        const fresh = (await response.json()) as ContestRanking;
        if (controller.signal.aborted) return;
        setBoard(fresh);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  if (failed) {
    return (
      <InkNotice tone="warning">
        炼丹榜暂时无法读取。
        <InkButton
          variant="secondary"
          onClick={() => {
            setFailed(false);
            setReload((count) => count + 1);
          }}
        >
          重试
        </InkButton>
      </InkNotice>
    );
  }
  if (!board)
    return <GameLoadingState variant="inline" message="正在读取炼丹榜…" />;

  const published = board.published;
  const entries = published?.entries ?? [];
  const champions = entries.filter(({ rank }) => rank === 1);
  const podium = entries.filter(({ rank }) => rank > 1 && rank <= 3);
  const others = entries.filter(({ rank }) => rank > 3);
  const own = board.own;
  const rankedSelf = published?.own;
  const ownOnPodium = entries.some(
    ({ id, rank }) => id === rankedSelf?.id && rank <= 3,
  );
  const selected =
    selection?.week === published?.week ? selection?.entry : null;
  const [stateTitle, phaseText] = rankingState(board);
  const showingPrevious = published && published.week !== board.week;
  const seat = (entry: ContestRankingEntry) => (
    <li key={entry.id}>
      <RankingSeat
        entry={entry}
        ownId={rankedSelf?.id}
        sharedFirst={champions.length > 1}
        onSelect={() => {
          if (published) setSelection({ week: published.week, entry });
        }}
      />
    </li>
  );

  return (
    <section
      className="alchemy-rank-board"
      aria-labelledby="alchemy-board-title"
    >
      <header className="alchemy-rank-heading">
        <div>
          <p className="alchemy-rank-date">
            {dateLabel.format(new Date(published?.opensAt ?? board.opensAt))} ·
            乱星海丹塔
          </p>
          <h2 id="alchemy-board-title">
            {showingPrevious ? '上期炼丹榜' : '本期炼丹榜'}
          </h2>
          {published?.title && (
            <p className="alchemy-rank-subject">
              {published?.title}
              {published.pillName &&
                published.pillName !== published?.title && (
                  <> · {published.pillName}</>
                )}
            </p>
          )}
        </div>
        <InkButton variant="secondary" href="/game/alchemy-contest">
          {!own || own.otherCharacter
            ? '前往丹塔'
            : own.finished
              ? '本场成绩'
              : '继续炼丹'}
        </InkButton>
      </header>

      {showingPrevious && <p className="alchemy-rank-status">{phaseText}</p>}

      {entries.length ? (
        <>
          <ol className="alchemy-rank-champions" aria-label="榜首">
            {champions.map(seat)}
          </ol>
          {podium.length > 0 && (
            <ol className="alchemy-rank-podium" aria-label="第二至第三名">
              {podium.map(seat)}
            </ol>
          )}
        </>
      ) : (
        <EmptyRanking
          title={showingPrevious ? '上期无人上榜' : stateTitle}
          description={
            showingPrevious ? '上期没有满足炼制目标的成绩。' : phaseText
          }
        />
      )}

      {rankedSelf && !ownOnPodium ? (
        <div className="alchemy-rank-self">
          <span>{showingPrevious ? '我的上期名次' : '我的名次'}</span>
          {rankedSelf.rank ? (
            <strong>
              第 <b className="font-mono">{rankedSelf.rank}</b> 名
            </strong>
          ) : (
            <span>未上榜</span>
          )}
        </div>
      ) : null}
      {own && !own.otherCharacter && published?.week !== board.week && (
        <div className="alchemy-rank-self">
          <span>本场得分</span>
          {own.score !== null ? (
            <strong>
              <b className="font-mono">{own.score}</b> 分
            </strong>
          ) : (
            <span>暂无达标成绩</span>
          )}
        </div>
      )}

      {others.length > 0 && (
        <section
          className="alchemy-rank-register"
          aria-labelledby="alchemy-register-title"
        >
          <h3 id="alchemy-register-title">其余席位</h3>
          <ol>{others.map(seat)}</ol>
        </section>
      )}

      {selected && published && (
        <AlchemyScoreDetail
          key={`${published.week}:${selected.id}`}
          week={published.week}
          entry={selected}
          onClose={() => setSelection(null)}
        />
      )}
    </section>
  );
}

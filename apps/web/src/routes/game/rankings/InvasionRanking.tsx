import { activityDate } from '@app/components/feature/weekly-activity/schedule';
import {
  WeeklyBoardEmpty,
  WeeklyBoardHeader,
  WeeklyBoardPending,
} from '@app/components/feature/weekly-activity/WeeklyLeaderboard';
import { InkDetailDrawer, InkSelect } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import type {
  InvasionStatus,
  InvasionRanking as Ranking,
} from '@daoyou/contracts/invasion';
import { INVASION_PATH } from '@daoyou/game-domain/invasion';
import { invasionWeek } from '@daoyou/game-rules/invasion';
import { useEffect, useState } from 'react';
import { requestInvasion } from '../invasion/request';
import './invasion-ranking.css';

type TeamScore = Ranking['rows'][number];

function TeamPortrait({
  member,
}: {
  member: TeamScore['participants'][number];
}) {
  return (
    <GameIcon
      value={
        member.gender === '女'
          ? 'icon:cultivator-female-avatar'
          : 'icon:cultivator-male-avatar'
      }
      purpose="artwork"
      className="invasion-score-portrait"
    />
  );
}

function TeamSeat({
  team,
  own,
  tied,
  onSelect,
}: {
  team: TeamScore;
  own: boolean;
  tied: boolean;
  onSelect: () => void;
}) {
  const champion = team.rank === 1;
  const position = champion
    ? tied
      ? '并列榜首'
      : '榜首'
    : tied
      ? '并列'
      : '名次';
  const credited = new Set(team.members.map((member) => member.cultivatorId));
  const rosterLabel = team.participants
    .map(({ name, title }) => (title ? `${name}「${title}」` : name))
    .join('、');

  return (
    <li>
      <button
        type="button"
        className="invasion-score-seat"
        data-champion={champion || undefined}
        data-podium={team.rank <= 3 || undefined}
        data-own={own || undefined}
        aria-haspopup="dialog"
        aria-label={`第 ${team.rank} 名${tied ? '，并列' : ''}，${rosterLabel}，通关 ${team.wave} 波，查看战绩`}
        onClick={onSelect}
      >
        <span className="invasion-score-place">
          <small>{position}</small>
          <b className="font-mono">{team.rank}</b>
          {own && <span>我的战绩</span>}
        </span>
        <span className="invasion-score-roster">
          {team.participants.map((member) => (
            <span key={member.cultivatorId} className="invasion-score-member">
              <TeamPortrait member={member} />
              <span className="invasion-score-name">
                <strong>{member.name}</strong>
                {member.title && <small>{member.title}</small>}
                {!credited.has(member.cultivatorId) && <small>同场参战</small>}
              </span>
            </span>
          ))}
        </span>
        <span className="invasion-score-result">
          <small>通关波次</small>
          <span>
            <b className="font-mono">{team.wave}</b> 波
          </span>
          <span className="invasion-score-view" aria-hidden="true">
            查看战绩 ›
          </span>
        </span>
      </button>
    </li>
  );
}

export function InvasionRanking() {
  const active = useCultivatorIdentity().data?.cultivator;
  const [ranking, setRanking] = useState<Ranking>();
  const [loadedAt] = useState(Date.now);
  const [status, setStatus] = useState<InvasionStatus>();
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<RealmType>();
  const [detail, setDetail] = useState<TeamScore>();
  useEffect(() => {
    const abort = new AbortController();
    void requestInvasion<Ranking>('/ranking', undefined, abort.signal)
      .then(setRanking)
      .catch(() => {
        if (!abort.signal.aborted) setError('除魔榜暂时无法读取。');
      });
    void requestInvasion<InvasionStatus>('', undefined, abort.signal)
      .then(setStatus)
      .catch(() => {});
    return () => abort.abort();
  }, [reload]);

  if (!ranking || error)
    return (
      <WeeklyBoardPending
        name="除魔榜"
        error={error}
        onRetry={() => {
          setError('');
          setReload((value) => value + 1);
        }}
      />
    );

  const myTeam = ranking.rows.find(({ members }) =>
    members.some((m) => m.cultivatorId === active?.id),
  );
  const preferred = REALM_VALUES.find(
    (value) =>
      value === active?.realm &&
      ranking.rows.some((row) => row.realm === value),
  );
  const realm =
    filter ??
    myTeam?.realm ??
    preferred ??
    ranking.rows[0]?.realm ??
    REALM_VALUES[0];
  const rows = ranking.rows.filter((row) => row.realm === realm);
  const week = invasionWeek(status?.serverNow ?? loadedAt);
  const counts = new Map<number, number>();
  for (const { rank } of rows) counts.set(rank, (counts.get(rank) ?? 0) + 1);

  return (
    <>
      <section className="weekly-rank-board" aria-label="除魔榜">
        <WeeklyBoardHeader
          name="除魔榜"
          date={activityDate(ranking.week ?? week.opensAt)}
          place="坠魔谷外围"
          period={
            ranking.week && ranking.week !== week.week ? '已封榜' : '本期'
          }
          href={INVASION_PATH}
          action="前往镇魔营地"
        />
        <div className="invasion-score-toolbar">
          <InkSelect
            label="挑战境界"
            value={realm}
            containerClassName="min-w-28"
            onChange={(v) => setFilter(v as RealmType)}
          >
            {REALM_VALUES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </InkSelect>
          <div>
            <p>
              {status?.open
                ? '收阵后公布新榜。'
                : '按有效通关波次排名，同波并列。'}
            </p>
            {ranking.week && (
              <p className="invasion-score-mine">
                我的战绩 ·{' '}
                {myTeam?.realm === realm ? (
                  <>
                    第 <b className="font-mono">{myTeam.rank}</b> 名 ·{' '}
                    <b className="font-mono">{myTeam.wave}</b> 波
                  </>
                ) : (
                  '此境未上榜'
                )}
              </p>
            )}
          </div>
        </div>
        {rows.length ? (
          <ol className="invasion-score-list" aria-label={`${realm}组队伍名次`}>
            {rows.map((row) => (
              <TeamSeat
                key={row.id}
                team={row}
                own={myTeam?.id === row.id}
                tied={(counts.get(row.rank) ?? 0) > 1}
                onSelect={() => setDetail(row)}
              />
            ))}
          </ol>
        ) : (
          <WeeklyBoardEmpty
            title={ranking.week ? '此境尚无队伍留名' : '首期成绩尚未公布'}
            emblem="icon:invasion-guard"
          />
        )}
      </section>
      <InkDetailDrawer
        isOpen={!!detail}
        onClose={() => setDetail(undefined)}
        title="队伍战绩"
        size="sm"
      >
        {detail && (
          <div className="space-y-4">
            <dl className="border-ink-border bg-paper-2 grid grid-cols-2 gap-3 border-y p-3">
              <div>
                <dt className="text-ink-secondary text-sm">{detail.realm}组</dt>
                <dd className="font-semibold">
                  第 <b className="font-mono">{detail.rank}</b> 名
                </dd>
              </div>
              <div>
                <dt className="text-ink-secondary text-sm">有效通关</dt>
                <dd className="text-teal font-semibold">
                  第 <b className="font-mono">{detail.wave}</b> 波
                </dd>
              </div>
            </dl>
            <div>
              <h3 className="font-semibold">该波参战名单</h3>
              <ul className="divide-ink-border divide-y">
                {detail.participants.map((m) => {
                  const credited = detail.members.some(
                    ({ cultivatorId }) => cultivatorId === m.cultivatorId,
                  );
                  return (
                    <li
                      key={m.cultivatorId}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2"
                    >
                      <TeamPortrait member={m} />
                      <div className="min-w-0 break-words">
                        <strong>{m.name}</strong>
                        <p className="text-ink-secondary text-xs">
                          {m.realm}
                          {m.realmStage}
                          {m.title && ` · ${m.title}`}
                        </p>
                      </div>
                      {credited && (
                        <small className="text-teal">计入本条成绩</small>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </InkDetailDrawer>
    </>
  );
}

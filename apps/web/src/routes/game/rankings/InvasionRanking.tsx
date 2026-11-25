import { GameLoadingState } from '@app/components/game-shell';
import { InkModal } from '@app/components/layout/InkModal';
import { InkNotice } from '@app/components/ui';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import type { InvasionRanking as Ranking } from '@daoyou/contracts/invasion';
import { INVASION_PATH } from '@daoyou/game-domain/invasion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { requestInvasion } from '../invasion/request';

export function InvasionRanking() {
  const active = useCultivatorIdentity().data?.cultivator;
  const [ranking, setRanking] = useState<Ranking>();
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<RealmType>();
  const [detail, setDetail] = useState<Ranking['rows'][number]>();
  useEffect(() => {
    const abort = new AbortController();
    void requestInvasion<Ranking>('/ranking', undefined, abort.signal)
      .then(setRanking)
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, []);
  if (!ranking)
    return error ? (
      <InkNotice tone="danger">暂时无法读取除魔榜。</InkNotice>
    ) : (
      <GameLoadingState message="正在查阅除魔榜……" variant="inline" />
    );

  const ownRealm = REALM_VALUES.find((value) => value === active?.realm);
  const realm = filter ?? ownRealm ?? REALM_VALUES[0];
  const rows = ranking.rows.filter((row) => row.realm === realm);
  const own = detail?.participants.some(
    (member) => member.cultivatorId === active?.id,
  );
  return (
    <section className="mx-auto grid w-full max-w-4xl gap-4 py-4">
      <header className="border-ink-border flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="font-heading text-3xl sm:text-4xl">除魔榜</h2>
          <p className="text-ink-secondary mt-1 text-sm">
            {ranking.week ? `${ranking.week} 期` : '每周二 16:00 后公布'}
          </p>
        </div>
        <label className="text-ink-secondary text-sm">
          挑战境界
          <select
            className="text-ink border-ink-border bg-paper ml-2 min-h-11 border px-2"
            value={realm}
            onChange={(event) => setFilter(event.target.value as RealmType)}
          >
            {REALM_VALUES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </header>
      {rows.length ? (
        <ol className="divide-ink-border divide-y">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`hover:bg-ink/5 grid min-h-18 w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-2 py-3 text-start ${row.rank === 1 ? 'bg-crimson/5' : ''}`}
                onClick={() => setDetail(row)}
              >
                <span
                  className={`min-w-8 font-mono text-2xl ${row.rank === 1 ? 'text-crimson' : 'text-ink-secondary'}`}
                >
                  {row.rank}
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {row.members.map((member) => (
                    <span
                      key={member.cultivatorId}
                      className="min-w-0 break-all"
                    >
                      <strong>{member.name}</strong>
                      {member.title && (
                        <small className="text-ink-secondary ml-1">
                          {member.title}
                        </small>
                      )}
                    </span>
                  ))}
                </span>
                <span className="text-right">
                  <b className="font-mono">{row.wave}</b> 波
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <InkNotice>此境尚无队伍留名。</InkNotice>
      )}
      <Link to={INVASION_PATH} className="text-teal w-fit underline">
        前往镇魔营地
      </Link>
      <InkModal
        isOpen={Boolean(detail)}
        onClose={() => setDetail(undefined)}
        title="队伍战绩"
      >
        {detail && (
          <div className="grid gap-3">
            <p>
              {detail.members.map(({ name }) => name).join('、')} ·{' '}
              {detail.realm}第 {detail.rank} 名
            </p>
            <p>
              有效通关 · 第 <b className="font-mono">{detail.wave}</b> 波
            </p>
            <div>
              <h3 className="font-semibold">该波参战名单</h3>
              <ul className="divide-ink-border divide-y">
                {detail.participants.map((member) => (
                  <li
                    key={member.cultivatorId}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span>{member.name}</span>
                    <small className="text-ink-secondary">{member.realm}</small>
                  </li>
                ))}
              </ul>
            </div>
            {own && detail.battleId && (
              <Link
                to={`/game/battle/${detail.battleId}`}
                className="text-teal w-fit underline"
              >
                回看该波战斗
              </Link>
            )}
          </div>
        )}
      </InkModal>
    </section>
  );
}

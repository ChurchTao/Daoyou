import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useBattleMatchClient } from '@app/lib/battle/useBattleMatchClient';
import type { ClientBattleIntentV1 } from '@shared/engine/battle-v5/match/types';

function formatRemaining(deadlineAt: number | undefined, now: number) {
  if (!deadlineAt) return '—';
  return `${Math.max(0, Math.ceil((deadlineAt - now) / 1000))}s`;
}

export default function LiveBattleMatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { view, error, actions } = useBattleMatchClient(matchId ?? null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  const ownUnits = useMemo(
    () => view?.planningView?.units ?? [],
    [view?.planningView?.units],
  );
  const ownSubmissions = view?.ownSubmissions ?? {};
  const allPlayersReady = view?.orchestration.allPlayersReady ?? false;

  const submit = (unitId: string, intent: ClientBattleIntentV1) => {
    actions?.submitIntent(unitId, intent);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-[#eee7d6] px-4 py-5 text-[#2c1810] md:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-start justify-between gap-4 border-b border-[#2c1810]/20 pb-4">
        <div>
          <p className="text-xs tracking-[0.22em] text-[#2c1810]/55">实时同步战局</p>
          <h1 className="mt-1 text-xl font-semibold tracking-[0.12em]">{matchId ?? '对局'}</h1>
        </div>
        <div className="text-right text-sm text-[#2c1810]/65">
          <div>第 {view?.round ?? '—'} 回合 · {view?.status ?? '连接中'}</div>
          <div className="mt-1">
            {allPlayersReady ? `剩余 ${formatRemaining(view?.deadlineAt, now)}` : '等待玩家接受邀请'}
          </div>
        </div>
      </header>

      {error && (
        <section className="mx-auto mt-6 w-full max-w-6xl border border-[#8f2433]/35 bg-[#8f2433]/5 p-4 text-sm text-[#8f2433]">
          {error}
        </section>
      )}

      {view && (
        <>
          {!allPlayersReady && (
            <section className="mx-auto mt-6 w-full max-w-6xl border border-[#2c1810]/20 bg-white/35 p-4 text-sm text-[#2c1810]/70">
              已就绪 {view.orchestration.readyPlayerCount}/{view.orchestration.totalPlayerCount}；全部玩家接受邀请后开始 30 秒选招。
            </section>
          )}
          <section className="mx-auto mt-6 grid w-full max-w-6xl gap-3 sm:grid-cols-2">
            {view.publicSnapshot.units.map((unit) => (
              <article key={unit.unitId} className="border border-[#2c1810]/15 bg-white/35 p-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <strong>{unit.name}</strong>
                  <span className="text-xs text-[#2c1810]/55">{unit.teamId} · {unit.alive ? '在阵' : '离阵'}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#2c1810]/70">
                  <span>气血 {unit.hp.current}/{unit.hp.max}</span>
                  <span>真元 {unit.mp.current}/{unit.mp.max}</span>
                  <span>护盾 {unit.shield}</span>
                  <span>状态 {unit.alive ? '可观察' : '已倒下'}</span>
                </div>
              </article>
            ))}
          </section>

          <section className="mx-auto mt-6 w-full max-w-6xl border-t border-[#2c1810]/20 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-[0.1em]">本方选招</h2>
                <p className="mt-1 text-xs text-[#2c1810]/55">所有存活单位提交后再锁定；未锁定将在 30 秒到期时自动收束。</p>
              </div>
              <button
                type="button"
                disabled={!actions || !allPlayersReady || view.status !== 'planning'}
                onClick={() => actions?.lock()}
                className="border border-[#8f2433]/45 px-4 py-2 text-sm text-[#8f2433] disabled:cursor-not-allowed disabled:opacity-40"
              >
                锁定本方
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {ownUnits.map((unit) => (
                <article key={unit.unitId} className="border border-[#2c1810]/15 bg-white/35 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm">{unit.unitId}</strong>
                    <span className="text-xs text-[#2c1810]/55">
                      {ownSubmissions[unit.unitId] ? '已提交' : '待选招'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!actions || !allPlayersReady || !unit.alive || view.status !== 'planning'}
                      onClick={() => submit(unit.unitId, { kind: 'pass' })}
                      className="border border-[#2c1810]/25 px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      观望
                    </button>
                    {unit.abilities.map((ability) => (
                      <button
                        key={ability.abilityId}
                        type="button"
                        disabled={!actions || !allPlayersReady || !ability.ready || view.status !== 'planning'}
                        onClick={() => submit(unit.unitId, {
                          kind: 'ability',
                          abilityId: ability.abilityId,
                          targetUnitId: ability.legalTargetIds[0],
                        })}
                        className="border border-[#3f6b56]/40 px-3 py-1.5 text-xs text-[#3f6b56] disabled:opacity-40"
                      >
                        {ability.name}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {view.latestResolution && (
            <section className="mx-auto mt-6 w-full max-w-6xl border-t border-[#2c1810]/20 pt-4 text-sm text-[#2c1810]/70">
              上回合已结算：{view.latestResolution.sequences.length} 段行动记录；等待下一回合选招。
            </section>
          )}
        </>
      )}

      {!view && !error && (
        <p className="mx-auto mt-10 w-full max-w-6xl text-sm text-[#2c1810]/55">正在建立战斗服务连接…</p>
      )}

      <Link to="/game/battle/history" className="mx-auto mt-auto pt-8 text-sm text-[#2c1810]/55 underline decoration-dashed underline-offset-4">
        返回战斗记录
      </Link>
    </main>
  );
}

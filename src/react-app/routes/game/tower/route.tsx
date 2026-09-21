import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { GameSceneFrame } from '@app/components/game-shell';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import type { TowerView } from '@shared/contracts/combatV6Tower';
import type { TowerBlessingId } from '@shared/lib/tower/blessings';
import { getTowerBlessingDefinition } from '@shared/lib/tower/blessings';
import { TOWER_MIN_REALM } from '@shared/lib/tower/helpers';
import type { TowerLeaderboardEntry } from '@shared/lib/tower/types';
import type { TowerEnemyPreview } from '@shared/lib/tower/weekly';
import type { RealmType } from '@shared/types/constants';
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { TowerLeaderboard } from './components/TowerLeaderboard';
import { TowerRewards } from './components/TowerRewards';

function TowerBoard() {
  const [realm, setRealm] = useState<RealmType>(TOWER_MIN_REALM);
  const [entries, setEntries] = useState<TowerLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void combatV6Request<TowerLeaderboardEntry[]>(
      `/api/tower/leaderboard?realm=${encodeURIComponent(realm)}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setEntries(data);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : '榜单读取失败');
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [realm]);
  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      <TowerLeaderboard
        activeRealm={realm}
        entries={entries}
        loading={loading}
        onRealmChange={(next) => {
          if (next === realm) return;
          setLoading(true);
          setError('');
          setRealm(next);
        }}
      />
    </>
  );
}

function EnemyMembers({
  enemy,
  compact = false,
}: {
  enemy: TowerEnemyPreview;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-end justify-center gap-5 ${compact ? 'my-2' : 'mt-4 mb-3'}`}
      aria-label="敌方阵容"
    >
      {enemy.members.map((member) => (
        <InkTooltip
          key={member.id}
          label={`${member.name}，查看机制`}
          triggerClassName="focus-visible:outline-ink inline-flex min-h-11 min-w-11 cursor-help items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2"
          triggerContent={
            <GameIcon
              value={member.icon}
              className={
                compact
                  ? 'text-2xl'
                  : member.role === 'leader'
                    ? 'text-6xl'
                    : 'text-3xl'
              }
            />
          }
        >
          <p className="mb-2">{member.name}</p>
          {member.details.map((detail) => (
            <p key={detail} className="mt-1 text-sm leading-6">
              {detail}
            </p>
          ))}
        </InkTooltip>
      ))}
    </div>
  );
}

function EnemyDetails({ enemy }: { enemy: TowerEnemyPreview }) {
  return (
    <details className="text-ink-secondary mx-auto max-w-md text-sm">
      <summary className="hover:text-crimson cursor-pointer leading-7">
        {enemy.labels.join(' · ')}
      </summary>
      <ul className="mt-3 space-y-2 text-left leading-6">
        {enemy.details.map((detail, i) => (
          <li key={i}>{detail}</li>
        ))}
      </ul>
    </details>
  );
}
const END_REASONS = {
  defeat: '蜃影未散，再整行装。',
  fled: '暂避锋芒，来日再登。',
  draw: '此战未分胜负。',
  retreated: '收起机缘，暂别蜃楼。',
  clear: '二十重蜃影，尽数踏破。',
  expired: '新一周的蜃楼已经显现。',
  realm_changed: '境界已变，可重新挑战新的幻境。',
  content_updated: '幻境已焕新，请重新入境。',
};

export default function TowerRoute() {
  const [view, setView] = useState<TowerView | null>(null);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<
    'rewards' | 'board' | 'week' | 'leave' | null
  >(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  const reading = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    reading.current = controller;
    void combatV6Request<TowerView>('/api/tower/state', {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setView(data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : '读取失败');
      });
    return () => {
      mounted.current = false;
      reading.current?.abort();
    };
  }, []);
  async function run(action: () => Promise<TowerView>) {
    if (busy.current) return;
    busy.current = true;
    reading.current?.abort();
    setPending(true);
    setError('');
    try {
      const next = await action();
      if (mounted.current) setView(next);
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : '操作失败');
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  function act(
    action: 'battle' | 'blessing' | 'leave',
    blessingId?: TowerBlessingId,
  ) {
    return run(async () => {
      const current = view;
      if (!current?.state) throw new Error('挑战已失效，请刷新');
      return combatV6Request<TowerView>(
        '/api/tower/action',
        mutationBody({
          runId: current.state.runId,
          revision: current.state.revision,
          action,
          blessingId,
        }),
      );
    });
  }
  const state = view?.state;
  if (state?.battleId) return <Navigate to="/game/tower/battle" replace />;
  const choosing = state?.status === 'CHOOSING_BLESSING';
  const finished = state?.status === 'FINISHED';
  const enemy = state?.enemy;
  return (
    <GameSceneFrame
      variant="lite"
      headerMeta={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          {panel ? (
            <InkButton variant="secondary" onClick={() => setPanel(null)}>
              ← 返回挑战
            </InkButton>
          ) : (
            <span className="text-ink-secondary text-sm">
              {state?.realm ?? '每周一蜃境新生'}
            </span>
          )}
          <div
            role="group"
            aria-label="幻境资讯"
            className="flex flex-wrap gap-1"
          >
            {(
              [
                ['rewards', '🎁', '本周机缘'],
                ['board', '🏆', '境界榜'],
                ['week', '⚔️', '本周强敌'],
              ] as const
            ).map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-pressed={panel === id}
                aria-controls="tower-content"
                onClick={() => setPanel(id)}
                className={`hover:bg-ink/6 focus-visible:outline-ink inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sm px-2 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-3 ${
                  panel === id
                    ? 'bg-ink/8 text-ink font-semibold'
                    : 'text-ink-secondary'
                }`}
              >
                <GameIcon value={icon} className="text-base" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      }
    >
      {error ? (
        <p role="alert" className="text-crimson text-sm">
          {error}{' '}
          <InkButton
            disabled={pending}
            onClick={() =>
              void run(() => combatV6Request<TowerView>('/api/tower/state'))
            }
          >
            刷新恢复
          </InkButton>
        </p>
      ) : null}
      <div id="tower-content">
        {!view ? (
          <p className="text-ink-secondary py-12 text-center">正在照见幻境…</p>
        ) : panel === null ? (
          <div className="mx-auto max-w-lg py-4 text-center">
            {!state || finished ? (
              <>
                <GameIcon
                  value={finished && state.reason === 'clear' ? '🌅' : '🌫️'}
                  className="my-6 text-6xl"
                />
                {finished ? (
                  <>
                    <p className="text-ink-secondary text-sm">本次登临</p>
                    <p className="my-3">
                      <span className="font-mono text-4xl font-semibold">
                        {state.highestFloor}
                      </span>
                      <span className="text-ink-secondary ml-2 text-sm">
                        层
                      </span>
                    </p>
                    <p className="text-ink-secondary text-sm leading-6">
                      {state.reason ? END_REASONS[state.reason] : '暂别蜃楼。'}
                    </p>
                  </>
                ) : (
                  <p className="text-ink-secondary leading-7">
                    二十重蜃影，今朝能登几层？
                  </p>
                )}
                <div className="mt-5">
                  <InkButton
                    variant="primary"
                    pending={pending}
                    disabled={!view.eligible}
                    onClick={() =>
                      void run(() =>
                        combatV6Request<TowerView>(
                          '/api/tower/start',
                          mutationBody({}),
                        ),
                      )
                    }
                  >
                    {view.eligible
                      ? finished
                        ? '再次入境'
                        : '进入幻境'
                      : `${TOWER_MIN_REALM}境界开放`}
                  </InkButton>
                </div>
              </>
            ) : choosing ? (
              <>
                <p className="text-ink-secondary text-sm">
                  {state.highestFloor
                    ? `已通过第 ${state.highestFloor} 层`
                    : '入境机缘'}
                </p>
                <p className="mt-3 text-xl">择一祝福，继续登楼</p>
                <div className="mt-6 space-y-3 text-left">
                  {state.choices.map((choice) => {
                    const def = getTowerBlessingDefinition(choice.id);
                    return (
                      <div
                        key={choice.id}
                        className="border-ink/15 flex items-center gap-4 border-b py-4 last:border-0"
                      >
                        <GameIcon value={def.icon} className="text-3xl" />
                        <div className="min-w-0 flex-1">
                          <InkButton
                            variant="primary"
                            disabled={pending}
                            onClick={() => void act('blessing', choice.id)}
                          >
                            {choice.name}{' '}
                            <span className="ml-2 font-mono">
                              +{Math.round(def.perStack * 100)}%
                            </span>
                          </InkButton>
                          <p className="text-ink-secondary mt-1 text-sm leading-6">
                            {def.label}
                          </p>
                          {choice.currentStacks ? (
                            <p className="text-ink-secondary mt-1 font-mono text-sm">
                              {Math.round(
                                choice.currentStacks * def.perStack * 100,
                              )}
                              % →{' '}
                              {Math.round(
                                choice.nextStacks * def.perStack * 100,
                              )}
                              %
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : enemy ? (
              <>
                <p className="text-ink-secondary text-sm">
                  第{' '}
                  <span className="text-ink font-mono text-3xl font-semibold">
                    {state.floor}
                  </span>{' '}
                  层 <span className="ml-1 font-mono">/ 20</span>
                </p>
                <EnemyMembers enemy={enemy} />
                <p
                  className={
                    enemy.kind === 'normal'
                      ? 'text-ink-secondary text-sm'
                      : 'text-crimson text-sm'
                  }
                >
                  {enemy.kind === 'boss'
                    ? '首领'
                    : enemy.kind === 'elite'
                      ? '精英'
                      : '蜃影'}
                </p>
                <p className="mt-2 mb-3 text-2xl">{enemy.name}</p>
                <EnemyDetails
                  key={`${state.floor}:${enemy.name}`}
                  enemy={enemy}
                />
                <div className="mt-5">
                  <InkButton
                    variant="primary"
                    pending={pending}
                    pendingLabel="蜃影凝聚…"
                    onClick={() => void act('battle')}
                  >
                    迎战
                  </InkButton>
                </div>
              </>
            ) : null}
            {!choosing ? (
              <p className="text-ink-secondary mt-3 text-xs">
                每场满气血、满法力迎战
              </p>
            ) : null}
            {state && Object.keys(state.blessings).length ? (
              <div className="mt-7 flex flex-wrap justify-center gap-4">
                {Object.entries(state.blessings).map(([id, stacks]) => {
                  const def = getTowerBlessingDefinition(id as TowerBlessingId);
                  return (
                    <InkTooltip
                      key={id}
                      label={def.name}
                      triggerClassName="inline-flex min-h-10 items-center gap-1.5"
                      triggerContent={
                        <>
                          <GameIcon value={def.icon} />
                          <span className="font-mono text-sm">
                            +{Math.round((stacks ?? 0) * def.perStack * 100)}%
                          </span>
                        </>
                      }
                    >
                      {def.description}
                    </InkTooltip>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <section
            className="min-h-72 py-4"
            aria-label={
              panel === 'board'
                ? '境界榜'
                : panel === 'rewards'
                  ? '本周机缘'
                  : panel === 'leave'
                    ? '暂别蜃楼'
                    : '本周强敌'
            }
          >
            {panel === 'board' ? (
              <TowerBoard />
            ) : panel === 'rewards' ? (
              <TowerRewards view={view} />
            ) : panel === 'leave' ? (
              <div className="space-y-4 text-sm leading-7">
                <p>本次祝福将散去，已获机缘保留。</p>
                <InkButton
                  pending={pending}
                  onClick={() => {
                    setPanel(null);
                    void act('leave');
                  }}
                >
                  结束本次挑战
                </InkButton>
              </div>
            ) : panel === 'week' ? (
              <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                {view?.weeklyEnemies.map((foe) => (
                  <div key={foe.floor} className="border-ink/15 border-b pb-6">
                    <p className="mb-1 text-sm">
                      <span className="font-mono">{foe.floor}</span> 层 ·{' '}
                      {foe.name}
                    </p>
                    <EnemyMembers enemy={foe} compact />
                    <EnemyDetails enemy={foe} />
                  </div>
                ))}
                {state && !finished ? (
                  <div className="md:col-span-2">
                    <InkButton
                      variant="secondary"
                      onClick={() => setPanel('leave')}
                    >
                      结束挑战
                    </InkButton>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        )}
      </div>
    </GameSceneFrame>
  );
}

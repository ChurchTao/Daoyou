import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { GameSceneFrame, GameSceneSection } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import type { TowerView } from '@shared/contracts/combatV6Tower';
import { itemDefinition } from '@shared/inventory';
import type { TowerBlessingId } from '@shared/lib/tower/blessings';
import { getTowerBlessingDefinition } from '@shared/lib/tower/blessings';
import { TOWER_MIN_REALM } from '@shared/lib/tower/helpers';
import type { TowerLeaderboardEntry } from '@shared/lib/tower/types';
import type { RealmType } from '@shared/types/constants';
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { TowerLeaderboard } from './components/TowerLeaderboard';

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
          setLoading(true);
          setError('');
          setRealm(next);
        }}
      />
    </>
  );
}

export default function TowerRoute() {
  const [view, setView] = useState<TowerView | null>(null);
  const [error, setError] = useState('');
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
  return (
    <GameSceneFrame>
      {error ? (
        <p role="alert">
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
      {!view ? (
        <p>正在照见幻境…</p>
      ) : !state || state.status === 'FINISHED' ? (
        <GameSceneSection>
          <p>
            {state
              ? `本次通过 ${state.highestFloor} 层。`
              : '蜃影凝成高楼，带上灵兽，逐层寻觅机缘。'}
          </p>
          <InkButton
            disabled={pending || !view.eligible}
            onClick={() =>
              void run(() =>
                combatV6Request<TowerView>(
                  '/api/tower/start',
                  mutationBody({}),
                ),
              )
            }
          >
            {view.eligible ? '进入幻境' : `${TOWER_MIN_REALM}境界开放`}
          </InkButton>
        </GameSceneSection>
      ) : (
        <GameSceneSection>
          <p>第 {state.floor} 层</p>
          <p className="text-ink-secondary text-sm">
            气血 {state.hp}/{state.maxHp} · 法力 {state.mp}/{state.maxMp}
          </p>
          {state.status === 'CHOOSING_BLESSING' ? (
            <div className="grid gap-3">
              {state.choices.map((choice) => (
                <InkButton
                  key={choice.id}
                  disabled={pending}
                  onClick={() => void act('blessing', choice.id)}
                >
                  <span>
                    {choice.name} · {choice.nextStacks} 层
                  </span>
                  <span className="text-ink-secondary block text-sm">
                    {choice.description}
                  </span>
                </InkButton>
              ))}
            </div>
          ) : (
            <InkButton disabled={pending} onClick={() => void act('battle')}>
              挑战此层
            </InkButton>
          )}
          <InkButton disabled={pending} onClick={() => void act('leave')}>
            结束挑战
          </InkButton>
        </GameSceneSection>
      )}
      {state && Object.keys(state.blessings).length ? (
        <GameSceneSection title="本次祝福">
          <div className="flex flex-wrap gap-3">
            {Object.entries(state.blessings).map(([id, stacks]) => (
              <span key={id}>
                {getTowerBlessingDefinition(id as TowerBlessingId).name} ×
                {stacks}
              </span>
            ))}
          </div>
        </GameSceneSection>
      ) : null}
      {state?.rewards.length ? (
        <GameSceneSection title="本周已获机缘">
          {state.rewards.map((reward) => (
            <p key={reward.floor}>
              第 {reward.floor} 层：{reward.spiritStones} 灵石 ·{' '}
              {reward.reputation} 声望 ·{' '}
              {reward.items
                .map(
                  (item) =>
                    `${itemDefinition(item.definitionId).name} ×${item.quantity}`,
                )
                .join('、')}
            </p>
          ))}
          <p className="text-ink-secondary text-sm">
            物品已收入储物袋，满袋时存入储藏室。
          </p>
        </GameSceneSection>
      ) : null}
      <TowerBoard key={state?.highestFloor ?? 0} />
    </GameSceneFrame>
  );
}

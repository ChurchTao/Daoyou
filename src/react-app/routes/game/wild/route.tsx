import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { useCombatV6Session } from '@app/components/feature/combat-v6/useCombatV6Session';
import { InkButton } from '@app/components/ui/InkButton';
import {
  useCombatV6Build,
  useCultivatorCondition,
} from '@app/lib/resources/player';
import type { WildSessionView } from '@shared/contracts/combatV6Wild';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

type Region = {
  name: string;
  realmRequirement: string;
  beastRealm: string;
  minLevel: number;
  maxLevel: number;
  remaining: number;
  dailyLimit: number;
  settlingBattleId: string | null;
  trainingSessionId: string | null;
  resetsAt: string;
  species: readonly {
    id: string;
    name: string;
    description: string;
    role: string;
  }[];
};
async function api<T>(
  path: string,
  body?: unknown,
  method = 'POST',
): Promise<T> {
  return combatV6Request<T>(
    `/api/combat-v6/wild${path}`,
    body ? mutationBody(body, method) : undefined,
  );
}
export default function WildPage() {
  const [params] = useSearchParams();
  const nodeId = params.get('nodeId') ?? 'SAT_TN_08';
  return <WildRegion key={nodeId} nodeId={nodeId} />;
}
function WildRegion({ nodeId }: { nodeId: string }) {
  const build = useCombatV6Build();
  const { reload: reloadCondition } = useCultivatorCondition();
  const combat = useCombatV6Session<WildSessionView>('/api/combat-v6/wild');
  const {
    session,
    pending,
    error,
    run,
    acceptSession,
    refresh,
    setError,
    submit,
    resolve,
  } = combat;
  const [region, setRegion] = useState<Region>();
  const requestId = useRef<string | null>(null);
  const regionRead = useRef<AbortController | null>(null);
  const reloadRegion = useCallback(() => {
    regionRead.current?.abort();
    const controller = new AbortController();
    regionRead.current = controller;
    return combatV6Request<Region>(
      `/api/combat-v6/wild/regions/${encodeURIComponent(nodeId)}`,
      { signal: controller.signal },
    )
      .then((next) => {
        if (!controller.signal.aborted) setRegion(next);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : '区域加载失败');
      });
  }, [nodeId, setError]);
  useEffect(() => {
    void reloadRegion();
    return () => regionRead.current?.abort();
  }, [reloadRegion]);
  // The region lock is held throughout combat, not only during settlement.
  const settling = session
    ? session.settlement === 'pending'
    : !!region?.settlingBattleId;
  useEffect(() => {
    if (!settling || pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const updated = await refresh();
      if (!cancelled && updated === null) await reloadRegion();
      if (!cancelled) timer = setTimeout(() => void poll(), 2000);
    };
    timer = setTimeout(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      regionRead.current?.abort();
    };
  }, [settling, pending, refresh, reloadRegion]);
  useEffect(() => {
    if (session?.settlement !== 'settled') return;
    let cancelled = false;
    void Promise.all([reloadRegion(), reloadCondition()]).catch((cause) => {
      if (!cancelled)
        setError(cause instanceof Error ? cause.message : '结算状态刷新失败');
    });
    return () => {
      cancelled = true;
    };
  }, [
    session?.sessionId,
    session?.settlement,
    reloadRegion,
    reloadCondition,
    setError,
  ]);
  const explore = () =>
    run(async () => {
      regionRead.current?.abort();
      requestId.current ??= crypto.randomUUID();
      acceptSession(
        await api<WildSessionView>('/explorations', {
          nodeId,
          requestId: requestId.current,
        }),
      );
      requestId.current = null;
      await reloadRegion();
    });
  const abandon = () => {
    if (!session) return;
    if (
      !session.outcome &&
      !window.confirm(
        '放弃后会保存当前气血、法力损耗，且不退还探索次数。确认离开？',
      )
    )
      return;
    void run(async () => {
      regionRead.current?.abort();
      await api(
        `/sessions/${session.sessionId}`,
        { expectedRevision: session.revision },
        'DELETE',
      );
      acceptSession(null);
      await Promise.all([reloadCondition(), reloadRegion()]);
    });
  };
  return (
    <CombatV6Page
      title={region?.name ?? '野外探索'}
      error={error || build.error || undefined}
      onRetry={
        error
          ? () => void Promise.all([refresh(true), reloadRegion()])
          : undefined
      }
      loading={combat.loading && !session}
      active={!!session}
      back="/game/map"
      backLabel="返回地图"
    >
      {!session && (
        <div className="space-y-4">
          {!build.loading && build.data?.status !== 'active' ? (
            <p>
              请先在
              <Link className="underline" to="/game/training-room">
                练功房
              </Link>
              完成宗门流派初始化。
            </p>
          ) : null}
          {!session && region && (
            <>
              <p className="text-ink-secondary">
                溪水穿过灵草坡，草丛中不时传来灵兽的动静。
              </p>
              <p className="text-sm">
                准入：{region.realmRequirement} · 灵兽：{region.beastRealm}（
                {region.minLevel}～{region.maxLevel}级）
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {region.species.map((s) => (
                  <div key={s.id}>
                    <strong>{s.name}</strong>
                    <span className="ml-2 text-xs">{s.role}</span>
                    <p className="text-ink-secondary mt-1 text-sm">
                      {s.description}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm">
                今日剩余 {region.remaining}/{region.dailyLimit} 次 ·
                北京时间零点重置
              </p>
              {region.settlingBattleId ? (
                <p>上场战斗资源结算中，请稍候。</p>
              ) : null}
              {region.trainingSessionId ? (
                <p>
                  当前还有训练会话，请先
                  <Link to="/game/training-room" className="underline">
                    返回练功房结束训练
                  </Link>
                  。
                </p>
              ) : null}
              <InkButton
                variant="primary"
                pending={pending}
                disabled={
                  build.data?.status !== 'active' ||
                  region.remaining <= 0 ||
                  !!region.trainingSessionId ||
                  !!region.settlingBattleId
                }
                onClick={explore}
              >
                探索灵兽
              </InkButton>
            </>
          )}
        </div>
      )}
      {session && (
        <CombatV6Battle
          key={session.sessionId}
          title={region?.name ?? '野外探索'}
          session={session}
          pending={pending}
          shown={combat.shown}
          log={combat.log}
          playing={combat.playing}
          onCommand={submit}
          onResolve={resolve}
          onClose={abandon}
          back="/game/map"
          backLabel="返回地图"
        />
      )}
    </CombatV6Page>
  );
}

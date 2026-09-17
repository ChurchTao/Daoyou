import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { useCombatV6Session } from '@app/components/feature/combat-v6/useCombatV6Session';
import { useQiState } from '@app/components/feature/cultivator/useQiState';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
  usePlayerSession,
  useSectCombatState,
} from '@app/lib/resources/player';
import type {
  WildEncounterView,
  WildRegionView,
  WildSessionView,
} from '@shared/contracts/combatV6Wild';
import { combatCharacterLevel } from '@shared/engine/combat-v6/projection/character-level';
import { itemDefinition } from '@shared/inventory';
import { InventoryEquipmentSchema } from '@shared/inventory/equipment';
import { REALM_ORDER } from '@shared/types/constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { WildSeekingScene } from './WildSeekingScene';

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
  const { openDialog } = useInkUI();
  const build = useSectCombatState();
  const identity = useCultivatorIdentity();
  const player = usePlayerSession();
  const qi = useQiState({
    cultivatorId: player.data?.activeCultivator?.id ?? '',
  });
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
  const [region, setRegion] = useState<WildRegionView>();
  const cultivator = identity.data?.cultivator;
  const realmLocked =
    !!region &&
    !!cultivator &&
    REALM_ORDER[cultivator.realm] < REALM_ORDER[region.realmRequirement];
  const [searching, setSearching] = useState(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const requestId = useRef<string | null>(null);
  const regionRead = useRef<AbortController | null>(null);
  const reloadRegion = useCallback(() => {
    regionRead.current?.abort();
    const controller = new AbortController();
    regionRead.current = controller;
    return combatV6Request<WildRegionView>(
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
      setSearching(true);
      requestId.current ??= crypto.randomUUID();
      try {
        const response = fetch('/api/combat-v6/wild/explorations', {
          ...mutationBody({ nodeId, requestId: requestId.current }),
          headers: { 'Content-Type': 'application/json' },
        }).then(async (response) => {
          // A definite rejection can use a new key; ambiguous network failures retry the same charge.
          if (!response.ok && response.status < 500) requestId.current = null;
          return consumeResourceMutation<WildEncounterView>(response);
        });
        const [encounter] = await Promise.all([
          response,
          new Promise((resolve) => window.setTimeout(resolve, 800)),
        ]);
        requestId.current = null;
        if (alive.current)
          setRegion((previous) =>
            previous ? { ...previous, encounter } : previous,
          );
      } finally {
        if (alive.current) {
          setSearching(false);
          await reloadRegion();
        }
      }
    });
  const start = () =>
    run(async () => {
      const encounter = region?.encounter;
      if (!encounter) return;
      regionRead.current?.abort();
      try {
        acceptSession(
          await api<WildSessionView>('/sessions', {
            encounterId: encounter.id,
          }),
        );
      } finally {
        if (alive.current) await reloadRegion();
      }
    });
  const abandon = () => {
    if (!session) return;
    const closeBattle = () =>
      run(async () => {
        regionRead.current?.abort();
        await api(
          `/sessions/${session.sessionId}`,
          { expectedRevision: session.revision },
          'DELETE',
        );
        acceptSession(null);
        await Promise.all([reloadCondition(), reloadRegion()]);
      });
    if (session.outcome) {
      void closeBattle();
      return;
    }
    openDialog({
      title: '放弃战斗',
      content:
        '放弃后会保存当前气血、法力损耗，本次寻觅消耗的天地灵气不退还。确认离开？',
      confirmLabel: '确认放弃',
      cancelLabel: '继续战斗',
      loadingLabel: '正在结束战斗……',
      onConfirm: closeBattle,
    });
  };
  if (!session) {
    return (
      <div className="app-safe-area-page bg-paper text-ink h-full overflow-y-auto">
        <nav
          className="mx-auto flex max-w-[1120px] justify-end px-4 pt-2 sm:px-8"
          aria-label="野外导航"
        >
          <InkButton
            href={`/game/map?nodeId=${encodeURIComponent(nodeId)}`}
            variant="secondary"
          >
            返回地图
          </InkButton>
        </nav>
        {(error || build.error || qi.error || identity.error) && (
          <div
            className="text-crimson mx-auto max-w-2xl px-6 py-3 text-sm"
            role="alert"
          >
            {error || build.error || qi.error || identity.error}
            <InkButton
              onClick={() => void Promise.all([refresh(true), reloadRegion()])}
            >
              重新载入
            </InkButton>
          </div>
        )}
        {(combat.loading || !region) && !error ? (
          <GameLoadingState variant="scene" message="正在踏入山野……" />
        ) : region ? (
          <>
            {build.data?.status !== 'active' && !build.loading && (
              <p className="text-ink-secondary px-6 py-2 text-center text-sm">
                请先在
                <Link className="underline" to="/game/training-room">
                  练功房
                </Link>
                完成宗门流派初始化。
              </p>
            )}
            {region.settlingBattleId && (
              <p
                className="text-ink-secondary text-center text-sm"
                role="status"
              >
                上场战斗结算中，请稍候。
              </p>
            )}
            {region.trainingSessionId && (
              <p className="text-ink-secondary text-center text-sm">
                请先
                <Link to="/game/training-room" className="underline">
                  结束当前训练
                </Link>
                。
              </p>
            )}
            {realmLocked && (
              <p
                className="text-ink-secondary px-6 py-2 text-center text-sm"
                role="status"
              >
                此处需要达到{region.realmRequirement}期后寻觅。
              </p>
            )}
            <WildSeekingScene
              region={region}
              searching={searching}
              starting={pending && !searching}
              unavailable={
                !cultivator ||
                realmLocked ||
                build.data?.status !== 'active' ||
                !!region.trainingSessionId ||
                !!region.settlingBattleId
              }
              ownerLevel={
                cultivator
                  ? combatCharacterLevel(
                      cultivator.realm,
                      cultivator.realm_stage,
                    )
                  : null
              }
              qi={qi.state?.current ?? null}
              onSearch={explore}
              onStart={start}
            />
          </>
        ) : null}
      </div>
    );
  }
  return (
    <CombatV6Page
      title={region?.name ?? '野外寻觅'}
      error={error || undefined}
      onRetry={
        error
          ? () => void Promise.all([refresh(true), reloadRegion()])
          : undefined
      }
      active
      back={`/game/map?nodeId=${encodeURIComponent(nodeId)}`}
      backLabel="返回地图"
    >
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
          onAuto={combat.submitAuto}
          onClose={abandon}
          back="/game/map"
          backLabel="返回地图"
        />
      )}
      {session?.settlement === 'settled' &&
      !combat.playing &&
      session.itemRewards?.length ? (
        <p role="status" className="mt-3 text-sm">
          获得{' '}
          {session.itemRewards
            .map(
              (item) =>
                `${item.definitionId === 'equipment.v6' ? InventoryEquipmentSchema.parse(item.instanceData).name : itemDefinition(item.definitionId).name} ×${item.quantity}`,
            )
            .join('、')}
          。已收存，背包不足的部分自动存入洞府储藏室。
        </p>
      ) : null}
    </CombatV6Page>
  );
}

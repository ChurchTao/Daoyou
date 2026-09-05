import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import {
  CommandPanel,
  UnitCard,
} from '@app/components/feature/battle/CombatV6Panels';
import { eventText } from '@app/components/feature/battle/combatV6EventText';
import { InkButton } from '@app/components/ui/InkButton';
import {
  useCombatV6Build,
  useCultivatorCondition,
} from '@app/lib/resources/player';
import type { CombatV6TrainingCommandV1 } from '@shared/contracts/combatV6';
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
  const r = await fetch(
    `/api/combat-v6/wild${path}`,
    body
      ? {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const value = await r.json();
  if (!r.ok || !value.success) throw new Error(value.error ?? '请求失败');
  return value.data;
}

export default function WildPage() {
  const [params] = useSearchParams();
  const nodeId = params.get('nodeId') ?? 'SAT_TN_08';
  const build = useCombatV6Build();
  const condition = useCultivatorCondition();
  const [region, setRegion] = useState<Region>();
  const [session, setSession] = useState<WildSessionView | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const requestId = useRef<string | null>(null);
  const reload = useCallback(async () => {
    const [r, s] = await Promise.all([
      api<Region>(`/regions/${encodeURIComponent(nodeId)}`),
      api<WildSessionView | null>('/sessions/current'),
    ]);
    setRegion(r);
    setSession(s);
  }, [nodeId]);
  useEffect(() => {
    const timer = setTimeout(
      () => void reload().catch((e) => setError(e.message)),
      0,
    );
    return () => clearTimeout(timer);
  }, [reload]);
  useEffect(() => {
    if (!region?.settlingBattleId && session?.settlement !== 'pending') return;
    const timer = setInterval(
      () => void reload().catch((e) => setError(e.message)),
      2000,
    );
    return () => clearInterval(timer);
  }, [reload, region?.settlingBattleId, session?.settlement]);
  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setPending(false);
      await reload().catch(() => {});
    }
  };
  const explore = () =>
    run(async () => {
      requestId.current ??= crypto.randomUUID();
      const s = await api<WildSessionView>('/explorations', {
        nodeId,
        requestId: requestId.current,
      });
      setSession(s);
      requestId.current = null;
    });
  const submit = (command: CombatV6TrainingCommandV1) =>
    run(async () => {
      if (!session?.commandOptions) return;
      setSession(
        await api(
          `/sessions/${session.sessionId}/commands/${encodeURIComponent(session.commandOptions.unitId)}`,
          { expectedRevision: session.revision, command },
          'PUT',
        ),
      );
    });
  const resolve = () =>
    run(async () => {
      if (session)
        setSession(
          await api(`/sessions/${session.sessionId}/resolve`, {
            expectedRevision: session.revision,
          }),
        );
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
      await api(
        `/sessions/${session.sessionId}`,
        { expectedRevision: session.revision },
        'DELETE',
      );
      setSession(null);
      await condition.reload();
    });
  };
  return (
    <BattlePageLayout
      title={region?.name ?? '野外探索'}
      actions={{ secondary: [{ label: '返回地图', href: '/game/map' }] }}
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-crimson">
            {error}
          </p>
        )}
        {build.data?.status !== 'active' ? (
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
            {region.trainingSessionId ? <p>当前还有训练会话，请先<Link to="/game/training-room" className="underline">返回练功房结束训练</Link>。</p> : null}
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
        {session && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {session.units.map((u) => (
                <UnitCard key={u.id} unit={u} />
              ))}
            </div>
            {session.outcome && (
              <p>
                {session.settlement === 'pending'
                  ? '资源结算中……'
                  : '资源已结算。'}
              </p>
            )}
            <CommandPanel
              session={session}
              pending={pending || session.settlement === 'pending'}
              onSubmit={submit}
              onResolve={resolve}
              onAbandon={abandon}
            />
            <div className="space-y-3">
              {Array.from(
                new Set(
                  session.events.map((x) =>
                    'round' in x.event ? x.event.round : 0,
                  ),
                ),
              ).map((round) => (
                <section key={round}>
                  <h3 className="font-semibold">第 {round} 回合</h3>
                  {session.events
                    .filter(
                      (x) => ('round' in x.event ? x.event.round : 0) === round,
                    )
                    .map((x) => (
                      <p key={x.seq} className="text-ink-secondary text-sm">
                        {eventText(x.event, session.units)}
                      </p>
                    ))}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </BattlePageLayout>
  );
}

import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { inkFieldVariants } from '@app/components/ui/inkFieldStyles';
import { useCombatV6Build } from '@app/lib/resources/player';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type {
  CombatV6BuildViewV1,
  CombatV6TrainingSessionViewV1,
} from '@shared/contracts/combatV6';
import { UnitCard, CommandPanel } from '@app/components/feature/battle/CombatV6Panels';
import { eventText } from '@app/components/feature/battle/combatV6EventText';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ContentView = {
  tiers: readonly (60 | 120 | 180)[];
  encounters: Array<{ id: string; name: string }>;
};
type SequencedEvent = CombatV6TrainingSessionViewV1['events'][number];

class ApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body
      ? { 'Content-Type': 'application/json', ...init.headers }
      : init?.headers,
  });
  const body = (await response.json()) as {
    success?: boolean;
    data?: T;
    code?: string;
    error?: string;
  };
  if (!response.ok || body.success === false) {
    throw new ApiError(body.error ?? `请求失败（${response.status}）`, body.code);
  }
  return body.data as T;
}

function mergeEvents(current: SequencedEvent[], incoming: SequencedEvent[]) {
  const bySeq = new Map(current.map((item) => [item.seq, item]));
  for (const item of incoming) bySeq.set(item.seq, item);
  return [...bySeq.values()].sort((left, right) => left.seq - right.seq);
}


function BuildInitialization({ build, pending, onInitialize }: {
  build: CombatV6BuildViewV1;
  pending: boolean;
  onInitialize: (pathId: string) => void;
}) {
  const [pathId, setPathId] = useState(build.paths[0]?.id ?? '');
  return <div className="space-y-4">
    <InkCard variant="highlighted" padding="lg">
      <h2 className="font-heading text-xl">立定 v6 修行流派</h2>
      <p className="text-ink-secondary mt-2 text-sm leading-7">当前宗门：{build.sectName}。此阶段完成选择后不可切换、升级或重置。</p>
    </InkCard>
    <div className="grid gap-3 md:grid-cols-2">
      {build.paths.map((path) => <button key={path.id} type="button" onClick={() => setPathId(path.id)} className={`border p-4 text-left ${pathId === path.id ? 'border-crimson bg-crimson/5' : 'border-ink/15'}`}>
        <strong>{path.name}</strong><p className="text-ink-secondary mt-1 text-xs">{path.id}</p>
      </button>)}
    </div>
    <InkCard padding="lg">
      <h3 className="font-semibold">六心法</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{build.methods.map((method) => <div key={method.id} className="flex justify-between border-b border-ink/10 py-1 text-sm"><span>{method.name}{method.isPrimary ? '（主）' : ''}</span><span>{method.level} 级</span></div>)}</div>
    </InkCard>
    <InkButton variant="primary" pending={pending} disabled={!pathId} onClick={() => onInitialize(pathId)}>确认流派并开启练功房</InkButton>
  </div>;
}

function EncounterSelection({ content, pending, onCreate }: {
  content: ContentView;
  pending: boolean;
  onCreate: (encounterId: string, tier: 60 | 120 | 180) => void;
}) {
  const [encounterId, setEncounterId] = useState(content.encounters[0]?.id ?? '');
  const [tier, setTier] = useState<60 | 120 | 180>(60);
  const fieldClass = inkFieldVariants({ size: 'sm' });
  return <InkCard variant="elevated" padding="lg">
    <h2 className="font-heading text-xl">选择演武场景</h2>
    <p className="text-ink-secondary mt-2 text-sm">训练不产生奖励、消耗回写或失败成本。</p>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="space-y-1 text-sm"><span>场景</span><select className={fieldClass} value={encounterId} onChange={(event) => setEncounterId(event.target.value)}>{content.encounters.map((encounter) => <option key={encounter.id} value={encounter.id}>{encounter.name}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>训练档位</span><select className={fieldClass} value={tier} onChange={(event) => setTier(Number(event.target.value) as 60 | 120 | 180)}>{content.tiers.map((value) => <option key={value} value={value}>{value} 级</option>)}</select></label>
    </div>
    <div className="mt-4"><InkButton variant="primary" pending={pending} disabled={!encounterId} onClick={() => onCreate(encounterId, tier)}>开始训练</InkButton></div>
  </InkCard>;
}


export default function TrainingRoomPage() {
  const buildQuery = useCombatV6Build();
  const build = buildQuery.data;
  const [content, setContent] = useState<ContentView>();
  const [session, setSession] = useState<CombatV6TrainingSessionViewV1 | null>();
  const [events, setEvents] = useState<SequencedEvent[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const acceptSession = useCallback((next: CombatV6TrainingSessionViewV1 | null) => {
    setSession(next);
    if (next) setEvents((current) => mergeEvents(current, next.events));
    else setEvents([]);
  }, []);

  const loadSession = useCallback(async () => {
    setSessionLoading(true);
    setError('');
    try {
      const [nextContent, current] = await Promise.all([
        request<ContentView>('/api/combat-v6/training/content'),
        request<CombatV6TrainingSessionViewV1 | null>('/api/combat-v6/training/sessions/current'),
      ]);
      setContent(nextContent);
      acceptSession(current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '练功房加载失败');
    } finally {
      setSessionLoading(false);
    }
  }, [acceptSession]);

  useEffect(() => {
    if (build?.status !== 'active') return;
    const timer = window.setTimeout(() => void loadSession(), 0);
    return () => window.clearTimeout(timer);
  }, [build?.status, loadSession]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setPending(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败');
      if (cause instanceof ApiError && cause.code === 'TRAINING_SESSION_REVISION_CONFLICT') await loadSession();
    } finally {
      setPending(false);
    }
  }, [loadSession]);

  const loading = buildQuery.loading || (build?.status === 'active' && sessionLoading);
  const shownError = error || buildQuery.error || '';

  const groupedEvents = useMemo(() => {
    let round = 0;
    const groups = new Map<number, SequencedEvent[]>();
    for (const item of events) {
      if (item.event.type === 'roundStart') round = item.event.round;
      const list = groups.get(round) ?? [];
      list.push(item);
      groups.set(round, list);
    }
    return [...groups.entries()];
  }, [events]);

  return <BattlePageLayout title="练功房" subtitle="combat-v6 权威构筑与确定性逐回合演武" loading={loading} error={shownError}>
    {!loading && build && !build.membershipId ? <InkCard variant="highlighted" padding="lg"><h2 className="font-heading text-xl">尚无有效宗门</h2><p className="text-ink-secondary mt-2 text-sm">加入已接入 combat-v6 的宗门后方可演武。</p><div className="mt-3"><InkButton href="/game/sect" variant="primary">前往宗门</InkButton></div></InkCard> : null}
    {!loading && build?.membershipId && !build.sectId ? <InkCard variant="highlighted" padding="lg">当前宗门尚未接入 combat-v6。</InkCard> : null}
    {!loading && build?.sectId && build.status !== 'active' ? <BuildInitialization build={build} pending={pending} onInitialize={(activePathId) => void run(async () => {
      const response = await fetch('/api/combat-v6/build/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activePathId, expectedRevision: 0 }),
      });
      const next = await consumeResourceMutation<CombatV6BuildViewV1>(response);
      buildQuery.setData(next);
    })} /> : null}
    {!loading && build?.status === 'active' && content && session === null ? <EncounterSelection content={content} pending={pending} onCreate={(encounterId, tier) => void run(async () => {
      setEvents([]);
      acceptSession(await request<CombatV6TrainingSessionViewV1>('/api/combat-v6/training/sessions', { method: 'POST', body: JSON.stringify({ encounterId, tier }) }));
    })} /> : null}
    {!loading && session ? <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2"><section><h2 className="font-heading mb-2 text-lg">我方</h2>{session.units.filter((unit) => unit.side === 0).map((unit) => <UnitCard key={unit.id} unit={unit} />)}</section><section><h2 className="font-heading mb-2 text-lg">敌方</h2>{session.units.filter((unit) => unit.side === 1).map((unit) => <UnitCard key={unit.id} unit={unit} />)}</section></div>
      <CommandPanel session={session} pending={pending} onSubmit={(command) => void run(async () => {
        const unitId = session.commandOptions?.unitId;
        if (!unitId) throw new Error('当前没有可提交指令的角色');
        acceptSession(await request<CombatV6TrainingSessionViewV1>(`/api/combat-v6/training/sessions/${session.sessionId}/commands/${unitId}`, { method: 'PUT', body: JSON.stringify({ expectedRevision: session.revision, command }) }));
      })} onResolve={() => void run(async () => {
        acceptSession(await request<CombatV6TrainingSessionViewV1>(`/api/combat-v6/training/sessions/${session.sessionId}/resolve`, { method: 'POST', body: JSON.stringify({ expectedRevision: session.revision }) }));
      })} onAbandon={() => void run(async () => {
        await request(`/api/combat-v6/training/sessions/${session.sessionId}`, { method: 'DELETE', body: JSON.stringify({ expectedRevision: session.revision }) });
        acceptSession(null);
      })} />
      <InkCard padding="lg"><h2 className="font-heading text-xl">战况纪要</h2>{groupedEvents.length === 0 ? <p className="text-ink-secondary mt-3 text-sm">尚无战斗事件。</p> : <div className="mt-3 space-y-4">{groupedEvents.map(([round, items]) => <section key={round}><h3 className="text-sm font-semibold">{round === 0 ? '开场' : `第 ${round} 回合`}</h3><ul className="text-ink-secondary mt-1 space-y-1 text-sm leading-6">{items.map((item) => { const text = eventText(item.event, session.units); return text ? <li key={item.seq}>{text}</li> : null; })}</ul></section>)}</div>}</InkCard>
    </div> : null}
  </BattlePageLayout>;
}

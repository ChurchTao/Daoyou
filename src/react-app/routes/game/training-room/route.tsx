import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { inkFieldVariants } from '@app/components/ui/inkFieldStyles';
import { useCombatV6Build } from '@app/lib/resources/player';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type {
  CombatV6BuildViewV1,
  CombatV6TrainingCommandV1,
  CombatV6TrainingSessionViewV1,
} from '@shared/contracts/combatV6';
import type { BattleEvent } from '@shared/engine/combat-v6/core';
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

function unitName(units: CombatV6TrainingSessionViewV1['units'], id?: string) {
  return units.find((unit) => unit.id === id)?.name ?? id ?? '未知目标';
}

function eventText(event: BattleEvent, units: CombatV6TrainingSessionViewV1['units']) {
  switch (event.type) {
    case 'battleStart': return '演武开始。';
    case 'roundStart': return `第 ${event.round} 回合开始。`;
    case 'roundEnd': return `第 ${event.round} 回合结束。`;
    case 'actionStart': return `${unitName(units, event.unitId)}开始行动。`;
    case 'actionSkip': return `${unitName(units, event.unitId)}无法行动：${event.reason}`;
    case 'actionFailed': return `${unitName(units, event.unitId)}施展失败：${event.reason}`;
    case 'retarget': return `${unitName(units, event.unitId)}的目标转向${unitName(units, event.to)}。`;
    case 'miss': return `${unitName(units, event.sourceId)}未能命中${unitName(units, event.targetId)}。`;
    case 'damage': return `${unitName(units, event.sourceId)}对${unitName(units, event.targetId)}造成 ${event.amount} 点伤害。`;
    case 'heal': return `${unitName(units, event.sourceId)}为${unitName(units, event.targetId)}恢复 ${event.amount} 点气血。`;
    case 'mpCost': return `${unitName(units, event.unitId)}消耗 ${event.amount} 点法力。`;
    case 'hpCost': return `${unitName(units, event.unitId)}消耗 ${event.amount} 点气血。`;
    case 'mpDamage': return `${unitName(units, event.targetId)}损失 ${event.amount} 点法力。`;
    case 'mpRestore': return `${unitName(units, event.unitId)}恢复 ${event.amount} 点法力。`;
    case 'woundChanged': return `${unitName(units, event.targetId)}的伤势由 ${event.before} 变为 ${event.after}。`;
    case 'barrierChanged': return `${unitName(units, event.unitId)}的护盾变化：${event.before} → ${event.after}。`;
    case 'statusApplied': return `${unitName(units, event.unitId)}获得状态「${event.statusId}」。`;
    case 'statusRemoved': return `${unitName(units, event.unitId)}失去状态「${event.statusId}」。`;
    case 'resourceChanged': return `${unitName(units, event.unitId)}的${event.resourceId}：${event.before} → ${event.after}。`;
    case 'unitDowned': return `${unitName(units, event.unitId)}倒地。`;
    case 'unitDead': return `${unitName(units, event.unitId)}战死。`;
    case 'unitRevived': return `${unitName(units, event.unitId)}复起，恢复 ${event.hp} 点气血。`;
    case 'unitEscaped': return `${unitName(units, event.unitId)}离开了战斗。`;
    case 'mechanicTriggered': return `${unitName(units, event.sourceId)}触发「${event.name}」。`;
    case 'chanceResolved': return `机缘判定${event.success ? '成功' : '失败'}（${Math.round(event.chance * 100)}%）。`;
    case 'battleEnd': return '演武结束。';
    case 'protectTrigger': return `${unitName(units, event.protectorId)}挺身保护${unitName(units, event.originalTargetId)}。`;
    case 'petSummoned':
    case 'petRecalled': return `${unitName(units, event.unitId)}的召唤单位发生变化。`;
    default: return null;
  }
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

function UnitCard({ unit }: { unit: CombatV6TrainingSessionViewV1['units'][number] }) {
  const recoverableHp = Math.max(1, unit.maxHp - unit.wound);
  return <InkCard variant={unit.side === 0 ? 'highlighted' : 'default'} padding="sm">
    <div className="flex items-start justify-between gap-3"><div><strong>{unit.name}</strong><span className="text-ink-secondary ml-2 text-xs">{unit.side === 0 ? '我方' : '敌方'}·{unit.slot + 1}位</span></div><span className="text-xs">{unit.dead ? '死亡' : unit.downed ? '倒地' : unit.escaped ? '离场' : '站立'}</span></div>
    <div className="mt-2 grid grid-cols-2 gap-2 text-sm"><span>气血 {unit.hp}/{recoverableHp}</span><span>法力 {unit.mp}/{unit.maxMp}</span><span>伤势 {unit.wound}</span><span>护盾 {unit.barriers.reduce((sum, item) => sum + item.current, 0)}</span></div>
    {(unit.statuses.length > 0 || unit.resources.length > 0 || unit.barriers.length > 0) && <div className="text-ink-secondary mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {unit.statuses.map((status) => <span key={`${status.id}-${status.remainingRounds}`}>{status.id} ×{status.stacks}（{status.remainingRounds}回合）</span>)}
      {unit.barriers.map((barrier) => <span key={barrier.id}>{barrier.name} {barrier.current}（{barrier.remainingRounds}回合）</span>)}
      {unit.resources.map((resource) => <span key={resource.id}>{resource.name} {resource.current}/{resource.max}</span>)}
    </div>}
  </InkCard>;
}

function CommandPanel({ session, pending, onSubmit, onResolve, onAbandon }: {
  session: CombatV6TrainingSessionViewV1;
  pending: boolean;
  onSubmit: (command: CombatV6TrainingCommandV1) => void;
  onResolve: () => void;
  onAbandon: () => void;
}) {
  const options = session.commandOptions;
  const targets = new Map(session.units.map((unit) => [unit.id, unit.name]));
  if (session.outcome) {
    const labels = { victory: '胜利', defeat: '落败', draw: '平局', aborted: '已中止' };
    return <InkCard variant="highlighted" padding="lg"><h2 className="font-heading text-xl">演武结果：{labels[session.outcome]}</h2><div className="mt-3"><InkButton variant="primary" pending={pending} onClick={onAbandon}>结束本次训练</InkButton></div></InkCard>;
  }
  return <InkCard variant="elevated" padding="lg">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-heading text-xl">第 {session.round} 回合指令</h2><p className="text-ink-secondary mt-1 text-xs">{session.pendingCommand ? '已锁定一条指令，可继续覆盖。' : '请选择本回合指令。'}</p></div><InkButton variant="ghost" pending={pending} onClick={onAbandon}>放弃训练</InkButton></div>
    {!options?.canSubmit ? <p className="text-crimson mt-3 text-sm">{options?.reasons.join('；') || '当前无法提交指令'}</p> : null}
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {options?.attackTargetIds.map((id) => <InkButton key={id} disabled={pending || !options.canSubmit} onClick={() => onSubmit({ type: 'attack', target: id })}>攻击·{targets.get(id) ?? id}</InkButton>)}
        {options?.canDefend ? <InkButton disabled={pending || !options.canSubmit} onClick={() => onSubmit({ type: 'defend' })}>防御</InkButton> : null}
        {options?.protectTargetIds.map((id) => <InkButton key={id} disabled={pending || !options.canSubmit} onClick={() => onSubmit({ type: 'protect', target: id })}>保护·{targets.get(id) ?? id}</InkButton>)}
        {options?.canFlee ? <InkButton disabled={pending || !options.canSubmit} onClick={() => onSubmit({ type: 'flee' })}>逃跑</InkButton> : null}
      </div>
      {options?.skills.map((skill) => <div key={skill.skillId} className="border-t border-ink/10 pt-2 text-sm"><div className="flex flex-wrap items-center gap-2"><strong>{skill.skillId}</strong>{!skill.ready ? <span className="text-crimson text-xs">{skill.reasons.join('；')}</span> : null}{skill.selectableTargetIds.map((id) => <InkButton key={id} disabled={pending || !options.canSubmit || !skill.ready} onClick={() => onSubmit({ type: 'skill', skillId: skill.skillId, targets: [id] })}>施展·{targets.get(id) ?? id}</InkButton>)}</div></div>)}
    </div>
    <div className="mt-5 border-t border-ink/15 pt-3"><InkButton variant="primary" pending={pending} disabled={!session.pendingCommand} onClick={onResolve}>推进回合</InkButton></div>
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

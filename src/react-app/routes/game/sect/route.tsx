import { GameSceneFrame, GameSceneLoading, GameSceneNote } from '@app/components/game-shell';
import { InkButton, InkCard, InkNotice, InkTabs } from '@app/components/ui';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import type { SectCurrentData } from '@shared/contracts/sect';
import {
  LINGXIAO_ABILITY_BY_ID,
  LINGXIAO_SECT,
  getSectMethodTrainingCost,
  type LingxiaoAbilityId,
  type SectTacticId,
} from '@shared/engine/sect';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const tabs = [
  { value: 'gate', label: '山门' }, { value: 'methods', label: '心法' },
  { value: 'meridians', label: '剑脉' }, { value: 'abilities', label: '神通' },
  { value: 'commissions', label: '委托' },
];

async function fetchCurrent(): Promise<SectCurrentData> {
  const response = await fetch('/api/sects/current');
  const json = await response.json();
  if (!json.success) throw new Error(json.error ?? '宗门卷宗读取失败');
  return json.data;
}

export default function SectPage() {
  const [data, setData] = useState<SectCurrentData | null>(null);
  const [tab, setTab] = useState('gate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();

  const reload = useCallback(async () => {
    try { setData(await fetchCurrent()); setError(undefined); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '宗门卷宗读取失败'); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    void fetchCurrent().then((next) => {
      if (!cancelled) setData(next);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '宗门卷宗读取失败');
    });
    return () => { cancelled = true; };
  }, []);

  const action = useCallback(async (url: string, init?: RequestInit) => {
    setBusy(true);
    try {
      await mutate(fetch(url, init));
      await reload();
      pushToast({ message: '宗门卷宗已更新', tone: 'success' });
    } catch (reason) {
      pushToast({ message: reason instanceof Error ? reason.message : '宗门事务失败', tone: 'danger' });
    } finally { setBusy(false); }
  }, [mutate, pushToast, reload]);

  if (!data && !error) return <GameSceneLoading message="山门云阶渐次显现……" />;

  return (
    <GameSceneFrame
      title="【凌霄剑宗】"
      description="先习宗门通用剑式，筑基后择快剑道；心法、经脉、神通栏与委托共同构成宗门修行。"
      headerMeta={error ? <GameSceneNote tone="danger">{error}</GameSceneNote> : undefined}
      aside={<div className="space-y-2 text-sm leading-7"><p>种族：人族</p><p>身份：{data?.sect?.status === 'active' ? '凌霄弟子' : data?.sect?.experiencedAt ? '记名访客' : '山外散修'}</p><p>贡献：{data?.sect?.contribution ?? 0}</p></div>}
    >
      <InkTabs items={tabs} activeValue={tab} onChange={setTab} />
      <div className="mt-4">
        {data && tab === 'gate' && <GateTab data={data} busy={busy} action={action} />}
        {data && tab === 'methods' && <MethodsTab data={data} busy={busy} action={action} />}
        {data && tab === 'meridians' && <MeridiansTab data={data} busy={busy} action={action} />}
        {data && tab === 'abilities' && <AbilitiesTab data={data} busy={busy} action={action} />}
        {data && tab === 'commissions' && <CommissionsTab data={data} busy={busy} action={action} />}
      </div>
    </GameSceneFrame>
  );
}

type TabProps = { data: SectCurrentData; busy: boolean; action: (url: string, init?: RequestInit) => Promise<void> };
function SectCard({ title, children }: { title: string; children: ReactNode }) {
  return <InkCard><h3 className="font-heading mb-2 text-lg">{title}</h3>{children}</InkCard>;
}
const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

function GateTab({ data, busy, action }: TabProps) {
  if (data.sect?.status === 'active') return <InkNotice>名录已定：人族·凌霄剑宗弟子。首版宗门身份不可退出或改投。</InkNotice>;
  return <div className="space-y-4">{data.raceNarrative && <InkNotice>人族判词：{data.raceNarrative}</InkNotice>}<SectCard title="山门试剑"><p className="text-sm leading-7">借宗门木剑体验基础剑术。胜负不影响拜师资格。</p><InkButton disabled={busy} onClick={() => action('/api/sects/lingxiao/experience', json('POST'))}>{data.sect?.experiencedAt ? '再次演剑' : '开始体验'}</InkButton></SectCard>{data.sect?.experiencedAt && <SectCard title="拜入凌霄"><p className="text-sm leading-7">入宗赠30贡献与两卷5级心法；造物神通自动卸下，但仍可收藏、推演和交易。</p><InkButton variant="primary" disabled={busy} onClick={() => action('/api/sects/lingxiao/join', json('POST'))}>拜师入宗</InkButton></SectCard>}</div>;
}

function MethodsTab({ data, busy, action }: TabProps) {
  if (data.sect?.status !== 'active') return <InkNotice>拜师后方可研习宗门心法。</InkNotice>;
  return <div className="grid gap-3 md:grid-cols-2">{LINGXIAO_SECT.methods.map((method) => {
    const level = data.sect?.methods[method.id] ?? 0;
    const target = level + 1;
    const cost = getSectMethodTrainingCost(level, target);
    return <SectCard key={method.id} title={method.name}><p className="text-sm leading-7">{method.description}</p><p className="text-sm">当前 {level} / {data.methodLevelCap} 级</p><InkButton disabled={busy || target > data.methodLevelCap} onClick={() => {
      if (window.confirm(`升至${target}级，消耗${cost.contribution}贡献、${cost.spiritStones}灵石？`)) void action(`/api/sects/methods/${method.id}/train`, json('POST', { targetLevel: target }));
    }}>研习一级</InkButton></SectCard>;
  })}</div>;
}

function MeridiansTab({ data, busy, action }: TabProps) {
  const sect = data.sect;
  const [slot, setSlot] = useState<1 | 2 | 3>(sect?.activeMeridianSlot ?? 1);
  const initial = sect?.meridianLoadouts.find((item) => item.slot === slot)?.nodeIds ?? [];
  const [selected, setSelected] = useState<string[]>(initial);
  if (sect?.status !== 'active') return <InkNotice>拜师后方可查看剑脉。</InkNotice>;
  if (!sect.pathId) return <SectCard title="快剑道"><p className="text-sm leading-7">筑基且《凌霄剑典》25级后，可定下快剑道。择道后首版不可更改。</p><InkButton disabled={busy} onClick={() => action('/api/sects/paths/swift-sword/select', json('POST'))}>选择快剑道</InkButton></SectCard>;
  const path = LINGXIAO_SECT.paths[0];
  const toggle = (nodeId: string, layer: string) => setSelected((current) => [...current.filter((id) => String(path.nodes.find((node) => node.id === id)?.layer) !== layer), nodeId]);
  return <div className="space-y-4"><div className="flex gap-2">{([1, 2, 3] as const).map((value) => <InkButton key={value} variant={slot === value ? 'primary' : 'secondary'} onClick={() => { setSlot(value); setSelected(sect.meridianLoadouts.find((item) => item.slot === value)?.nodeIds ?? []); }}>方案{value}{sect.activeMeridianSlot === value ? '·当前' : ''}</InkButton>)}</div>{[1, 2, 3, 4, 5, 'ultimate'].map((layer) => <SectCard key={layer} title={layer === 'ultimate' ? '终式' : `第${layer}层`}><div className="grid gap-2 md:grid-cols-3">{path.nodes.filter((node) => node.layer === layer).map((node) => <button type="button" key={node.id} onClick={() => toggle(node.id, String(layer))} className={`p-3 text-left text-sm leading-6 ${selected.includes(node.id) ? 'bg-crimson/10 text-crimson' : 'bg-ink/5'}`}><strong>{node.name}</strong><br />{node.description}</button>)}</div></SectCard>)}<div className="flex gap-2"><InkButton disabled={busy} onClick={() => action(`/api/sects/meridian-loadouts/${slot}`, json('PUT', { nodeIds: selected }))}>保存方案</InkButton><InkButton disabled={busy || sect.activeMeridianSlot === slot} onClick={() => action(`/api/sects/meridian-loadouts/${slot}/activate`, json('POST'))}>激活方案</InkButton></div></div>;
}

function AbilitiesTab({ data, busy, action }: TabProps) {
  const sect = data.sect;
  const [selected, setSelected] = useState<LingxiaoAbilityId[]>(sect?.abilityLoadout ?? []);
  const known = useMemo(() => data.knownAbilityIds.filter((id) => id !== 'plain-sword') as LingxiaoAbilityId[], [data.knownAbilityIds]);
  if (sect?.status !== 'active') return <InkNotice>拜师后方可装配宗门神通。</InkNotice>;
  const toggle = (id: LingxiaoAbilityId) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  return <div className="space-y-4"><InkNotice>平剑式为默认攻击，不占主动栏。基础招式在快剑道下沿用稳定ID并投影为变招。</InkNotice><div className="grid gap-3 md:grid-cols-2">{known.map((id) => { const ability = LINGXIAO_ABILITY_BY_ID.get(id)!; return <button type="button" key={id} onClick={() => toggle(id)} className={`p-4 text-left ${selected.includes(id) ? 'bg-crimson/10 text-crimson' : 'bg-ink/5'}`}><strong>{sect.pathId === 'swift-sword' ? ability.swiftName ?? ability.baseName : ability.baseName}</strong><p className="mt-1 text-sm leading-6">{ability.description}</p></button>; })}</div><p className="text-sm">主动栏：{selected.length}/4；{selected.map((id) => LINGXIAO_ABILITY_BY_ID.get(id)?.swiftName ?? LINGXIAO_ABILITY_BY_ID.get(id)?.baseName).join('、') || '未装配'}</p><InkButton disabled={busy} onClick={() => action('/api/sects/ability-loadout', json('PUT', { abilityIds: selected }))}>保存神通栏</InkButton><div><p className="mb-2 text-sm">自动战术</p>{(['aggressive', 'steady', 'counter'] as SectTacticId[]).map((id) => <InkButton key={id} variant={sect.tacticId === id ? 'primary' : 'secondary'} disabled={busy} onClick={() => action('/api/sects/tactic', json('PUT', { tacticId: id }))}>{id === 'aggressive' ? '急攻' : id === 'steady' ? '稳势' : '回风'}</InkButton>)}</div></div>;
}

function CommissionsTab({ data, busy, action }: TabProps) {
  if (data.sect?.status !== 'active') return <InkNotice>拜师后方可承接每日委托。</InkNotice>;
  const done = data.commission.completionType;
  return <div className="space-y-4"><InkNotice>每日演剑、历练、争锋三选一；第一个完成事件锁定当日结果。日期以东八区为准。</InkNotice><div className="grid gap-3 md:grid-cols-3"><SectCard title="演剑"><p className="text-sm leading-7">与宗门木人完成一场实战，胜负均算。</p><InkButton disabled={busy || Boolean(done)} onClick={() => action('/api/sects/commissions/spar', json('POST'))}>开始演剑</InkButton></SectCard><SectCard title="历练"><p className="text-sm leading-7">完成一次副本结算后自动记录。</p></SectCard><SectCard title="争锋"><p className="text-sm leading-7">完成一次天骄榜挑战后自动记录。</p></SectCard></div>{done && <SectCard title="今日已完成"><p className="text-sm">完成项：{done === 'spar' ? '演剑' : done === 'dungeon' ? '历练' : '争锋'}</p><InkButton disabled={busy || Boolean(data.commission.claimedAt)} onClick={() => action('/api/sects/commissions/claim', json('POST'))}>{data.commission.claimedAt ? '已领取' : '领取贡献'}</InkButton></SectCard>}</div>;
}

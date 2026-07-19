import { InkButton, InkCard, InkSelect } from '@app/components/ui';
import {
  useInventorySnapshot,
  useProductsSnapshot,
} from '@app/lib/player-state/selectors';
import { fetchSectConstruction } from '@app/lib/sect/sectClient';
import { useSectCurrentQuery, useSectResourceQuery } from '@app/components/feature/sect/SectQueryProvider';
import { getSectFacilityLabel, getSectPresentation } from '@app/lib/sect/sectPresentation';
import type { SectDonationDemandData } from '@shared/contracts/sect';
import { useState } from 'react';
import { postJson, SectPageLoading, SectPermissionBoundary, SectQueryError, SectScene, useSectMutation } from '../components/SectScene';

export default function SectIndustriesPage() {
  return <SectPermissionBoundary permission="sect.construction.view" title="百业院"><SectIndustriesBody /></SectPermissionBoundary>;
}

function SectIndustriesBody() {
  const current = useSectCurrentQuery();
  const { data, error, reload, retry } = useSectResourceQuery('construction', fetchSectConstruction);
  const { busy, run } = useSectMutation(reload);
  if (error) return <SectQueryError error={error} retry={() => void retry()} />;
  if (!data) return <SectPageLoading message="百业院正在汇总建设账册……" />;
  const sectId = current.data?.definition?.id;
  const facilityLabel = (key: string) =>
    sectId ? getSectFacilityLabel(sectId, key) : key;
  const lockedFacilities = sectId
    ? getSectPresentation(sectId).lockedFacilities
    : [];
  return (
    <SectScene title="百业院" description="梁木、阵图与工程长卷铺满案台，长老已圈定本周工事；宗门所需物资皆按清单入册。" mood="industries" aside={<div className="space-y-2 text-sm leading-7"><p>今日建设贡献：{data.donatedContributionToday} / {data.dailyContributionCap}</p><p>剩余额度：{Math.max(0, data.dailyContributionCap - data.donatedContributionToday)}</p></div>}>
      <section className="bg-slate-800/5 px-4 py-5 [background-image:linear-gradient(rgba(61,74,73,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(61,74,73,.06)_1px,transparent_1px)] [background-size:24px_24px]">
        <h2 className="text-lg font-semibold">本周工程</h2>
        <InkCard className="mt-3" highlighted>
          {data.project ? <><div className="flex items-start justify-between gap-3"><strong>{facilityLabel(data.project.facilityKey)}升至 {data.project.targetLevel} 级</strong><span className="text-crimson text-sm">{Math.floor((data.project.progress / data.project.target) * 100)}%</span></div><p className="mt-2 text-sm">{data.project.progress.toLocaleString()} / {data.project.target.toLocaleString()} 建设点</p><div className="bg-ink/10 mt-3 h-2"><div className="bg-crimson h-full transition-[width]" style={{ width: `${Math.min(100, (data.project.progress / data.project.target) * 100)}%` }} /></div></> : <><strong>长老工程待启</strong><p className="text-ink-secondary mt-2 text-sm">提交首笔有效建设捐献时，将按本周优先级原子开启工程。</p></>}
        </InkCard>
      </section>

      <section className="border-y border-slate-900/10 py-5">
        <h2 className="text-lg font-semibold">设施总览</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.facilities.map((facility) => <InkCard key={facility.key} padding="sm" className="mb-0"><div className="flex items-center justify-between"><strong>{facilityLabel(facility.key)}</strong><span className="text-crimson">{lockedFacilities.includes(facility.key) ? '锁定' : `${facility.level}级`}</span></div></InkCard>)}
        </div>
      </section>

      <section className="bg-white/25 px-4 py-5">
        <h2 className="text-lg font-semibold">今日长老需求</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {data.demands.map((demand) => <DonationCard key={demand.id} demand={demand} busy={busy} capRemaining={data.dailyContributionCap - data.donatedContributionToday} run={run} />)}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold">近期建设动态</h2>
        {data.recentActivity.length ? <ul className="mt-3 space-y-2 text-sm leading-6">{data.recentActivity.map((item) => <li key={item.id} className="border-ink/15 border-b border-dashed pb-2"><strong>{item.memberName}</strong> 完成一笔「{item.demandId}」捐献，宗门建设 +{item.constructionPoints}，个人贡献 +{item.contribution}<time className="text-ink-secondary ml-2 text-xs">{new Date(item.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</time></li>)}</ul> : <p className="text-ink-secondary mt-3 text-sm">尚无建设记录，第一笔捐献将记入此册。</p>}
      </section>
    </SectScene>
  );
}

function DonationCard({ demand, busy, capRemaining, run }: { demand: SectDonationDemandData; busy: boolean; capRemaining: number; run: <T>(url: string, init: RequestInit, message: string) => Promise<T | undefined> }) {
  const inventory = useInventorySnapshot();
  const products = useProductsSnapshot();
  const [itemId, setItemId] = useState('');
  const options = demand.kind === 'material'
    ? inventory.materials.filter((item): item is typeof item & { id: string } => Boolean(item.id)).map((item) => ({ id: item.id, label: `${item.name} · ${item.rank} · ${item.quantity}份` }))
    : demand.kind === 'pill'
      ? inventory.consumables.filter((item): item is typeof item & { id: string } => Boolean(item.id)).map((item) => ({ id: item.id, label: `${item.name} · ${item.quality} · ${item.quantity}枚` }))
      : demand.kind === 'artifact'
        ? products.artifacts.filter((item): item is typeof item & { id: string } => Boolean(item.id) && !item.isEquipped).map((item) => ({ id: item.id, label: `${item.name} · ${item.quality}` }))
        : [];
  const needsItem = demand.kind !== 'spirit_stones';
  return <InkCard><div className="flex items-start justify-between gap-3"><strong>{demand.name}</strong><span className="text-crimson text-sm">+{demand.contribution} 贡献</span></div><p className="text-ink-secondary mt-2 text-sm leading-6">{demand.description}</p><p className="mt-2 text-xs">同时增加 {demand.constructionPoints} 建设点</p>{needsItem ? <InkSelect className="mt-3" label="选择捐献物" value={itemId} onChange={setItemId}><option value="">请选择</option>{options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</InkSelect> : null}<InkButton variant="primary" disabled={busy || capRemaining < demand.contribution || (needsItem && !itemId)} onClick={() => void run('/api/sects/current/construction/donate', postJson({ demandId: demand.id, itemId: itemId || undefined, quantity: 1 }), '建设捐献已入账')}>{capRemaining < demand.contribution ? '今日额度不足' : '捐献一份'}</InkButton></InkCard>;
}

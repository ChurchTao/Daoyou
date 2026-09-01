import { GameSceneFrame, GameSceneLoading, GameSceneNote } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkCard, InkNotice, InkSelect } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Resource = { id: string; name: string; kind: string; quality: string; quantity: number };
type Method = { id: string; name: string; description: string; resourceKind: string; baseCost: number; cost: { amount: number; spiritStones: number } };
type Plot = {
  index: number;
  plant: null | { seedName: string; seedDescription: string; clues: string[]; quality: string; element: string };
  status: 'empty' | 'awaiting_cultivation' | 'growing' | 'ready_to_harvest';
  stage: 'germination' | 'nourishing' | 'forming' | null;
  progress: number;
  remainingMs: number;
  stageStartedAt: string | null;
  stageEndsAt: string | null;
  methods: Method[];
  history: Array<{ stage: string; method: string; affinity: string; feedback: string; resourceName?: string }>;
};
type Snapshot = {
  profile: { successfulHarvestCount: number; starterClaimed: boolean };
  player: { realm: string; spiritStones: number; qi: number; qiMax: number; mp: number; mpMax: number };
  plots: Plot[];
  seeds: Array<{ materialId: string; name: string; description: string | null; quantity: number; quality: string; element: string | null; minRealm: string; canPlant: boolean; clues: string[] }>;
  resources: Resource[];
};
type Envelope<T> = { success: boolean; data?: T; result?: T; error?: string; message?: string };

const stageNames = { germination: '萌芽期', nourishing: '蕴灵期', forming: '成型期' } as const;
const statusText = { empty: '空田', awaiting_cultivation: '静候施为', growing: '生长中', ready_to_harvest: '待摘取' } as const;
const affinityNames: Record<string, string> = { excellent: '天性相合', good: '灵机相契', neutral: '平稳承纳', strained: '灵机滞涩' };
function requestId(prefix: string) { return `${prefix}:${crypto.randomUUID()}`; }
function duration(ms: number) { const minutes = Math.max(1, Math.ceil(ms / 60_000)); return minutes < 60 ? `约 ${minutes} 分钟` : `约 ${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}`; }
async function readSnapshot(): Promise<Snapshot> {
  const response = await fetch('/api/spirit-field', { cache: 'no-store' });
  const payload = await response.json() as Envelope<Snapshot>;
  if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || payload.message || '洞府灵田暂时无法查看');
  return payload.data;
}

export default function SpiritFieldPage() {
  const { mutate } = useResourceMutation();
  const { pushToast, openDialog } = useInkUI();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [resourceByMethod, setResourceByMethod] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const refresh = useCallback(async () => {
    try { setSnapshot(await readSnapshot()); setError(null); }
    catch (next) { setError(next instanceof Error ? next.message : '洞府灵田暂时无法查看'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void readSnapshot()
      .then((data) => {
        if (!active) return;
        setSnapshot(data);
        setNow(Date.now());
        setError(null);
      })
      .catch((next: unknown) => {
        if (!active) return;
        setError(
          next instanceof Error ? next.message : '洞府灵田暂时无法查看',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const selected = snapshot?.plots[selectedIndex] ?? null;
  const usableSeeds = useMemo(() => snapshot?.seeds.filter((seed) => seed.quantity > 0) ?? [], [snapshot]);
  const mutateField = useCallback(async <T,>(url: string, body: unknown): Promise<T | null> => {
    setBusy(true);
    try {
      const result = await mutate<T>(fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      await refresh();
      return result;
    } catch (next) { pushToast({ message: next instanceof Error ? next.message : '灵田操作失败', tone: 'danger' }); return null; }
    finally { setBusy(false); }
  }, [mutate, pushToast, refresh]);

  const cultivate = async (method: Method) => {
    if (!selected) return;
    const result = await mutateField<{ methodName: string; feedback: string; affinity: string; durationMs: number }>('/api/spirit-field/cultivate', { plotIndex: selected.index, method: method.id, resourceId: resourceByMethod[method.id] || undefined, requestId: requestId('cultivate') });
    if (!result) return;
    openDialog({ title: `${result.methodName} · ${affinityNames[result.affinity] ?? '灵机已动'}`, content: <div className="space-y-2 text-sm leading-7"><p>{result.feedback}</p><p className="text-ink-secondary">本阶段预计需要{duration(result.durationMs)}。阶段结束前无需重复操作。</p></div>, confirmLabel: '记下变化', onConfirm: async () => undefined });
  };
  const harvest = async () => {
    if (!selected) return;
    const result = await mutateField<{ name: string; description: string; outcomeKind: string; quality: string; quantity: number; mutated: boolean; degraded: boolean }>('/api/spirit-field/harvest', { plotIndex: selected.index, requestId: requestId('harvest') });
    if (!result) return;
    openDialog({ title: `${result.name} · ${result.quality}`, content: <div className="space-y-2 text-sm leading-7"><p>{result.description}</p><p className="text-ink-secondary">收获 ×{result.quantity}{result.mutated ? '，造化升品' : result.degraded ? '，灵韵稍退' : ''}</p></div>, confirmLabel: '收入囊中', onConfirm: async () => undefined });
  };

  if (loading) return <GameSceneLoading message="正推开洞府药圃的竹门……" />;
  if (!snapshot) return <GameSceneFrame variant="workflow"><InkNotice tone="warning">{error}</InkNotice><InkButton onClick={() => void refresh()}>再看看</InkButton></GameSceneFrame>;

  return (
    <GameSceneFrame
      variant="workflow"
      headerMeta={<div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-secondary"><span>境界：{snapshot.player.realm}</span><span>天地灵气：{snapshot.player.qi}/{snapshot.player.qiMax}</span><span>法力：{snapshot.player.mp}/{snapshot.player.mpMax}</span><span>成功收获：{snapshot.profile.successfulHarvestCount}</span></div>}
      aside={<div className="space-y-3 text-sm leading-6"><p className="text-ink-secondary">储物袋中的灵种只显露些许天性，真正形态要等三度造化走完才会揭晓。</p>{!snapshot.profile.starterClaimed ? <InkButton disabled={busy} onClick={() => void mutateField('/api/spirit-field/starter', {})} variant="primary">领取初始灵种</InkButton> : usableSeeds.length ? usableSeeds.map((seed) => <div key={seed.materialId} className="flex justify-between gap-3"><span>{seed.name} · {seed.quality}</span><span>×{seed.quantity}</span></div>) : <span className="text-ink-secondary">暂无灵种。</span>}</div>}
    >
      {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
      <InkCard padding="lg" className="space-y-3">
        <p className="text-sm text-ink-secondary">六畦灵土皆已开垦。选中一畦，完成当前阶段唯一一次培育选择；错过操作时，灵植会停在原处等你归来。</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {snapshot.plots.map((plot) => {
            const remaining = plot.stageEndsAt ? Math.max(0, Date.parse(plot.stageEndsAt) - now) : plot.remainingMs;
            const liveProgress = plot.stageStartedAt && plot.stageEndsAt
              ? Math.max(0, Math.min(1, (now - Date.parse(plot.stageStartedAt)) / Math.max(1, Date.parse(plot.stageEndsAt) - Date.parse(plot.stageStartedAt))))
              : plot.progress;
            const active = plot.index === selectedIndex;
            return <button key={plot.index} type="button" onClick={() => setSelectedIndex(plot.index)} className={`min-h-28 border p-3 text-left ${active ? 'border-crimson bg-crimson/5' : 'border-ink/15 hover:border-crimson/45'}`}>
              <div className="flex justify-between text-xs text-ink-secondary"><span>第 {plot.index + 1} 畦</span><span>{statusText[plot.status]}</span></div>
              <div className="mt-3 font-medium">{plot.plant?.seedName ?? '空田'}</div>
              {plot.stage ? <div className="mt-1 text-xs text-ink-secondary">{stageNames[plot.stage]}{plot.status === 'growing' ? ` · ${duration(remaining)}` : ''}</div> : null}
              {plot.status === 'growing' ? <div className="bg-ink/10 mt-3 h-1.5"><div className="h-full bg-crimson" style={{ width: `${Math.round(liveProgress * 100)}%` }} /></div> : null}
            </button>;
          })}
        </div>
      </InkCard>

      {selected ? <InkCard padding="lg" className="space-y-4">
        {!selected.plant ? <div className="space-y-3"><p className="text-sm text-ink-secondary">选择一枚灵种播下。种子的隐秘习性不会直接公开。</p>{usableSeeds.length ? <div className="grid gap-3 sm:grid-cols-2">{usableSeeds.map((seed) => <button key={seed.materialId} type="button" disabled={busy || !seed.canPlant} onClick={() => void mutateField('/api/spirit-field/sow', { plotIndex: selected.index, seedMaterialId: seed.materialId })} className="border-ink/15 hover:border-crimson/45 disabled:opacity-50 border p-3 text-left"><div className="flex justify-between"><span>{seed.name}</span><span>×{seed.quantity}</span></div><div className="mt-1 text-xs text-ink-secondary">{seed.quality} · {seed.element} · {seed.canPlant ? '可播种' : `需${seed.minRealm}`}</div><div className="mt-2 text-xs leading-5 text-ink-secondary">{seed.clues.join('；')}</div></button>)}</div> : <InkNotice>暂无可播种灵种。</InkNotice>}</div>
        : <div className="space-y-4">
          <div><div className="font-medium">{selected.plant.seedName} · {selected.plant.quality} · {selected.plant.element}</div><p className="mt-1 text-sm leading-6 text-ink-secondary">{selected.plant.seedDescription}</p><p className="mt-1 text-xs leading-5 text-ink-secondary">{selected.plant.clues.join('；')}</p></div>
          {selected.history.length ? <div className="space-y-2 border-ink/15 border-t border-dashed pt-3">{selected.history.map((item) => <div key={item.stage}><div className="text-xs text-crimson">{stageNames[item.stage as keyof typeof stageNames]} · {affinityNames[item.affinity] ?? '灵机已动'}</div><p className="text-sm leading-6 text-ink-secondary">{item.feedback}</p></div>)}</div> : null}
          {selected.status === 'awaiting_cultivation' ? <div className="space-y-3"><GameSceneNote>灵机已停在{selected.stage ? stageNames[selected.stage] : '当前阶段'}，选定一次培育方式后才会继续生长。</GameSceneNote><div className="grid gap-3 sm:grid-cols-2">{selected.methods.map((method) => {
            const candidates = snapshot.resources.filter((resource) => resource.kind === method.resourceKind);
            const needsItem = ['herb', 'ore', 'monster', 'tcdb', 'aux', 'pill'].includes(method.resourceKind);
            const selectedResource = resourceByMethod[method.id] ?? '';
            const costText = method.resourceKind === 'none' ? '无需额外资源' : method.resourceKind === 'qi' ? `天地灵气 ${method.cost.amount}` : method.resourceKind === 'mp' ? `法力 ${method.cost.amount}` : method.resourceKind === 'spirit_stones' ? `灵石 ${method.cost.amount}` : `${method.cost.amount} 份所选物品${method.cost.spiritStones ? ` + 灵石 ${method.cost.spiritStones}` : ''}`;
            return <div key={method.id} className="border-ink/15 space-y-3 border p-3"><div><div className="font-medium">{method.name}</div><p className="mt-1 text-xs leading-5 text-ink-secondary">{method.description}</p></div>{needsItem ? <InkSelect value={selectedResource} onChange={(value) => setResourceByMethod((current) => ({ ...current, [method.id]: value }))}><option value="">选择投入物</option>{candidates.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {resource.quality} ×{resource.quantity}</option>)}</InkSelect> : null}<InkButton variant="primary" disabled={busy || (needsItem && !selectedResource)} onClick={() => void cultivate(method)}>确认施为 · {costText}</InkButton></div>;
          })}</div></div> : null}
          {selected.status === 'growing' ? <GameSceneNote>这一阶段正在自行生长，无需反复照料。待倒计时结束后再回来决定下一步。</GameSceneNote> : null}
          {selected.status === 'ready_to_harvest' ? <div className="space-y-3"><GameSceneNote>三度造化已定，最终形态不可逆转。采摘后才会揭晓它成为灵草、天材地宝还是灵果。</GameSceneNote><InkButton variant="primary" disabled={busy} onClick={() => void harvest()}>采摘造化产物</InkButton></div> : null}
        </div>}
      </InkCard> : null}
    </GameSceneFrame>
  );
}

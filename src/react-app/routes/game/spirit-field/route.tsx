import { VaultWithdrawal } from '@app/components/feature/forging/VaultWithdrawal';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { GameSceneFrame, GameSceneLoading } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useResourceMutation } from '@app/lib/resources/mutations';
import type { InventoryView } from '@shared/contracts/inventory';
import { useCallback, useEffect, useRef, useState } from 'react';

type Resource = {
  id: string;
  revision: number;
  name: string;
  kind: string;
  quality: string;
  quantity: number;
};
type Method = {
  id: string;
  name: string;
  description: string;
  resourceKind: string;
  baseCost: number;
  cost: { amount: number; spiritStones: number };
};
type Plot = {
  index: number;
  plant: null | {
    seedName: string;
    seedDescription: string;
    clues: string[];
    quality: string;
    element: string;
  };
  status: 'empty' | 'awaiting_cultivation' | 'growing' | 'ready_to_harvest';
  stage: 'germination' | 'nourishing' | 'forming' | null;
  progress: number;
  remainingMs: number;
  stageStartedAt: string | null;
  stageEndsAt: string | null;
  methods: Method[];
  history: Array<{
    stage: string;
    method: string;
    affinity: string;
    feedback: string;
    resourceName?: string;
  }>;
};
type Snapshot = {
  profile: { successfulHarvestCount: number; starterClaimed: boolean };
  player: {
    realm: string;
    spiritStones: number;
    qi: number;
    qiMax: number;
    mp: number;
    mpMax: number;
  };
  plots: Plot[];
  seeds: Array<{
    materialId: string;
    revision: number;
    name: string;
    description: string | null;
    quantity: number;
    quality: string;
    element: string | null;
    minRealm: string;
    canPlant: boolean;
    clues: string[];
  }>;
  resources: Resource[];
};

const stageNames = {
  germination: '萌芽期',
  nourishing: '蕴灵期',
  forming: '成型期',
} as const;
const statusText = {
  empty: '空田',
  awaiting_cultivation: '静候施为',
  growing: '生长中',
  ready_to_harvest: '待摘取',
} as const;
const affinityNames: Record<string, string> = {
  excellent: '天性相合',
  good: '灵机相契',
  neutral: '平稳承纳',
  strained: '灵机滞涩',
};
function requestId(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}
function duration(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes < 60
    ? `约 ${minutes} 分钟`
    : `约 ${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}`;
}

export default function SpiritFieldPage() {
  const { mutate } = useResourceMutation();
  const { pushToast, openDialog } = useInkUI();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const bagQuery = useInventoryBag();
  const bag = bagQuery.data;
  const bagUnavailable = !bag || bagQuery.isRefreshing || !!bagQuery.error;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [methodId, setMethodId] = useState('');
  const [chosenRef, setChosenRef] = useState<{
    id: string;
    revision: number;
  }>();
  const [bagOpen, setBagOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const pending = useRef(false);
  const attempt = useRef<{ key: string; id: string } | undefined>(undefined);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/spirit-field');
      const field = await response.json();
      if (!response.ok) throw new Error(field.error ?? '灵田读取失败');
      setSnapshot(field.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '灵田读取失败');
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => {
      if (!pending.current) void refresh();
    }, 15000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const selected = snapshot?.plots[selectedIndex];
  const method = selected?.methods.find((m) => m.id === methodId);
  const chosen = bag?.items.find(
    (i) => i.id === chosenRef?.id && i.revision === chosenRef.revision,
  );
  const seed = snapshot?.seeds.find(
    (i) => i.materialId === chosen?.id && i.revision === chosen.revision,
  );
  const resource = snapshot?.resources.find(
    (i) => i.id === chosen?.id && i.revision === chosen.revision,
  );
  const needsItem =
    !!method &&
    ['herb', 'ore', 'monster', 'tcdb', 'aux', 'pill'].includes(
      method.resourceKind,
    );
  async function act(url: string, body: Record<string, unknown>) {
    if (pending.current || (chosenRef && bagUnavailable)) return;
    pending.current = true;
    setBusy(true);
    const key = JSON.stringify([url, body]);
    if (attempt.current?.key !== key)
      attempt.current = { key, id: requestId('field') };
    try {
      const result = await mutate<{
        message?: string;
        name?: string;
        description?: string;
        quantity?: number;
        quality?: string;
        locations?: string[];
        methodName?: string;
        feedback?: string;
        affinity?: string;
        durationMs?: number;
      }>(
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, requestId: attempt.current.id }),
        }),
      );
      attempt.current = undefined;
      setChosenRef(undefined);
      await refresh();
      const destination = result.locations
        ?.map((v) => (v === 'bag' ? '随身物品' : '储藏室'))
        .join('、');
      if (result.feedback)
        openDialog({
          title: result.methodName ?? '培育完成',
          content: (
            <div className="space-y-2 text-sm leading-6">
              <p>{result.feedback}</p>
              <p>
                {affinityNames[result.affinity ?? '']} ·{' '}
                {duration(result.durationMs ?? 0)}
              </p>
            </div>
          ),
          confirmLabel: '记下变化',
          onConfirm: async () => undefined,
        });
      else if (result.name)
        openDialog({
          title: result.name,
          content: (
            <div className="space-y-2 text-sm">
              <p>{result.description}</p>
              <p>
                {result.quality} · 收获{' '}
                <span className="font-mono">{result.quantity}</span> 份 ·{' '}
                {destination}
              </p>
            </div>
          ),
          confirmLabel: '收好',
          onConfirm: async () => undefined,
        });
      else
        pushToast({
          message:
            (result.message ?? '已完成') +
            (destination ? ' · ' + destination : ''),
          tone: 'success',
        });
    } catch (e) {
      bagQuery.invalidate();
      pushToast({
        message: e instanceof Error ? e.message : '灵田操作失败',
        tone: 'danger',
      });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function canChoose(item: InventoryView['items'][number]) {
    if (!selected) return false;
    return !selected.plant
      ? snapshot?.seeds.some(
          (s) =>
            s.materialId === item.id &&
            s.revision === item.revision &&
            s.canPlant,
        )
      : selected.status === 'awaiting_cultivation' &&
          needsItem &&
          snapshot?.resources.some(
            (r) =>
              r.id === item.id &&
              r.revision === item.revision &&
              r.kind === method?.resourceKind &&
              r.quantity >= method.cost.amount,
          );
  }
  function choose(item: InventoryView['items'][number]) {
    if (pending.current || bagUnavailable || !selected) return;
    const allowed = canChoose(item);
    if (!allowed) {
      pushToast({
        message: !selected.plant
          ? '请选择境界允许的随身灵种'
          : '先选择培育方式，再选择足量的对应道具',
        tone: 'warning',
      });
      return;
    }
    setChosenRef({ id: item.id, revision: item.revision });
    setBagOpen(false);
  }
  if (!snapshot && !error)
    return <GameSceneLoading message="正推开洞府药圃的竹门……" />;
  if (!snapshot)
    return (
      <GameSceneFrame variant="workflow">
        <InkNotice tone="warning">{error}</InkNotice>
        <InkButton
          onClick={() => {
            void bagQuery.reload();
            void refresh();
          }}
        >
          重试
        </InkButton>
      </GameSceneFrame>
    );
  const inventory = (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span>
          随身物品 <span className="font-mono">{bag?.used ?? '—'} / 40</span>
        </span>
        <InkButton
          disabled={busy}
          onClick={() => {
            void bagQuery.reload();
            void refresh();
          }}
        >
          刷新
        </InkButton>
      </div>
      {bagQuery.error ? (
        <InkNotice tone="warning">{bagQuery.error}</InkNotice>
      ) : null}
      <InventoryItems
        items={bag?.items ?? []}
        slotProps={(item) => ({
          disabled: !item || busy || bagUnavailable,
          selected: !!item && item.id === chosen?.id,
          badge: item && canChoose(item) ? '可选' : undefined,
          onQuickAction:
            item && canChoose(item) ? () => choose(item) : undefined,
          children: item
            ? (close) => (
                <>
                  {!canChoose(item) ? (
                    <p className="text-ink-secondary">
                      此物不符合当前播种或培育要求，请选择对应道具。
                    </p>
                  ) : null}
                  <InkButton
                    disabled={busy || bagUnavailable || !canChoose(item)}
                    onClick={() => {
                      choose(item);
                      close();
                    }}
                  >
                    投入
                  </InkButton>
                </>
              )
            : undefined,
        })}
      />
      <VaultWithdrawal onChanged={() => void refresh()} />
    </div>
  );
  return (
    <GameSceneFrame variant="workflow">
      {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink-secondary text-sm">
          成功收获{' '}
          <span className="font-mono">
            {snapshot.profile.successfulHarvestCount}
          </span>{' '}
          次
        </span>
        <div className="flex gap-2">
          {!snapshot.profile.starterClaimed ? (
            <InkButton
              disabled={busy}
              onClick={() => void act('/api/spirit-field/starter', {})}
            >
              领取初始灵种
            </InkButton>
          ) : null}
          <InkButton className="lg:hidden" onClick={() => setBagOpen(true)}>
            随身物品
          </InkButton>
        </div>
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-5" aria-label="灵田">
          <div className="grid grid-cols-3 gap-2">
            {snapshot.plots.map((plot) => (
              <button
                key={plot.index}
                type="button"
                disabled={busy}
                aria-pressed={selectedIndex === plot.index}
                className={`min-h-24 p-3 text-left text-sm transition-colors ${selectedIndex === plot.index ? 'bg-crimson/8' : 'bg-ink/4 hover:bg-ink/8'}`}
                onClick={() => {
                  if (pending.current) return;
                  setSelectedIndex(plot.index);
                  setMethodId('');
                  setChosenRef(undefined);
                }}
              >
                <span className="block">第 {plot.index + 1} 畦</span>
                <span className="mt-2 block text-xs">
                  {plot.plant?.seedName ?? '待播种'}
                </span>
                <span className="text-ink-secondary mt-1 block text-xs">
                  {statusText[plot.status]}
                </span>
              </button>
            ))}
          </div>
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span>{selected.plant?.seedName ?? '播种灵种'}</span>
                <span className="text-ink-secondary text-xs">
                  {selected.stage ? stageNames[selected.stage] : '空田'}
                </span>
              </div>
              {selected.plant ? (
                <p className="text-ink-secondary text-sm leading-6">
                  {selected.plant.seedDescription}
                </p>
              ) : null}
              {selected.plant?.clues.length ? (
                <p className="text-ink-secondary text-xs leading-5">
                  {selected.plant.clues.join('；')}
                </p>
              ) : null}
              {selected.status === 'awaiting_cultivation' ? (
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="培育方式"
                >
                  {selected.methods.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      disabled={busy}
                      aria-pressed={methodId === entry.id}
                      className={`px-3 py-2 text-sm ${methodId === entry.id ? 'bg-crimson/8 text-crimson' : 'bg-ink/4'}`}
                      onClick={() => {
                        setMethodId(entry.id);
                        setChosenRef(undefined);
                      }}
                    >
                      {entry.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {method && selected.status === 'awaiting_cultivation' ? (
                <p className="text-ink-secondary text-xs leading-5">
                  {method.description}
                </p>
              ) : null}
              {!selected.plant ||
              (selected.status === 'awaiting_cultivation' && needsItem) ? (
                <div className="flex items-center gap-4">
                  <div className="w-20">
                    <ItemSlot
                      item={chosen}
                      emptyLabel={!selected.plant ? '选择灵种' : '选择投入物'}
                      disabled={busy}
                      onQuickAction={() => setBagOpen(true)}
                    >
                      {(close) => (
                        <InkButton
                          onClick={() => {
                            setChosenRef(undefined);
                            close();
                          }}
                        >
                          移出
                        </InkButton>
                      )}
                    </ItemSlot>
                  </div>
                  <span className="text-ink-secondary text-sm">
                    {chosen
                      ? `投入 ${!selected.plant ? 1 : method?.cost.amount} 份`
                      : '从随身物品中选择'}
                  </span>
                </div>
              ) : null}
              {!selected.plant ? (
                <InkButton
                  variant="primary"
                  disabled={busy || !seed?.canPlant}
                  onClick={() =>
                    void act('/api/spirit-field/sow', {
                      plotIndex: selected.index,
                      seedMaterialId: seed?.materialId,
                      revision: seed?.revision,
                    })
                  }
                >
                  播种
                </InkButton>
              ) : null}
              {selected.status === 'awaiting_cultivation' && method ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-ink-secondary text-sm">
                    {needsItem
                      ? ''
                      : method.resourceKind === 'none'
                        ? '无需消耗'
                        : `${({ qi: '天地灵气', mp: '法力', spirit_stones: '灵石' } as Record<string, string>)[method.resourceKind]} ${method.cost.amount}`}
                    {method.cost.spiritStones
                      ? `灵石 ${method.cost.spiritStones}`
                      : ''}
                  </span>
                  <InkButton
                    variant="primary"
                    disabled={
                      busy ||
                      (needsItem &&
                        (!resource ||
                          resource.kind !== method.resourceKind ||
                          resource.quantity < method.cost.amount))
                    }
                    onClick={() =>
                      void act('/api/spirit-field/cultivate', {
                        plotIndex: selected.index,
                        method: method.id,
                        resourceId: needsItem ? chosen?.id : undefined,
                        resourceRevision: needsItem
                          ? chosen?.revision
                          : undefined,
                      })
                    }
                  >
                    确认施为
                  </InkButton>
                </div>
              ) : null}
              {selected.status === 'growing' ? (
                <p className="text-ink-secondary text-sm">
                  生长中 ·{' '}
                  {duration(
                    Math.max(
                      0,
                      new Date(selected.stageEndsAt!).getTime() - now,
                    ),
                  )}
                </p>
              ) : null}
              {selected.status === 'ready_to_harvest' ? (
                <InkButton
                  variant="primary"
                  disabled={busy || bagUnavailable}
                  onClick={() =>
                    void act('/api/spirit-field/harvest', {
                      plotIndex: selected.index,
                    })
                  }
                >
                  收获
                </InkButton>
              ) : null}
              {selected.history.length ? (
                <details className="text-sm">
                  <summary className="text-ink-secondary cursor-pointer">
                    培育记录
                  </summary>
                  <div className="mt-3 space-y-3">
                    {selected.history.map((entry) => (
                      <div key={entry.stage}>
                        <p>
                          {stageNames[entry.stage as keyof typeof stageNames]} ·{' '}
                          {affinityNames[entry.affinity]}
                        </p>
                        <p className="text-ink-secondary mt-1 leading-6">
                          {entry.feedback}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
        </section>
        <section className="hidden min-w-0 lg:block" aria-label="角色物品">
          {inventory}
        </section>
      </div>
      <InkDetailDrawer
        isOpen={bagOpen}
        onClose={() => setBagOpen(false)}
        title="随身物品"
        size="sm"
      >
        {inventory}
      </InkDetailDrawer>
    </GameSceneFrame>
  );
}

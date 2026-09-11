import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import {
  InventoryGrid,
  ItemSlot,
} from '@app/components/feature/items/ItemSlot';
import { GameSceneFrame } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkDialog, type InkDialogState } from '@app/components/ui/InkDialog';
import { useInventoryBag } from '@app/lib/resources/bag';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorCurrency,
  usePlayerSession,
} from '@app/lib/resources/player';
import type {
  MarketBuyInput,
  MarketPurchaseResult,
} from '@shared/contracts/market';
import {
  getMarketNodeSwitchOptions,
  resolveMarketSwitchLayer,
} from '@shared/lib/game/marketConfig';
import { formatCompactGameNumber } from '@shared/lib/numberFormat';
import type { MarketAccessState, MarketListing } from '@shared/types/market';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

const nodes = getMarketNodeSwitchOptions();
const regions = [...new Set(nodes.map((node) => node.region))];
const layers = [
  { label: '凡市', value: 'common' },
  { label: '珍宝阁', value: 'treasure' },
  { label: '天宝殿', value: 'heaven' },
];
type Snapshot = {
  listings: MarketListing[];
  nextRefresh: number;
  access: MarketAccessState;
  marketFlavor: { title: string; description: string } | null;
};
async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? '暂时无法读取');
  return (body.data ?? body) as T;
}
export default function MarketPage() {
  const [params, setParams] = useSearchParams();
  const nodeId = params.get('nodeId') || 'TN_YUE_01';
  const layer = layers.some((item) => item.value === params.get('layer'))
    ? (params.get('layer') as MarketBuyInput['layer'])
    : 'common';
  const owner = usePlayerSession().data?.activeCultivator?.id;
  const currency = useCultivatorCurrency().data?.spiritStones;
  // Changing owner or shelf unmounts the workspace, including stale selections and responses.
  return (
    <MarketWorkspace
      key={`${owner}:${nodeId}:${layer}`}
      owner={owner}
      nodeId={nodeId}
      layer={layer}
      currency={currency}
      onNavigate={(node, nextLayer) =>
        setParams({ nodeId: node, layer: nextLayer })
      }
    />
  );
}

function MarketWorkspace({
  owner,
  nodeId,
  layer,
  currency,
  onNavigate,
}: {
  owner?: string;
  nodeId: string;
  layer: MarketBuyInput['layer'];
  currency?: number;
  onNavigate(node: string, layer: string): void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const bagQuery = useInventoryBag(!!owner);
  const bag = bagQuery.data;
  const [selected, setSelected] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [shelfError, setShelfError] = useState('');
  const bagError = bagQuery.error;
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [now, setNow] = useState(Date.now);
  const busy = useRef(false);
  const attempt = useRef<{ key: string; input: MarketBuyInput } | null>(null);
  const currentNode = nodes.find((node) => node.id === nodeId);
  const listings = snapshot?.listings ?? [];
  const picked = listings.filter(
    (item) => selected.includes(item.id) && item.quantity > 0,
  );
  const total = picked.reduce((sum, item) => sum + item.price, 0);
  const expired = !!snapshot && now >= snapshot.nextRefresh;
  const locked = pending || !snapshot?.access.allowed || expired;
  const insufficient = currency !== undefined && total > currency;
  useEffect(() => {
    const controller = new AbortController();
    void read<Snapshot>(
      `/api/market/${nodeId}?layer=${layer}`,
      controller.signal,
    )
      .then((value) => {
        if (controller.signal.aborted) return;
        setSnapshot(value);
        setSelected((previous) =>
          previous.filter((id) =>
            value.listings.some((item) => item.id === id && item.quantity > 0),
          ),
        );
        setShelfError('');
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setShelfError(reason.message);
      });
    return () => controller.abort();
  }, [nodeId, layer, refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!snapshot) return;
    const timer = setTimeout(
      () => {
        if (!busy.current) setRefresh((value) => value + 1);
      },
      Math.max(5000, snapshot.nextRefresh - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [snapshot, refresh, pending]);
  function toggle(item: MarketListing) {
    if (busy.current || locked || item.quantity <= 0) return;
    setSelected((previous) =>
      previous.includes(item.id)
        ? previous.filter((id) => id !== item.id)
        : [...previous, item.id],
    );
    setNotice('');
  }
  async function buy() {
    if (busy.current || locked || !picked.length || insufficient) return;
    const key = JSON.stringify([picked.map((item) => item.id).sort(), total]);
    if (attempt.current?.key !== key)
      attempt.current = {
        key,
        input: {
          requestId: crypto.randomUUID(),
          layer,
          expectedTotal: total,
          items: picked.map((item) => ({ listingId: item.id, quantity: 1 })),
        },
      };
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const result = await consumeResourceMutation<MarketPurchaseResult>(
        await fetch(`/api/market/${nodeId}/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attempt.current.input),
        }),
      );
      const labels = {
        bag: '随身物品栏',
        storage: '储藏室',
        vault: '洞府宝库（种子）',
      };
      setNotice(
        (['bag', 'storage', 'vault'] as const)
          .flatMap((location) => {
            const count = result.deliveries.filter(
              (item) => item.location === location,
            ).length;
            return count ? [`${count} 件已收入${labels[location]}`] : [];
          })
          .join('；'),
      );
      setSelected([]);
      attempt.current = null;
      setSnapshot(
        (previous) =>
          previous && {
            ...previous,
            listings: previous.listings.map((item) =>
              result.deliveries.some(
                (delivery) => delivery.listingId === item.id,
              )
                ? { ...item, quantity: 0 }
                : item,
            ),
          },
      );
      setRefresh((value) => value + 1);
    } catch (reason) {
      bagQuery.invalidate();
      setError(reason instanceof Error ? reason.message : '成交未确认，请重试');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function confirmBuy() {
    if (total > 100000) {
      setDialog({
        id: 'market-purchase',
        title: '高额交易确认',
        content: (
          <p>
            确认购买所选 {picked.length} 件商品？
            <span className="font-mono"> {total} </span>灵石将用于本次交易。
          </p>
        ),
        confirmLabel: '确认购买',
        cancelLabel: '再看看',
        onConfirm: buy,
      });
    } else void buy();
  }
  function refreshShelf() {
    if (busy.current) return;
    setSelected([]);
    setRefresh((value) => value + 1);
  }
  const inventory = (
    <div className="space-y-3" aria-label="随身物品栏">
      <div className="flex min-h-9 items-center justify-between text-sm">
        <span>
          随身物品 <span className="font-mono">{bag?.used ?? '—'} / 40</span>
        </span>
        <InkButton disabled={pending} onClick={() => void bagQuery.reload()}>
          刷新
        </InkButton>
      </div>
      {bagError ? (
        <p role="alert" className="text-crimson text-sm">
          {bagError}
        </p>
      ) : null}
      <InventoryItems
        items={bag?.items ?? []}
        slotProps={(item) => ({ disabled: !item })}
      />
    </div>
  );
  const seconds = Math.max(
    0,
    Math.ceil(((snapshot?.nextRefresh ?? now) - now) / 1000),
  );
  return (
    <GameSceneFrame
      variant="workflow"
      description={
        snapshot?.marketFlavor?.description ?? '四方云集，奇货待价。'
      }
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          aria-label="切换坊市"
          aria-haspopup="dialog"
          aria-expanded={marketOpen}
          disabled={pending}
          className="hover:text-crimson focus-visible:outline-crimson flex min-h-10 min-w-0 items-center gap-2 text-base transition-colors disabled:opacity-50"
          onClick={() => setMarketOpen(true)}
        >
          <span>{currentNode?.name ?? '选择坊市'}</span>
          <span aria-hidden="true" className="text-ink-secondary text-xs">
            ▾
          </span>
        </button>
        <div className="flex gap-3">
          {currentNode?.allowedLayers.includes('black') ? (
            <InkButton
              disabled={pending}
              href={`/game/black-market?nodeId=${encodeURIComponent(nodeId)}`}
            >
              暗巷黑市 <span aria-hidden="true">↗</span>
            </InkButton>
          ) : null}
          <InkButton className="lg:hidden" onClick={() => setBagOpen(true)}>
            随身物品
          </InkButton>
        </div>
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-4" aria-label="坊市商品">
          <div
            className="flex min-h-9 items-center gap-1"
            role="group"
            aria-label="货架层级"
          >
            {layers.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={layer === item.value}
                disabled={pending}
                onClick={() => {
                  if (!busy.current && layer !== item.value)
                    onNavigate(nodeId, item.value);
                }}
                className={`focus-visible:outline-crimson min-h-9 px-3 text-sm transition-colors disabled:opacity-50 ${layer === item.value ? 'bg-crimson/8 text-crimson' : 'text-ink-secondary hover:bg-ink/5 hover:text-ink'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="text-ink-secondary flex items-center justify-between gap-2 text-xs">
            <span>
              {expired ? (
                '货架更新中'
              ) : (
                <>
                  下批货物{' '}
                  <span className="font-mono">
                    {Math.floor(seconds / 60)}:
                    {String(seconds % 60).padStart(2, '0')}
                  </span>
                </>
              )}
            </span>
          </div>
          {snapshot && !snapshot.access.allowed ? (
            <p className="text-ink-secondary text-sm">
              {snapshot.access.reason}
            </p>
          ) : null}
          {shelfError ? (
            <p role="alert" className="text-crimson text-sm">
              {shelfError}
              <InkButton
                className="ml-3"
                disabled={pending}
                onClick={refreshShelf}
              >
                重试
              </InkButton>
            </p>
          ) : null}
          {!snapshot && !shelfError ? (
            <p role="status">掌柜正在盘货……</p>
          ) : null}
          <InventoryGrid className="grid-cols-5 gap-2 sm:grid-cols-5">
            {listings.map((item) => (
              <div key={item.id} className="min-w-0">
                <ItemSlot
                  item={{
                    definitionId:
                      item.type === 'seed' ? 'seed.v1' : 'material.v1',
                    name: item.name,
                    quantity: item.quantity,
                    instanceData: {
                      name: item.name,
                      type: item.type,
                      rank: item.rank,
                      element: item.element ?? null,
                      description: item.description ?? '',
                    },
                  }}
                  className="w-full"
                  quantityLabel="库存"
                  disabled={locked || item.quantity <= 0}
                  selected={selected.includes(item.id) && item.quantity > 0}
                  badge={
                    item.quantity <= 0
                      ? '已购'
                      : selected.includes(item.id)
                        ? '已选'
                        : undefined
                  }
                  onQuickAction={() => toggle(item)}
                >
                  {(close) => (
                    <div className="space-y-2">
                      {item.type === 'seed' ? (
                        <p className="text-ink-secondary">
                          购入后放入物品栏，供灵田播种。
                        </p>
                      ) : null}
                      {item.basePrice && item.basePrice > item.price ? (
                        <p className="text-ink-secondary text-xs">
                          原价{' '}
                          <span className="font-mono line-through">
                            {item.basePrice}
                          </span>{' '}
                          灵石
                        </p>
                      ) : null}
                      <p>
                        售价 <span className="font-mono">{item.price}</span>{' '}
                        灵石 · 本批限购一件
                      </p>
                      <InkButton
                        disabled={locked || item.quantity <= 0}
                        onClick={() => {
                          toggle(item);
                          close();
                        }}
                      >
                        {item.quantity <= 0
                          ? '本批已购'
                          : selected.includes(item.id)
                            ? '取消选择'
                            : '选择商品'}
                      </InkButton>
                    </div>
                  )}
                </ItemSlot>
                <p
                  className="text-ink-secondary mt-1 text-center font-mono text-xs"
                  aria-label={`售价 ${item.price} 灵石`}
                >
                  {formatCompactGameNumber(item.price)}
                </p>
              </div>
            ))}
          </InventoryGrid>
          {snapshot && !listings.length ? (
            <p className="text-ink-secondary text-sm">掌柜正在备货，请稍候。</p>
          ) : null}
          <p className="text-ink-secondary text-xs">
            标价单位为灵石，选择商品后统一购买。
          </p>
        </section>
        <section className="hidden min-w-0 lg:block" aria-label="角色物品">
          {inventory}
        </section>
      </div>
      {error ? (
        <p role="alert" className="text-crimson mt-4 text-sm">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm">
          {notice}
        </p>
      ) : null}
      {picked.length ? (
        <div className="bg-paper border-ink/20 sticky bottom-[var(--game-bottom-offset)] z-20 mt-5 flex flex-wrap items-center justify-between gap-3 border-t py-3 text-sm">
          <span>
            已选 <span className="font-mono">{picked.length}</span> 件 · 合计{' '}
            <strong className="font-mono">{total}</strong> 灵石
          </span>
          <div className="flex items-center gap-3">
            <InkButton disabled={pending} onClick={() => setSelected([])}>
              清空选择
            </InkButton>
            <InkButton
              disabled={locked || insufficient || currency === undefined}
              onClick={confirmBuy}
            >
              {pending ? '正在成交……' : insufficient ? '灵石不足' : '购买所选'}
            </InkButton>
          </div>
        </div>
      ) : null}
      <InkDetailDrawer
        isOpen={marketOpen}
        onClose={() => setMarketOpen(false)}
        title="选择坊市"
        size="sm"
      >
        <div className="space-y-6">
          {regions.map((region) => (
            <section key={region} aria-label={region}>
              <h3 className="text-ink-secondary mb-2 text-xs">{region}</h3>
              <div className="space-y-1">
                {nodes
                  .filter((node) => node.region === region)
                  .map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      aria-pressed={node.id === nodeId}
                      disabled={pending}
                      className={`focus-visible:outline-crimson w-full px-3 py-3 text-left transition-colors ${node.id === nodeId ? 'bg-crimson/8' : 'hover:bg-ink/5'}`}
                      onClick={() => {
                        if (busy.current) return;
                        setMarketOpen(false);
                        if (node.id !== nodeId)
                          onNavigate(
                            node.id,
                            resolveMarketSwitchLayer(node.id, layer),
                          );
                      }}
                    >
                      <span className="flex items-center justify-between gap-2 text-sm">
                        <span>{node.name}</span>
                        {node.id === nodeId ? (
                          <span className="text-crimson text-xs">当前</span>
                        ) : null}
                      </span>
                      <span className="text-ink-secondary mt-1 block text-xs leading-5">
                        {node.summary}
                      </span>
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </InkDetailDrawer>
      <InkDetailDrawer
        isOpen={bagOpen}
        onClose={() => setBagOpen(false)}
        title="储物袋"
        size="sm"
      >
        {inventory}
      </InkDetailDrawer>
      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />
    </GameSceneFrame>
  );
}

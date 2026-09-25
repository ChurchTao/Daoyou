import { InventoryHeader } from '@app/components/feature/items/InventoryHeader';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkModal } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { inventoryBagResource, useInventoryBag } from '@app/lib/resources/bag';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import { resourceStore } from '@app/lib/resources/store';
import type { InventoryView } from '@shared/contracts/inventory';
import type {
  RecycleQuote,
  RecycleResult,
  RecycleSelection,
} from '@shared/contracts/recycle';
import { MAX_RECYCLE_SELECTION } from '@shared/contracts/recycle';
import { recycleBlockingReason } from '@shared/inventory/recycle';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { SeedFactsSchema } from '@shared/items/definitions/seeds';
import { materialFactsOf } from '@shared/items/material';
import { findItemDefinition } from '@shared/items/registry';
import {
  QUALITY_ORDER,
  QUALITY_VALUES,
  type Quality,
} from '@shared/types/constants';
import { useEffect, useRef, useState } from 'react';

type Item = InventoryView['items'][number];
type RecycleCategory =
  | 'all'
  | 'material'
  | 'seed'
  | 'equipment'
  | 'blueprint'
  | 'manual_jade'
  | 'pill'
  | 'fruit';
const categories: { value: RecycleCategory; label: string }[] = [
  { value: 'all', label: '全部可回收' },
  { value: 'material', label: '材料' },
  { value: 'seed', label: '灵种' },
  { value: 'equipment', label: '道装' },
  { value: 'blueprint', label: '道装图纸' },
  { value: 'manual_jade', label: '功法玉简' },
  { value: 'pill', label: '丹药' },
  { value: 'fruit', label: '灵果' },
];
function itemCategory(item: Item): RecycleCategory | undefined {
  const kind = findItemDefinition(item.definitionId)?.kind;
  if (kind === 'consumable') {
    const facts = ConsumableFactsSchema.safeParse(item.instanceData);
    return facts.success
      ? facts.data.spec.kind === 'pill'
        ? 'pill'
        : facts.data.spec.kind === 'spirit_fruit'
          ? 'fruit'
          : undefined
      : undefined;
  }
  return categories.some((entry) => entry.value === kind)
    ? (kind as RecycleCategory)
    : undefined;
}
function itemQuality(item: Item): Quality | undefined {
  if (item.definitionId === 'material.v1')
    return materialFactsOf(item.instanceData).rank;
  if (item.definitionId === 'seed.v1')
    return SeedFactsSchema.parse(item.instanceData).seedSpec.plant.quality;
  if (item.definitionId === 'consumable.v1')
    return ConsumableFactsSchema.parse(item.instanceData).quality;
  return undefined;
}
async function readStorage(signal: AbortSignal): Promise<Item[]> {
  const first = await readJson<InventoryView>(
    '/api/combat-v6/inventory?location=storage&page=0',
    { signal },
  );
  const items = [...first.items];
  for (let page = 1; page < Math.ceil(first.total / 40); page++) {
    const view = await readJson<InventoryView>(
      `/api/combat-v6/inventory?location=storage&page=${page}`,
      { signal },
    );
    items.push(...view.items);
  }
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok || !body.success)
    throw new Error(body.error ?? '暂时无法读取，请稍后再试。');
  return body.data as T;
}
function QuantityChoice({
  item,
  selected,
  disabled,
  choose,
}: {
  item: Item;
  selected?: RecycleSelection;
  disabled: boolean;
  choose(quantity: number): void;
}) {
  const [quantity, setQuantity] = useState(String(selected?.quantity ?? 1));
  const amount = Number(quantity);
  const valid =
    Number.isInteger(amount) && amount >= 1 && amount <= item.quantity;
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !disabled) choose(amount);
      }}
    >
      <label className="flex items-center justify-between gap-3">
        出售份数
        <input
          aria-label={`${item.name}出售份数`}
          className="border-ink/20 w-20 border p-2 font-mono"
          type="number"
          min={1}
          max={item.quantity}
          value={quantity}
          disabled={disabled}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <InkButton type="submit" disabled={disabled || !valid}>
          {selected ? '更新份数' : '加入报价'}
        </InkButton>
        {selected ? (
          <InkButton disabled={disabled} onClick={() => choose(0)}>
            不卖这件
          </InkButton>
        ) : null}
      </div>
    </form>
  );
}

export default function MarketRecyclePage() {
  const owner = usePlayerSession().data?.activeCultivator?.id;
  const bagQuery = useInventoryBag();
  const view = bagQuery.data;
  const [storageRefresh, setStorageRefresh] = useState(0);
  const storageKey = `${owner ?? ''}:${storageRefresh}`;
  const [storageSnapshot, setStorageSnapshot] = useState<{
    key: string;
    items: Item[];
    error?: string;
  }>();
  const storageLoading = !!owner && storageSnapshot?.key !== storageKey;
  const storageItems =
    storageSnapshot?.key === storageKey ? storageSnapshot.items : [];
  const storageError =
    storageSnapshot?.key === storageKey ? (storageSnapshot.error ?? '') : '';
  const [location, setLocation] = useState<'bag' | 'storage'>('bag');
  const [storagePage, setStoragePage] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSource, setFilterSource] = useState<'all' | 'bag' | 'storage'>(
    'all',
  );
  const [filterCategory, setFilterCategory] = useState<RecycleCategory>('all');
  const [filterQuality, setFilterQuality] = useState<Quality | 'all'>('all');
  const [filterName, setFilterName] = useState('');
  const [onePerStack, setOnePerStack] = useState(false);
  const [selection, setSelection] = useState<RecycleSelection[]>([]);
  const [quote, setQuote] = useState<{ key: string; value: RecycleQuote }>();
  const [message, setMessage] = useState(
    '把要出手的材料、灵种、道装、图纸、功法玉简、丹药和灵果挑出来，我给你报个实价。',
  );
  const [receipts, setReceipts] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const readError = bagQuery.error;
  const [quoteError, setQuoteError] = useState('');
  const [quoteExpanded, setQuoteExpanded] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches,
  );
  const busy = useRef(false);
  const quoteReader = useRef<AbortController | null>(null);
  const storageReader = useRef<AbortController | null>(null);
  const allItems = [...(view?.items ?? []), ...storageItems];
  const storagePages = Math.max(1, Math.ceil(storageItems.length / 40));
  const visibleItems =
    location === 'bag'
      ? (view?.items ?? [])
      : storageItems.slice(storagePage * 40, (storagePage + 1) * 40);
  const filteredItems = allItems.filter((item) => {
    if (recycleBlockingReason(item)) return false;
    if (filterSource !== 'all' && item.location !== filterSource) return false;
    if (filterCategory !== 'all' && itemCategory(item) !== filterCategory)
      return false;
    if (filterQuality !== 'all') {
      const quality = itemQuality(item);
      if (!quality || QUALITY_ORDER[quality] < QUALITY_ORDER[filterQuality])
        return false;
    }
    return item.name
      .toLocaleLowerCase()
      .includes(filterName.trim().toLocaleLowerCase());
  });
  const selectionKey = JSON.stringify({ owner, selection });
  const selectionCurrent = selection.every((ref) =>
    allItems.some(
      (item) =>
        item.id === ref.id &&
        item.revision === ref.revision &&
        item.quantity >= ref.quantity,
    ),
  );
  const currentQuote =
    quote?.key === selectionKey && selectionCurrent ? quote.value : undefined;
  const frozen =
    pending ||
    (location === 'bag'
      ? !view || bagQuery.isRefreshing || !!readError
      : storageLoading || !!storageError);
  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    storageReader.current = controller;
    void readStorage(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setStorageSnapshot({ key: storageKey, items });
          setStoragePage((page) =>
            Math.min(page, Math.max(0, Math.ceil(items.length / 40) - 1)),
          );
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setStorageSnapshot({
            key: storageKey,
            items: [],
            error: error instanceof Error ? error.message : '储藏室读取失败。',
          });
      });
    return () => controller.abort();
  }, [owner, storageKey]);
  useEffect(() => {
    const controller = new AbortController();
    quoteReader.current = controller;
    const input = JSON.parse(selectionKey) as {
      owner?: string;
      selection: RecycleSelection[];
    };
    if (!input.owner || !input.selection.length)
      return () => controller.abort();
    const timer = setTimeout(() => {
      void readJson<RecycleQuote>('/api/market/recycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'preview', items: input.selection }),
        signal: controller.signal,
      })
        .then((value) => {
          if (!controller.signal.aborted)
            setQuote({ key: selectionKey, value });
        })
        .catch((error) => {
          if (!controller.signal.aborted) setQuoteError(error.message);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectionKey, refresh]);
  useEffect(() => {
    if (!currentQuote) return;
    const timer = setTimeout(
      () => {
        setQuote(undefined);
        setQuoteError('这份报价已过期，请重新询价。');
      },
      Math.max(0, currentQuote.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [currentQuote]);
  function choose(item: Item, quantity: number) {
    if (busy.current || frozen) return;
    const reason = recycleBlockingReason(item);
    if (reason) {
      setMessage(reason);
      return;
    }
    setQuote(undefined);
    setQuoteError('');
    setSelection((previous) => {
      const rest = previous.filter((entry) => entry.id !== item.id);
      return quantity
        ? [...rest, { id: item.id, revision: item.revision, quantity }].sort(
            (a, b) => a.id.localeCompare(b.id),
          )
        : rest;
    });
    setMessage(
      quantity ? '我看看这批货。份数无误，便可成交。' : '不急，挑好了再给我。',
    );
  }
  function selectFiltered() {
    if (
      busy.current ||
      (filterSource !== 'storage' &&
        (!view || bagQuery.isRefreshing || readError)) ||
      (filterSource !== 'bag' && (storageLoading || storageError))
    )
      return;
    const selected = filteredItems.slice(0, MAX_RECYCLE_SELECTION);
    if (!selected.length) {
      setMessage('没有符合条件的可回收物品，请调整筛选条件。');
      return;
    }
    setSelection(
      selected
        .map((item) => ({
          id: item.id,
          revision: item.revision,
          quantity: onePerStack ? 1 : Math.min(item.quantity, 99),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    setQuote(undefined);
    setQuoteError('');
    setFilterOpen(false);
    setMessage(
      filteredItems.length > MAX_RECYCLE_SELECTION
        ? `先选中前 ${MAX_RECYCLE_SELECTION} 格，另有 ${filteredItems.length - MAX_RECYCLE_SELECTION} 格可在本次成交后继续选择。`
        : `已选中 ${selected.length} 格，请核对报价后出售。`,
    );
  }
  function reload() {
    if (busy.current) return;
    setQuote(undefined);
    setQuoteError('');
    setSelection([]);
    void bagQuery.reload();
    setStorageRefresh((value) => value + 1);
    setRefresh((value) => value + 1);
  }
  async function requote() {
    if (busy.current || !owner) return;
    busy.current = true;
    setPending(true);
    quoteReader.current?.abort();
    setQuote(undefined);
    setQuoteError('');
    try {
      const key = resourceStore.register(inventoryBagResource, undefined);
      if (!key) return;
      storageReader.current?.abort();
      const controller = new AbortController();
      storageReader.current = controller;
      const [, updatedStorage] = await Promise.all([
        resourceStore.reload(key),
        readStorage(controller.signal),
      ]);
      const snapshot = resourceStore.getSnapshot<InventoryView>(key);
      if (snapshot.error || !snapshot.data)
        throw new Error(snapshot.error ?? '物品栏读取失败');
      const updated = snapshot.data;
      setStorageSnapshot({ key: storageKey, items: updatedStorage });
      const currentItems = [...updated.items, ...updatedStorage];
      setSelection((previous) =>
        previous.flatMap((ref) => {
          const item = currentItems.find((row) => row.id === ref.id);
          return item && !recycleBlockingReason(item)
            ? [
                {
                  id: item.id,
                  revision: item.revision,
                  quantity: Math.min(ref.quantity, item.quantity),
                },
              ]
            : [];
        }),
      );
      setMessage('已按随身物品和储藏室重新点货，请核对数量与报价。');
      setRefresh((value) => value + 1);
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : '重新询价失败。');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function sell() {
    if (busy.current || !currentQuote) return;
    busy.current = true;
    setPending(true);
    quoteReader.current?.abort();
    try {
      const result = await consumeResourceMutation<RecycleResult>(
        await fetch('/api/market/recycle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phase: 'confirm', quoteId: currentQuote.id }),
        }),
      );
      const receipt = `收妥 ${result.quantity} 份，付你 ${result.total} 灵石。`;
      setReceipts((previous) => [...previous.slice(-4), receipt]);
      setMessage('银货两清。还有要出手的，尽管拿来。');
      setSelection([]);
      setQuote(undefined);
      setQuoteError('');
      setStorageRefresh((value) => value + 1);
      setRefresh((value) => value + 1);
    } catch (error) {
      bagQuery.invalidate();
      setStorageRefresh((value) => value + 1);
      setQuoteError(
        error instanceof Error ? error.message : '成交未确认，请重试。',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <GameSceneFrame variant="workflow">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-5" aria-label="回收掌柜对话">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center text-3xl"
            >
              🧮
            </span>
            <div>
              <p className="text-ink-secondary mb-1 text-xs">掌柜</p>
              <p className="text-sm leading-relaxed" aria-live="polite">
                {message}
              </p>
            </div>
          </div>
          {selection.length ? (
            <div
              className="border-ink/15 space-y-4 border-t pt-4"
              aria-label="当前报价"
            >
              {currentQuote ? (
                <>
                  <details
                    open={quoteExpanded}
                    onToggle={(event) =>
                      setQuoteExpanded(event.currentTarget.open)
                    }
                    className="text-sm"
                  >
                    <summary className="cursor-pointer">
                      报价明细 ·{' '}
                      <span className="font-mono">
                        {currentQuote.items.length}
                      </span>{' '}
                      项
                    </summary>
                    <ul className="mt-3 max-h-60 space-y-3 overflow-y-auto">
                      {currentQuote.items.map((item) => (
                        <li key={item.id}>
                          <div className="flex items-start justify-between gap-3">
                            <span>
                              {item.name}{' '}
                              <span className="font-mono">
                                ×{item.quantity}
                              </span>
                            </span>
                            <span className="shrink-0 font-mono">
                              {item.unitPrice} 灵石/份
                            </span>
                          </div>
                          {item.comment ? (
                            <details className="text-ink-secondary mt-1 text-xs">
                              <summary className="cursor-pointer">
                                掌柜评语
                              </summary>
                              <p className="pt-1 leading-relaxed">
                                {item.comment}
                              </p>
                            </details>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                  <p className="hidden justify-between text-sm lg:flex">
                    <span>合计</span>
                    <strong className="font-mono">
                      {currentQuote.total} 灵石
                    </strong>
                  </p>
                </>
              ) : !quoteError ? (
                <p role="status" className="text-ink-secondary text-sm">
                  掌柜正在估价……
                </p>
              ) : null}
              {quoteError ? (
                <p role="alert" className="text-crimson text-sm">
                  {quoteError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {currentQuote ? (
                  <InkButton
                    className="hidden lg:inline-flex"
                    disabled={pending}
                    onClick={() => void sell()}
                  >
                    {pending ? '正在成交……' : '出售所选'}
                  </InkButton>
                ) : null}
                {quoteError ? (
                  <InkButton disabled={pending} onClick={() => void requote()}>
                    重新询价
                  </InkButton>
                ) : null}
                <InkButton
                  disabled={pending}
                  onClick={() => {
                    setSelection([]);
                    setQuote(undefined);
                    setQuoteError('');
                  }}
                >
                  清空选择
                </InkButton>
              </div>
            </div>
          ) : null}
          {receipts.length ? (
            <details className="text-ink-secondary text-xs">
              <summary className="cursor-pointer">本次成交记录</summary>
              <div className="mt-2 max-h-28 space-y-2 overflow-y-auto">
                {receipts.map((receipt, index) => (
                  <p key={index}>{receipt}</p>
                ))}
              </div>
            </details>
          ) : null}
        </section>
        <section className="min-w-0 space-y-3" aria-label="待售物品栏">
          <div
            className="flex gap-3 text-sm"
            role="group"
            aria-label="物品位置"
          >
            <InkButton
              variant={location === 'bag' ? 'primary' : 'default'}
              onClick={() => setLocation('bag')}
            >
              随身物品
            </InkButton>
            <InkButton
              variant={location === 'storage' ? 'primary' : 'default'}
              onClick={() => setLocation('storage')}
            >
              储藏室
            </InkButton>
          </div>
          <InventoryHeader
            title={location === 'bag' ? '随身物品' : '储藏室'}
            capacity={
              location === 'bag' ? (
                <> {view?.used ?? '—'} / 40</>
              ) : (
                <>{storageItems.length} 格</>
              )
            }
            actions={
              <div className="flex gap-2">
                <InkButton
                  disabled={pending}
                  onClick={() => setFilterOpen(true)}
                >
                  筛选批量出售
                </InkButton>
                <InkButton disabled={pending} onClick={reload}>
                  刷新
                </InkButton>
              </div>
            }
          />
          {location === 'bag' && readError ? (
            <p role="alert" className="text-crimson text-sm">
              {readError}
            </p>
          ) : null}
          {location === 'storage' && storageLoading ? (
            <p role="status" className="text-ink-secondary text-sm">
              正在读取储藏室……
            </p>
          ) : null}
          {location === 'storage' && storageError ? (
            <p role="alert" className="text-crimson text-sm">
              {storageError}
            </p>
          ) : null}
          <InventoryItems
            location={location}
            items={visibleItems}
            slotProps={(item) => {
              const chosen =
                item && selection.find((entry) => entry.id === item.id);
              return {
                disabled: frozen || !item,
                selected: Boolean(chosen),
                badge: chosen
                  ? `售 ${chosen.quantity}`
                  : item && !recycleBlockingReason(item)
                    ? '可选'
                    : undefined,
                onQuickAction:
                  item && !recycleBlockingReason(item)
                    ? () => choose(item, chosen ? 0 : 1)
                    : undefined,
                children: item
                  ? (close) => {
                      const reason = recycleBlockingReason(item);
                      return reason ? (
                        <p className="text-ink-secondary text-sm">{reason}</p>
                      ) : (
                        <QuantityChoice
                          key={`${item.id}:${chosen?.quantity ?? 0}`}
                          item={item}
                          selected={chosen || undefined}
                          disabled={frozen}
                          choose={(quantity) => {
                            choose(item, quantity);
                            close();
                          }}
                        />
                      );
                    }
                  : undefined,
              };
            }}
          />
          {location === 'storage' && storagePages > 1 ? (
            <div className="flex items-center justify-center gap-3 text-sm">
              <InkButton
                disabled={storagePage === 0}
                onClick={() => setStoragePage((page) => page - 1)}
              >
                上一页
              </InkButton>
              <span className="font-mono">
                {storagePage + 1} / {storagePages}
              </span>
              <InkButton
                disabled={storagePage + 1 >= storagePages}
                onClick={() => setStoragePage((page) => page + 1)}
              >
                下一页
              </InkButton>
            </div>
          ) : null}
          <p className="text-ink-secondary text-xs">
            点击物品询价，详情中可调整份数；筛选可批量选中。
          </p>
        </section>
      </div>
      {selection.length ? (
        <div className="bg-paper border-ink/20 sticky bottom-[var(--game-bottom-offset)] z-20 mt-4 flex items-center justify-between gap-2 border-t py-3 lg:hidden">
          <span className="text-sm">
            {currentQuote ? (
              <>
                合计 <span className="font-mono">{currentQuote.total}</span>{' '}
                灵石
              </>
            ) : (
              '等待重新报价'
            )}
          </span>
          <InkButton
            disabled={pending || !currentQuote}
            onClick={() => void sell()}
          >
            {pending ? '正在成交……' : '出售所选'}
          </InkButton>
        </div>
      ) : null}
      <InkModal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="筛选待售物品"
      >
        <form
          className="space-y-4 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            selectFiltered();
          }}
        >
          <label className="block space-y-1">
            <span>位置</span>
            <select
              className="border-ink/20 w-full border bg-transparent p-2"
              value={filterSource}
              onChange={(event) =>
                setFilterSource(event.target.value as typeof filterSource)
              }
            >
              <option value="all">随身物品与储藏室</option>
              <option value="bag">仅随身物品</option>
              <option value="storage">仅储藏室</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span>种类</span>
            <select
              className="border-ink/20 w-full border bg-transparent p-2"
              value={filterCategory}
              onChange={(event) =>
                setFilterCategory(event.target.value as RecycleCategory)
              }
            >
              {categories.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span>最低品质</span>
            <select
              className="border-ink/20 w-full border bg-transparent p-2"
              value={filterQuality}
              onChange={(event) =>
                setFilterQuality(event.target.value as Quality | 'all')
              }
            >
              <option value="all">不限</option>
              {QUALITY_VALUES.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}及以上
                </option>
              ))}
            </select>
            <span className="text-ink-secondary block text-xs">
              只适用于有品质的材料、灵种、丹药和灵果。
            </span>
          </label>
          <label className="block space-y-1">
            <span>名称包含</span>
            <input
              className="border-ink/20 w-full border bg-transparent p-2"
              value={filterName}
              onChange={(event) => setFilterName(event.target.value)}
              placeholder="可留空"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={onePerStack}
              onChange={(event) => setOnePerStack(event.target.checked)}
            />
            每格只出售 1 份
          </label>
          <p className="text-ink-secondary" aria-live="polite">
            {storageLoading
              ? '正在读取储藏室……'
              : storageError
                ? `储藏室读取失败：${storageError}`
                : `符合条件 ${filteredItems.length} 格；本次最多选择 ${MAX_RECYCLE_SELECTION} 格。`}
          </p>
          <div className="flex justify-end gap-2">
            <InkButton onClick={() => setFilterOpen(false)}>取消</InkButton>
            <InkButton
              type="submit"
              disabled={
                pending ||
                !filteredItems.length ||
                (filterSource !== 'storage' &&
                  (!view || bagQuery.isRefreshing || !!readError)) ||
                (filterSource !== 'bag' && (storageLoading || !!storageError))
              }
            >
              选中并询价
            </InkButton>
          </div>
        </form>
      </InkModal>
    </GameSceneFrame>
  );
}

import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkButton } from '@app/components/ui/InkButton';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import type { InventoryView } from '@shared/contracts/inventory';
import type {
  RecycleQuote,
  RecycleResult,
  RecycleSelection,
} from '@shared/contracts/recycle';
import { recycleBlockingReason } from '@shared/inventory/recycle';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';

const LegacyArtifactRecycle = lazy(() =>
  import('./LegacyArtifactRecycle').then((module) => ({
    default: module.LegacyArtifactRecycle,
  })),
);
type Item = InventoryView['items'][number];
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
  const [bag, setBag] = useState<{ owner: string; view: InventoryView }>();
  const [selection, setSelection] = useState<RecycleSelection[]>([]);
  const [quote, setQuote] = useState<{ key: string; value: RecycleQuote }>();
  const [message, setMessage] = useState(
    '把要出手的材料、丹药挑出来，我给你报个实价。',
  );
  const [receipts, setReceipts] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [readError, setReadError] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [quoteExpanded, setQuoteExpanded] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches,
  );
  const busy = useRef(false);
  const quoteReader = useRef<AbortController | null>(null);
  const view = bag && bag.owner === owner ? bag.view : undefined;
  const selectionKey = JSON.stringify({ owner, selection });
  const currentQuote = quote?.key === selectionKey ? quote.value : undefined;
  const frozen = pending || !view;
  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    void readJson<InventoryView>('/api/combat-v6/inventory?location=bag', {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) {
          setBag({ owner, view: value });
          setReadError('');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setReadError(error.message);
      });
    return () => controller.abort();
  }, [owner, refresh]);
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
    if (busy.current) return;
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
  function reload() {
    if (busy.current) return;
    setQuote(undefined);
    setQuoteError('');
    setSelection([]);
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
      const updated = await readJson<InventoryView>(
        '/api/combat-v6/inventory?location=bag',
      );
      setBag({ owner, view: updated });
      setReadError('');
      setSelection((previous) =>
        previous.flatMap((ref) => {
          const item = updated.items.find((row) => row.id === ref.id);
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
      setMessage('已按随身物品重新点货，请核对数量与报价。');
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
      setBag(undefined);
      setRefresh((value) => value + 1);
    } catch (error) {
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
          <details
            onToggle={(event) => setLegacyOpen(event.currentTarget.open)}
            className="text-ink-secondary text-xs"
          >
            <summary className="cursor-pointer">问问旧法宝的回收</summary>
            {legacyOpen ? (
              <Suspense fallback={<p>掌柜正在翻看旧藏……</p>}>
                <LegacyArtifactRecycle />
              </Suspense>
            ) : null}
          </details>
        </section>
        <section className="min-w-0 space-y-3" aria-label="随身物品栏">
          <div className="flex items-center justify-between gap-2 text-sm">
            <p>
              随身物品{' '}
              <span className="font-mono">{view?.used ?? '—'} / 40</span>
            </p>
            <InkButton disabled={pending} onClick={reload}>
              刷新
            </InkButton>
          </div>
          {readError ? (
            <p role="alert" className="text-crimson text-sm">
              {readError}
            </p>
          ) : null}
          <InventoryItems
            items={view?.items ?? []}
            className="w-full grid-cols-5 gap-1 sm:grid-cols-5"
            slotProps={(item) => {
              const chosen =
                item && selection.find((entry) => entry.id === item.id);
              return {
                disabled: frozen || !item,
                selected: Boolean(chosen),
                badge: chosen ? `售 ${chosen.quantity}` : undefined,
                onQuickAction: item
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
          <p className="text-ink-secondary text-xs">
            点击物品询价，详情中可调整份数。
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
    </GameSceneFrame>
  );
}

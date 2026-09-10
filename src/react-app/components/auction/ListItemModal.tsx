import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkInput, InkNotice, InkSelect } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { calculateAuctionSettlement } from '@shared/config/auctionConfig';
import {
  AuctionListSchema,
  auctionBlockReason,
  auctionItemPriceCap,
} from '@shared/contracts/auction';
import type { FriendCultivatorSummary } from '@shared/contracts/friends';
import type { InventoryView } from '@shared/contracts/inventory';
import { useEffect, useRef, useState } from 'react';

export function ListItemModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [bag, setBag] = useState<InventoryView>();
  const [friends, setFriends] = useState<FriendCultivatorSummary[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<InventoryView['items'][number]>();
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [target, setTarget] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ key: string; id: string }>(undefined);
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  async function refresh() {
    try {
      const response = await fetch('/api/combat-v6/inventory?location=bag');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? '物品栏读取失败');
      setBag(result.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '物品栏读取失败');
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (visibility !== 'private') return;
    let cancelled = false;
    void fetch('/api/friends')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? '好友读取失败');
        if (!cancelled) setFriends(data.friends ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [visibility]);
  function choose(item: InventoryView['items'][number]) {
    if (pending.current) return;
    const reason = auctionBlockReason(item);
    if (reason) {
      pushToast({ message: reason, tone: 'warning' });
      return;
    }
    setSelected(item);
    setQuantity('1');
    setBagOpen(false);
  }
  async function submit() {
    if (pending.current || !selected) return;
    const body = {
      itemId: selected.id,
      revision: selected.revision,
      quantity: Number(quantity),
      price: Number(price),
      visibility,
      ...(visibility === 'private' ? { targetCultivatorId: target } : {}),
    };
    const key = JSON.stringify(body);
    if (attempt.current?.key !== key)
      attempt.current = { key, id: crypto.randomUUID() };
    const parsed = AuctionListSchema.safeParse({
      ...body,
      requestId: attempt.current.id,
    });
    if (
      !parsed.success ||
      Number(quantity) > selected.quantity ||
      Number(price) > auctionItemPriceCap(selected)
    ) {
      pushToast({ message: '请检查数量、单价与专属道友', tone: 'warning' });
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const result = await mutate<{ message: string }>(
        fetch('/api/auction/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        }),
      );
      pushToast({ message: result.message, tone: 'success' });
      onSuccess();
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '上架失败',
        tone: 'danger',
      });
      await refresh();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const quote = calculateAuctionSettlement(
    Number(price) || 0,
    Number(quantity) || 0,
  );
  const inventory = (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span>
          随身物品 <span className="font-mono">{bag?.used ?? '—'} / 40</span>
        </span>
        <InkButton disabled={busy} onClick={() => void refresh()}>
          刷新
        </InkButton>
      </div>
      {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
      <InventoryItems
        items={bag?.items ?? []}
        className="grid-cols-5 gap-1 sm:grid-cols-5"
        slotProps={(item) => ({
          disabled: !item || busy,
          selected: !!item && item.id === selected?.id,
          onQuickAction: item ? () => choose(item) : undefined,
          children: item
            ? (close) => (
                <InkButton
                  disabled={busy}
                  onClick={() => {
                    choose(item);
                    close();
                  }}
                >
                  寄售
                </InkButton>
              )
            : undefined,
        })}
      />
    </div>
  );
  return (
    <InkModal
      isOpen
      title="上架寄售"
      className="max-w-5xl"
      onClose={() => {
        if (!pending.current) {
          if (bagOpen) setBagOpen(false);
          else onClose();
        }
      }}
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
          <div className="flex items-center gap-4">
            <div className="w-20 shrink-0">
              <ItemSlot
                className="w-full"
                item={selected}
                emptyLabel="选择物品"
                disabled={busy}
                onQuickAction={() => setBagOpen(true)}
              >
                {(close) => (
                  <InkButton
                    disabled={busy}
                    onClick={() => {
                      setSelected(undefined);
                      close();
                    }}
                  >
                    移出
                  </InkButton>
                )}
              </ItemSlot>
            </div>
            {selected ? (
              <InkInput
                label="数量"
                type="number"
                min={1}
                max={selected.quantity}
                value={quantity}
                onChange={setQuantity}
                disabled={busy}
              />
            ) : (
              <span className="text-ink-secondary text-sm">
                从随身物品选择一叠寄售
              </span>
            )}
          </div>
          {selected ? (
            <InkButton disabled={busy} onClick={() => setSelected(undefined)}>
              移出物品
            </InkButton>
          ) : null}
          <InkInput
            label="单价（灵石／件）"
            type="number"
            min={1}
            max={selected ? auctionItemPriceCap(selected) : undefined}
            value={price}
            onChange={setPrice}
            disabled={busy}
          />
          {selected ? (
            <p className="text-ink-secondary text-xs">
              单价上限{' '}
              <span className="font-mono">
                {auctionItemPriceCap(selected).toLocaleString()}
              </span>{' '}
              灵石
            </p>
          ) : null}
          <InkSelect
            label="寄售范围"
            value={visibility}
            onChange={(v) => setVisibility(v as 'public' | 'private')}
            disabled={busy}
          >
            <option value="public">公开寄售</option>
            <option value="private">好友专属</option>
          </InkSelect>
          {visibility === 'private' ? (
            <>
              <InkSelect
                label="专属道友"
                value={target}
                onChange={setTarget}
                disabled={busy}
              >
                <option value="">选择好友</option>
                {friends.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.realm}
                    {f.realmStage}
                  </option>
                ))}
              </InkSelect>
              <p className="text-ink-secondary text-xs">
                上架消耗一张随身拍卖行贵宾符
              </p>
            </>
          ) : null}
          <p className="text-ink-secondary text-sm">
            按本次数量整批成交预计税费{' '}
            <span className="font-mono">
              {quote.feeAmount.toLocaleString()}
            </span>
            ，实得{' '}
            <span className="font-mono">
              {quote.sellerAmount.toLocaleString()}
            </span>{' '}
            灵石。分次成交按每次交易计税。
          </p>
          <p className="text-ink-secondary text-xs">
            寄售48小时；成交款与未售物品通过邮件收取。
          </p>
          <div className="flex justify-end gap-3">
            <InkButton disabled={busy} onClick={onClose}>
              取消
            </InkButton>
            <InkButton
              variant="primary"
              pending={busy}
              disabled={!selected || busy}
              onClick={() => void submit()}
            >
              确认上架
            </InkButton>
          </div>
        </div>
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
    </InkModal>
  );
}

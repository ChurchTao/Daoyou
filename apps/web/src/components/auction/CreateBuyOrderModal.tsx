import { InventoryHeader } from '@app/components/feature/items/InventoryHeader';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkButton,
  InkInput,
  InkNotice,
  InkQuantityInput,
} from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import { apiFetch } from '@app/lib/api/fetch';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorCurrency } from '@app/lib/resources/player';
import {
  AuctionBuyOrderCreateSchema,
  type AuctionListingView,
} from '@daoyou/contracts/auction';
import type { InventoryView } from '@daoyou/contracts/inventory';
import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import { AUCTION_CATALOG_UNIT_PRICE_CAP } from '@daoyou/game-content/auction/config';
import {
  AUCTION_MAX_TRANSACTION_TOTAL,
  AUCTION_MAX_UNIT_PRICE,
} from '@daoyou/game-domain/auction';
import {
  auctionBuyOrderTargetBlockReason,
  auctionItemPriceCap,
  auctionListingStackLimit,
  auctionSellerReceiptAllows,
  getAuctionUnitPriceCap,
} from '@daoyou/game-rules/auction';
import { useRef, useState } from 'react';

type BagItem = InventoryView['items'][number];

function listingPriceCap(listing: AuctionListingView) {
  if (listing.itemType === 'beast') return 0;
  if (QUALITY_VALUES.includes(listing.itemQuality as Quality))
    return getAuctionUnitPriceCap(listing.itemQuality as Quality);
  return ['manual_jade', 'beast_book'].includes(listing.itemType)
    ? AUCTION_MAX_UNIT_PRICE
    : AUCTION_CATALOG_UNIT_PRICE_CAP;
}

export function CreateBuyOrderModal({
  listingSource,
  onClose,
  onSuccess,
}: {
  listingSource?: AuctionListingView;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isListingSource = Boolean(listingSource);
  const bagQuery = useInventoryBag(!isListingSource);
  const bag = bagQuery.data;
  const bagUnavailable = !bag || bagQuery.isRefreshing || !!bagQuery.error;
  const currency = useCultivatorCurrency();
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const [selectedRef, setSelectedRef] = useState<BagItem>();
  const selected = selectedRef
    ? bag?.items.find(
        (item) =>
          item.id === selectedRef.id &&
          item.revision === selectedRef.revision,
      )
    : undefined;
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState(() =>
    listingSource && listingSource.itemType !== 'beast'
      ? String(listingSource.price)
      : '',
  );
  const [bagOpen, setBagOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ key: string; id: string }>(undefined);

  const targetDefinitionId =
    listingSource && listingSource.itemType !== 'beast'
      ? listingSource.item.definitionId
      : selected?.definitionId;
  const targetReason = selected
    ? auctionBuyOrderTargetBlockReason(selected)
    : null;
  const priceCap = listingSource
    ? listingPriceCap(listingSource)
    : selected
      ? auctionItemPriceCap(selected)
      : AUCTION_MAX_UNIT_PRICE;
  const maxQuantity = targetDefinitionId
    ? auctionListingStackLimit(targetDefinitionId)
    : 1;
  const priceValue = Number(price);
  const quantityValue = Number(quantity);
  const validNumbers =
    Number.isInteger(priceValue) &&
    priceValue >= 1 &&
    priceValue <= priceCap &&
    Number.isInteger(quantityValue) &&
    quantityValue >= 1 &&
    quantityValue <= maxQuantity;
  const total = validNumbers ? priceValue * quantityValue : 0;
  const affordable = currency.data
    ? total <= currency.data.spiritStones
    : false;
  const withinTotal = total <= AUCTION_MAX_TRANSACTION_TOTAL;
  const receiptAllowed = validNumbers
    ? auctionSellerReceiptAllows(priceValue, quantityValue)
    : false;
  const canSubmit =
    !!targetDefinitionId &&
    !targetReason &&
    !busy &&
    validNumbers &&
    affordable &&
    withinTotal &&
    receiptAllowed;

  function choose(item: BagItem) {
    if (pending.current || bagUnavailable) return;
    const reason = auctionBuyOrderTargetBlockReason(item);
    if (reason) {
      pushToast({ message: reason, tone: 'warning' });
      return;
    }
    setSelectedRef(item);
    setQuantity('1');
    setPrice('');
    setBagOpen(false);
  }

  async function submit() {
    if (pending.current || busy || !canSubmit) return;
    const source = listingSource
      ? { kind: 'listing' as const, listingId: listingSource.id }
      : selected
        ? {
            kind: 'bag' as const,
            itemId: selected.id,
            revision: selected.revision,
          }
        : null;
    if (!source) return;
    const key = JSON.stringify([source, priceValue, quantityValue]);
    if (attempt.current?.key !== key)
      attempt.current = { key, id: crypto.randomUUID() };
    const parsed = AuctionBuyOrderCreateSchema.safeParse({
      requestId: attempt.current.id,
      source,
      price: priceValue,
      quantity: quantityValue,
    });
    if (!parsed.success) {
      pushToast({ message: '请检查收购目标、数量与单价', tone: 'warning' });
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const result = await mutate<{ message: string }>(
        apiFetch('/api/auction/buy-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        }),
      );
      pushToast({ message: result.message, tone: 'success' });
      onSuccess();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '发布收购失败',
        tone: 'danger',
      });
      if (!isListingSource) await bagQuery.reload();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const inventory = (
    <div className="space-y-3">
      <InventoryHeader
        capacity={<> {bag?.used ?? '—'} / 40</>}
        actions={
          <InkButton
            disabled={busy || bagQuery.isRefreshing}
            onClick={() => void bagQuery.reload()}
          >
            刷新
          </InkButton>
        }
      />
      {bagQuery.error ? (
        <InkNotice tone="warning">{bagQuery.error}</InkNotice>
      ) : null}
      <InventoryItems
        items={bag?.items ?? []}
        slotProps={(item) => ({
          disabled: !item || busy || bagUnavailable,
          selected: !!item && item.id === selected?.id,
          badge:
            item && !auctionBuyOrderTargetBlockReason(item)
              ? '可选'
              : undefined,
          onQuickAction:
            item && !auctionBuyOrderTargetBlockReason(item)
              ? () => choose(item)
              : undefined,
          children: item
            ? (close) => (
                <>
                  <p className="text-ink-secondary">
                    {auctionBuyOrderTargetBlockReason(item)}
                  </p>
                  <InkButton
                    disabled={
                      busy ||
                      bagUnavailable ||
                      !!auctionBuyOrderTargetBlockReason(item)
                    }
                    onClick={() => {
                      choose(item);
                      close();
                    }}
                  >
                    以此为收购目标
                  </InkButton>
                </>
              )
            : undefined,
        })}
      />
    </div>
  );

  const targetSlot = listingSource ? (
    listingSource.itemType !== 'beast' && (
      <ItemSlot
        className="w-full"
        item={{
          ...listingSource.item,
          quantity: listingSource.remainingQuantity,
        }}
      />
    )
  ) : (
    <ItemSlot
      className="w-full"
      item={selected}
      emptyLabel="选择物品"
      disabled={busy}
      onQuickAction={() => setBagOpen(true)}
    >
      {(close) => (
        <InkButton
          disabled={busy || bagUnavailable}
          onClick={() => {
            setSelectedRef(undefined);
            close();
          }}
        >
          移出
        </InkButton>
      )}
    </ItemSlot>
  );

  return (
    <InkModal
      isOpen
      title="发布收购"
      className={isListingSource ? 'max-w-2xl' : 'max-w-5xl'}
      onClose={() => {
        if (pending.current) return;
        if (bagOpen) setBagOpen(false);
        else onClose();
      }}
    >
      <div
        className={
          isListingSource
            ? 'min-w-0 space-y-4'
            : 'grid min-w-0 gap-6 lg:grid-cols-2'
        }
      >
        <div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
          <div className="flex items-center gap-4">
            <div className="w-20 shrink-0">{targetSlot}</div>
            <div className="min-w-0 text-sm">
              {listingSource ? (
                <>
                  <p className="truncate">收购「{listingSource.itemName}」</p>
                  <p className="text-ink-secondary text-xs">
                    目标来自在售货单，发布后其他道友可用背包同款供货。
                  </p>
                </>
              ) : selected ? (
                <>
                  <p className="truncate">收购「{selected.name}」</p>
                  <p className="text-ink-secondary text-xs">
                    可从背包选择一叠物品作为收购目标。
                  </p>
                </>
              ) : (
                <p className="text-ink-secondary">
                  从随身物品选择一叠作为收购目标
                </p>
              )}
            </div>
          </div>
          {!listingSource && selectedRef && !selected ? (
            <p role="alert">所选物品已变化，请重新选择。</p>
          ) : null}
          {!listingSource && selected ? (
            <InkButton
              disabled={busy || bagUnavailable}
              onClick={() => setSelectedRef(undefined)}
            >
              移出物品
            </InkButton>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <InkQuantityInput
              label="收购数量"
              max={maxQuantity}
              value={quantity}
              onChange={setQuantity}
              disabled={busy || !targetDefinitionId}
            />
            <InkInput
              label="单价（灵石／件）"
              type="number"
              min={1}
              max={priceCap}
              value={price}
              onChange={setPrice}
              disabled={busy || !targetDefinitionId}
            />
          </div>
          <p className="text-ink-secondary text-xs">
            单价上限 <SpiritStones amount={priceCap} />
            {targetDefinitionId ? (
              <>
                {' '}
                · 单次最多{' '}
                <span className="font-mono">{maxQuantity}</span> 件
              </>
            ) : null}
          </p>
          <p className="text-amber-800">
            本次冻结{' '}
            {validNumbers ? (
              <SpiritStones amount={total} className="font-semibold" />
            ) : (
              '—'
            )}
            ，撤单或过期后按剩余数量退回。
          </p>
          {currency.data && validNumbers && !affordable ? (
            <p className="text-crimson text-sm">囊中羞涩，灵石不足。</p>
          ) : null}
          {validNumbers && !receiptAllowed ? (
            <p className="text-crimson text-sm">
              收购数量过多，单次成交会超过灵石入账上限，请调低数量。
            </p>
          ) : null}
          <p className="text-ink-secondary text-xs">
            收购单保留48小时；成交物品与灵石均通过邮件领取；同账号不可供货。
          </p>
          <div className="flex justify-end gap-3">
            <InkButton disabled={busy} onClick={onClose}>
              取消
            </InkButton>
            <InkButton
              variant="primary"
              pending={busy}
              disabled={!canSubmit}
              onClick={() => void submit()}
            >
              确认发布
            </InkButton>
          </div>
        </div>
        {!isListingSource && (
          <section className="hidden min-w-0 lg:block" aria-label="角色物品">
            {inventory}
          </section>
        )}
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

import { InventoryHeader } from '@app/components/feature/items/InventoryHeader';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkButton,
  InkChoiceButton,
  InkInput,
  InkNotice,
  InkQuantityInput,
  InkSelect,
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
import { ELEMENT_VALUES } from '@daoyou/constants/elements';
import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import {
  AUCTION_CATALOG_UNIT_PRICE_CAP,
  AUCTION_MIN_QUALITY,
} from '@daoyou/game-content/auction/config';
import {
  AUCTION_MAX_TRANSACTION_TOTAL,
  AUCTION_MAX_UNIT_PRICE,
  auctionMaterialConditionLabel,
  type AuctionMaterialCondition,
} from '@daoyou/game-domain/auction';
import {
  INVENTORY_MATERIAL_TYPES,
  MATERIAL_TYPE_NAMES,
  MaterialFactsSchema,
} from '@daoyou/game-domain/inventory';
import {
  auctionBuyOrderTargetBlockReason,
  auctionItemPriceCap,
  auctionListingStackLimit,
  auctionMaterialConditionBlockReason,
  auctionSellerReceiptAllows,
  getAuctionUnitPriceCap,
  isAuctionListableQuality,
} from '@daoyou/game-rules/auction';
import { useRef, useState } from 'react';

type BagItem = InventoryView['items'][number];
type InventoryMaterialType = (typeof INVENTORY_MATERIAL_TYPES)[number];
type BuyMode = 'exact' | 'condition';

function listingPriceCap(listing: AuctionListingView) {
  if (listing.itemType === 'beast') return 0;
  if (QUALITY_VALUES.includes(listing.itemQuality as Quality))
    return getAuctionUnitPriceCap(listing.itemQuality as Quality);
  return ['manual_jade', 'beast_book'].includes(listing.itemType)
    ? AUCTION_MAX_UNIT_PRICE
    : AUCTION_CATALOG_UNIT_PRICE_CAP;
}

function conditionDefaultQuality(rank: Quality | undefined): Quality {
  return rank && isAuctionListableQuality(rank) ? rank : AUCTION_MIN_QUALITY;
}

function materialFactsOf(
  item?: Pick<BagItem, 'definitionId' | 'instanceData'>,
) {
  if (item?.definitionId !== 'material.v1') return undefined;
  const facts = MaterialFactsSchema.safeParse(item.instanceData);
  return facts.success ? facts.data : undefined;
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
  const [mode, setMode] = useState<BuyMode | null>(() =>
    listingSource ? 'exact' : null,
  );
  const bagQuery = useInventoryBag(!isListingSource && mode === 'exact');
  const bag = bagQuery.data;
  const bagUnavailable = !bag || bagQuery.isRefreshing || !!bagQuery.error;
  const currency = useCultivatorCurrency();
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const [selectedRef, setSelectedRef] = useState<BagItem>();
  const selected = selectedRef
    ? bag?.items.find(
        (item) =>
          item.id === selectedRef.id && item.revision === selectedRef.revision,
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
  const listingItem =
    listingSource && listingSource.itemType !== 'beast'
      ? listingSource.item
      : undefined;
  const [conditionType, setConditionType] = useState<
    InventoryMaterialType | 'any'
  >(() => materialFactsOf(listingItem)?.type ?? 'any');
  const [conditionQuality, setConditionQuality] = useState<Quality>(() =>
    conditionDefaultQuality(materialFactsOf(listingItem)?.rank),
  );
  const [conditionElement, setConditionElement] = useState<
    AuctionMaterialCondition['element']
  >('any');

  const useCondition = mode === 'condition';
  const conditionValue: AuctionMaterialCondition | null = useCondition
    ? {
        type: conditionType === 'any' ? null : conditionType,
        quality: conditionQuality,
        element: conditionElement,
      }
    : null;
  const conditionLabel = conditionValue
    ? auctionMaterialConditionLabel(conditionValue)
    : '';
  const conditionBlockReason = conditionValue
    ? auctionMaterialConditionBlockReason(conditionValue)
    : null;
  const conditionAvailable =
    !listingSource ||
    (listingSource.itemType !== 'beast' &&
      listingSource.item.definitionId === 'material.v1');

  const targetDefinitionId =
    mode === 'condition'
      ? 'material.v1'
      : mode === 'exact'
        ? listingItem?.definitionId ?? selected?.definitionId
        : undefined;
  const targetReason =
    mode === 'exact' && !listingSource && selected
      ? auctionBuyOrderTargetBlockReason(selected)
      : null;
  const priceCap = useCondition
    ? getAuctionUnitPriceCap(conditionQuality)
    : listingSource
      ? listingPriceCap(listingSource)
      : selected
        ? auctionItemPriceCap(selected)
        : AUCTION_MAX_UNIT_PRICE;
  const maxQuantity = useCondition
    ? auctionListingStackLimit('material.v1')
    : targetDefinitionId
      ? auctionListingStackLimit(targetDefinitionId)
      : 1;
  const priceValue = Number(price);
  const quantityValue = Number(quantity);
  const validNumbers =
    !!targetDefinitionId &&
    !targetReason &&
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
    mode !== null &&
    !!targetDefinitionId &&
    !targetReason &&
    !conditionBlockReason &&
    !busy &&
    validNumbers &&
    affordable &&
    withinTotal &&
    receiptAllowed;

  function seedCondition(item?: Pick<BagItem, 'definitionId' | 'instanceData'>) {
    const facts = materialFactsOf(item);
    if (!facts) return;
    setConditionType(facts.type);
    setConditionQuality(conditionDefaultQuality(facts.rank));
    setConditionElement('any');
  }

  function chooseMode(next: BuyMode) {
    if (busy) return;
    if (next === 'condition')
      seedCondition(listingItem ?? selected);
    setMode(next);
  }

  function choose(item: BagItem) {
    if (pending.current || bagUnavailable) return;
    const reason = auctionBuyOrderTargetBlockReason(item);
    if (reason) {
      pushToast({ message: reason, tone: 'warning' });
      return;
    }
    seedCondition(item);
    setSelectedRef(item);
    setQuantity('1');
    setPrice('');
    setBagOpen(false);
  }

  async function submit() {
    if (pending.current || busy || !canSubmit || !mode) return;
    const source =
      mode === 'exact'
        ? listingSource
          ? { kind: 'listing' as const, listingId: listingSource.id }
          : selected
            ? {
                kind: 'bag' as const,
                itemId: selected.id,
                revision: selected.revision,
              }
            : undefined
        : undefined;
    if (mode === 'exact' && !source) return;
    const key = JSON.stringify([
      mode,
      source ?? null,
      conditionValue,
      priceValue,
      quantityValue,
    ]);
    if (attempt.current?.key !== key)
      attempt.current = { key, id: crypto.randomUUID() };
    const parsed = AuctionBuyOrderCreateSchema.safeParse({
      requestId: attempt.current.id,
      ...(source ? { source } : {}),
      targetMode: mode,
      ...(conditionValue ? { condition: conditionValue } : {}),
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

  const exactTarget = listingSource ? (
    listingItem ? (
      <div className="flex items-center gap-4">
        <div className="w-20 shrink-0">
          <ItemSlot
            className="w-full"
            item={{
              ...listingItem,
              quantity: listingSource.remainingQuantity,
            }}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold">
            收购「{listingSource.itemName}」
          </p>
          <p className="text-ink-secondary text-xs">
            收购目标来自在售货单，其他道友可用背包同款供货。
          </p>
        </div>
      </div>
    ) : null
  ) : (
    <div className="space-y-3">
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
        </div>
        <div className="min-w-0 space-y-1">
          {selected ? (
            <>
              <p className="truncate text-sm font-semibold">
                收购「{selected.name}」
              </p>
              <p className="text-ink-secondary text-xs">
                只收购与所选物品完全一致的堆叠。
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">选择收购目标</p>
              <p className="text-ink-secondary text-xs">
                从随身物品中选择一叠可收购的物品。
              </p>
            </>
          )}
        </div>
      </div>
      {selectedRef && !selected ? (
        <p role="alert" className="text-crimson text-sm">
          所选物品已变化，请重新选择。
        </p>
      ) : null}
    </div>
  );

  const conditionTarget = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <InkSelect
          label="品质"
          value={conditionQuality}
          onChange={(value) => setConditionQuality(value as Quality)}
          disabled={busy}
        >
          {QUALITY_VALUES.filter(isAuctionListableQuality).map((quality) => (
            <option key={quality} value={quality}>
              {quality}
            </option>
          ))}
        </InkSelect>
        <InkSelect
          label="类型"
          value={conditionType}
          onChange={(value) =>
            setConditionType(
              value === 'any' ? 'any' : (value as InventoryMaterialType),
            )
          }
          disabled={busy}
        >
          <option value="any">不限类型</option>
          {INVENTORY_MATERIAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {MATERIAL_TYPE_NAMES[type]}
            </option>
          ))}
        </InkSelect>
        <InkSelect
          label="五行"
          value={conditionElement}
          onChange={(value) =>
            setConditionElement(value as AuctionMaterialCondition['element'])
          }
          disabled={busy}
        >
          <option value="any">不限五行</option>
          <option value="none">无属性</option>
          {ELEMENT_VALUES.map((element) => (
            <option key={element} value={element}>
              {element}属性
            </option>
          ))}
        </InkSelect>
      </div>
      <div className="space-y-1">
        <p className="text-sm">
          收购条件：
          <span className="font-semibold">{conditionLabel}</span>
        </p>
        <p className="text-ink-secondary text-xs">
          背包中符合品质、类型与五行的任意材料均可供货，名称与描述不限。
        </p>
        {conditionBlockReason ? (
          <p className="text-crimson text-sm">{conditionBlockReason}</p>
        ) : null}
      </div>
    </div>
  );

  const wide = !isListingSource && mode === 'exact';

  return (
    <InkModal
      isOpen
      title="发布收购"
      className={wide ? 'max-w-5xl' : 'max-w-2xl'}
      footer={
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
      }
      onClose={() => {
        if (pending.current) return;
        if (bagOpen) setBagOpen(false);
        else onClose();
      }}
    >
      <div className="min-w-0 space-y-5">
        <section className="space-y-3" aria-label="收购方式">
          <h3 className="text-sm font-semibold">收购方式</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <InkChoiceButton
              layout="card"
              selected={mode === 'exact'}
              disabled={busy || listingSource?.itemType === 'beast'}
              onClick={() => chooseMode('exact')}
            >
              <span className="block text-sm font-semibold">按物品收购</span>
              <span className="text-ink-secondary mt-1 block text-xs leading-5">
                指定背包中的一叠物品，或在售货单的同款。
              </span>
            </InkChoiceButton>
            <InkChoiceButton
              layout="card"
              selected={mode === 'condition'}
              disabled={busy || !conditionAvailable}
              onClick={() => chooseMode('condition')}
            >
              <span className="block text-sm font-semibold">按条件收购</span>
              <span className="text-ink-secondary mt-1 block text-xs leading-5">
                按品质、类型、五行收购材料，名称与描述不限。
              </span>
            </InkChoiceButton>
          </div>
          {!conditionAvailable ? (
            <p className="text-ink-secondary text-xs">
              条件收购仅支持材料。
            </p>
          ) : null}
        </section>
        {mode ? (
          <div
            className={wide ? 'grid min-w-0 gap-6 lg:grid-cols-2' : undefined}
          >
            <div className="min-w-0 space-y-5 lg:sticky lg:top-0 lg:self-start">
              <section className="border-ink/15 space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">
                  {useCondition ? '收购条件' : '收购目标'}
                </h3>
                {useCondition ? conditionTarget : exactTarget}
              </section>
              <section className="border-ink/15 space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">数量与价格</h3>
                <div className="grid grid-cols-2 gap-3">
                  <InkQuantityInput
                    showLabel
                    fullWidth
                    size="md"
                    label="收购数量"
                    max={maxQuantity}
                    value={quantity}
                    onChange={setQuantity}
                    disabled={busy || !targetDefinitionId}
                  />
                  <InkInput
                    label="单价（灵石／件）"
                    type="number"
                    inputMode="numeric"
                    autoComplete="off"
                    min={1}
                    max={priceCap}
                    value={price}
                    onChange={setPrice}
                    disabled={busy || !targetDefinitionId}
                  />
                </div>
                {targetDefinitionId ? (
                  <>
                    <p className="text-ink-secondary text-xs">
                      {useCondition ? '条件单价上限' : '单价上限'}{' '}
                      <SpiritStones amount={priceCap} /> · 单次最多{' '}
                      <span className="font-mono">{maxQuantity}</span> 件
                    </p>
                    <p className="text-amber-800 text-sm">
                      本次冻结{' '}
                      {validNumbers ? (
                        <SpiritStones
                          amount={total}
                          className="font-semibold"
                        />
                      ) : (
                        '—'
                      )}
                      ，撤单或过期后按剩余数量退回。
                    </p>
                  </>
                ) : null}
                {currency.data && validNumbers && !affordable ? (
                  <p className="text-crimson text-sm">囊中羞涩，灵石不足。</p>
                ) : null}
                {validNumbers && !receiptAllowed ? (
                  <p className="text-crimson text-sm">
                    收购数量过多，单次成交会超过灵石入账上限，请调低数量。
                  </p>
                ) : null}
              </section>
              <p className="text-ink-secondary text-xs">
                收购单保留48小时；成交物品与灵石均通过邮件领取；同账号不可供货。
              </p>
            </div>
            {wide ? (
              <section className="hidden min-w-0 lg:block" aria-label="角色物品">
                {inventory}
              </section>
            ) : null}
          </div>
        ) : (
          <p className="text-ink-secondary text-sm">
            选择一种收购方式后，继续填写目标与价格。
          </p>
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

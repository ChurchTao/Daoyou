import {
  InventoryGrid,
  ItemSlot,
} from '@app/components/feature/items/ItemSlot';
import { GameLoadingState } from '@app/components/game-shell';
import { InkButton, InkInput, InkNotice, InkQuantityInput, InkSelect } from '@app/components/ui';
import {
  ITEM_EXCHANGE_CART_MAX_LINES,
  type ItemExchangeShopItemView,
} from '@daoyou/game-domain/shops/exchange';
import { findItemDefinition } from '@daoyou/game-content/items';
import { getGameConceptInfo } from '@daoyou/game-content/presentation/concepts';
import { useState } from 'react';
import {
  affordableExchangeCount,
  type ExchangeBlock,
  useExchangeCart,
} from './useExchangeCart';

const kinds = {
  all: '全部',
  equipment: '道装',
  consumable: '消耗品',
  material: '材料',
  seed: '灵种',
  beast_book: '传承灵印',
  beast_refinement: '归元灵露',
  beast_rejuvenation: '化生果',
  manual_jade: '功法玉简',
  blueprint: '图纸',
  inscription: '阵纹',
};

const blockMessage: Record<Exclude<ExchangeBlock, 'short'>, string> = {
  limit: '此物已达兑换上限',
  loading: '读取余额中',
  full: `一次最多选择 ${ITEM_EXCHANGE_CART_MAX_LINES} 种`,
};

export interface ItemExchangeShelfProps {
  items: ItemExchangeShopItemView[];
  balance: number | undefined;
  currencyConcept: 'reputation' | 'contribution';
  pending: boolean;
  cart: ReturnType<typeof useExchangeCart>;
  onCheckout: () => void;
  onUnavailable: (message: string) => void;
  loading?: boolean;
  loadingText: string;
  emptyText: string;
}

export function ItemExchangeShelf({
  items,
  balance,
  currencyConcept,
  pending,
  cart,
  onCheckout,
  onUnavailable,
  loading = false,
  loadingText,
  emptyText,
}: ItemExchangeShelfProps) {
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const currency = getGameConceptInfo(currencyConcept);
  if (loading && items.length === 0)
    return <GameLoadingState message={loadingText} variant="inline" />;
  if (!items.length) return <InkNotice>{emptyText}</InkNotice>;
  const visible = items.filter(
    (shop) =>
      shop.item &&
      shop.item.name.includes(query) &&
      (kind === 'all' ||
        findItemDefinition(shop.item.definitionId)?.kind === kind),
  );
  const insufficient =
    balance !== undefined && cart.total > balance ? cart.total - balance : 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <InkInput label="搜索商品" value={query} onChange={setQuery} />
        <InkSelect label="物品分类" value={kind} onChange={setKind}>
          {Object.entries(kinds).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </InkSelect>
      </div>
      {!visible.length && <InkNotice>没有匹配的商品</InkNotice>}
      <InventoryGrid>
        {visible.map((shop) => {
          const count = cart.counts[shop.id];
          const soldOut = shop.remainingPurchases === 0;
          return (
            <div key={shop.id} className="min-w-0">
              <ItemSlot
                item={shop.item!}
                className="w-full"
                quantityLabel="奖励"
                quickOnTouch
                disabled={pending || soldOut}
                selected={Boolean(count)}
                badge={
                  soldOut
                    ? '已罄'
                    : count && count > 1
                      ? `${count}次`
                      : count
                        ? '已选'
                        : undefined
                }
                onQuickAction={
                  soldOut
                    ? undefined
                    : () => {
                        const blocked = cart.toggle(shop, balance);
                        if (blocked)
                          onUnavailable(
                            blocked === 'short'
                              ? `${currency.label}不足`
                              : blockMessage[blocked],
                          );
                      }
                }
              >
                {(close) => (
                  <ExchangePreviewActions
                    shop={shop}
                    balance={balance}
                    reserved={cart.reservedExcept(shop.id)}
                    currencyLabel={currency.label}
                    selectedCount={count}
                    pending={pending}
                    onCount={(next) => {
                      if (
                        !cart.counts[shop.id] &&
                        cart.lines.length >= ITEM_EXCHANGE_CART_MAX_LINES
                      ) {
                        onUnavailable(blockMessage.full);
                        return;
                      }
                      cart.setCount(shop.id, next, balance);
                    }}
                    onRemove={() => {
                      cart.clear([shop.id]);
                      close();
                    }}
                  />
                )}
              </ItemSlot>
              <p className="mt-1 text-center font-mono text-xs">
                {shop.price} {currency.label}
              </p>
            </div>
          );
        })}
      </InventoryGrid>
      {cart.lines.length ? (
        <div className="bg-paper border-ink/20 sticky bottom-[var(--game-bottom-offset)] z-20 flex flex-wrap items-center justify-between gap-3 border-t py-3 text-sm">
          <span>
            已选 <span className="font-mono">{cart.lines.length}</span> 种 ·{' '}
            <span className="font-mono">{cart.pieces}</span> 次 · 合计{' '}
            <strong className="font-mono">{cart.total}</strong> {currency.label}
            {insufficient ? (
              <span className="text-crimson">
                {' '}
                · 还差 <span className="font-mono">{insufficient}</span>
              </span>
            ) : null}
          </span>
          <div className="flex items-center gap-3">
            <InkButton disabled={pending} onClick={() => cart.clear()}>
              清空选择
            </InkButton>
            <InkButton
              disabled={pending || insufficient > 0 || balance === undefined}
              pending={pending}
              pendingLabel="正在兑换……"
              onClick={onCheckout}
            >
              {balance === undefined
                ? '读取余额中'
                : insufficient
                  ? `${currency.label}不足`
                  : '兑换所选'}
            </InkButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExchangePreviewActions({
  shop,
  balance,
  reserved,
  currencyLabel,
  selectedCount,
  pending,
  onCount,
  onRemove,
}: {
  shop: ItemExchangeShopItemView;
  balance: number | undefined;
  reserved: number;
  currencyLabel: string;
  selectedCount: number | undefined;
  pending: boolean;
  onCount: (count: number) => void;
  onRemove: () => void;
}) {
  const max = affordableExchangeCount(shop, balance, reserved);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? String(selectedCount ?? 1);
  const shown = selectedCount ?? (Number(value) || 1);
  const amount = Number(value);
  const valid = Number.isInteger(amount) && amount >= 1 && amount <= Math.max(max, 1);
  const adjustable = max > 1 || (selectedCount ?? 0) > 1;
  return (
    <div className="space-y-3">
      <p className="font-mono">
        {shop.price} {currencyLabel}
        {shown > 1 ? ` · 合计 ${shop.price * shown}` : ''}
      </p>
      {shop.remainingPurchases !== null && (
        <p>
          本周剩余{' '}
          <span className="font-mono">
            {shop.remainingPurchases} / {shop.perUserLimit}
          </span>{' '}
          次
        </p>
      )}
      {adjustable ? (
        <InkQuantityInput
          label="兑换次数"
          value={value}
          max={Math.max(max, selectedCount ?? 1)}
          disabled={pending}
          onChange={(nextValue) => {
            const next = Number(nextValue);
            if (Number.isInteger(next) && next >= 1) {
              onCount(next);
              setDraft(null);
              return;
            }
            setDraft(nextValue);
          }}
        />
      ) : null}
      <InkButton
        disabled={
          pending ||
          (selectedCount
            ? false
            : shop.remainingPurchases === 0 ||
              balance === undefined ||
              max < 1 ||
              !valid)
        }
        onClick={() => {
          if (selectedCount) onRemove();
          else onCount(amount);
        }}
      >
        {selectedCount
          ? '移出选购'
          : shop.remainingPurchases === 0
            ? '本周已罄'
            : balance === undefined
              ? '读取余额中'
              : max < 1
                ? `${currencyLabel}不足`
                : '加入选购'}
      </InkButton>
    </div>
  );
}

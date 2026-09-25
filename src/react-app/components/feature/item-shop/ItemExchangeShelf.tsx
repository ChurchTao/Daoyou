import {
  InventoryGrid,
  ItemSlot,
} from '@app/components/feature/items/ItemSlot';
import { GameLoadingState } from '@app/components/game-shell';
import { InkButton, InkInput, InkNotice, InkSelect } from '@app/components/ui';
import type { ItemExchangeShopItemView } from '@shared/contracts/itemExchangeShop';
import { findItemDefinition } from '@shared/items/registry';
import { getGameConceptInfo } from '@shared/lib/gameConceptDisplay';
import { useState } from 'react';

const kinds = {
  all: '全部',
  equipment: '道装',
  consumable: '消耗品',
  material: '材料',
  seed: '灵种',
  beast_book: '传承灵印',
  beast_refinement: '归元灵露',
  manual_jade: '功法玉简',
  blueprint: '图纸',
  inscription: '阵纹',
};
export interface ItemExchangeShelfProps {
  items: ItemExchangeShopItemView[];
  balance: number | undefined;
  currencyConcept: 'reputation' | 'contribution';
  buyingId: string | null;
  onBuy: (item: ItemExchangeShopItemView) => void;
  loading?: boolean;
  loadingText: string;
  emptyText: string;
}
export function ItemExchangeShelf({
  items,
  balance,
  currencyConcept,
  buyingId,
  onBuy,
  loading = false,
  loadingText,
  emptyText,
}: ItemExchangeShelfProps) {
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const currency = getGameConceptInfo(currencyConcept);
  if (loading)
    return <GameLoadingState message={loadingText} variant="inline" />;
  if (!items.length) return <InkNotice>{emptyText}</InkNotice>;
  const visible = items.filter(
    (s) =>
      s.item &&
      s.item.name.includes(query) &&
      (kind === 'all' ||
        findItemDefinition(s.item.definitionId)?.kind === kind),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <InkInput label="搜索商品" value={query} onChange={setQuery} />
        <InkSelect label="物品分类" value={kind} onChange={setKind}>
          {Object.entries(kinds).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </InkSelect>
      </div>
      {!visible.length && <InkNotice>没有匹配的商品</InkNotice>}
      <InventoryGrid>
        {visible.map((shop) => (
          <div key={shop.id} className="min-w-0">
            <ItemSlot
              item={shop.item!}
              className="w-full"
              quantityLabel="奖励"
              badge={shop.remainingPurchases === 0 ? '已罄' : undefined}
            >
              {() => (
                <div className="space-y-3">
                  <p className="font-mono">
                    {shop.price} {currency.label}
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
                  <InkButton
                    disabled={
                      buyingId !== null ||
                      shop.remainingPurchases === 0 ||
                      balance === undefined ||
                      balance < shop.price
                    }
                    pending={buyingId === shop.id}
                    onClick={() => onBuy(shop)}
                  >
                    {shop.remainingPurchases === 0
                      ? '本周已罄'
                      : balance === undefined
                        ? '读取余额中'
                        : balance < shop.price
                          ? `${currency.label}不足`
                          : '兑换'}
                  </InkButton>
                </div>
              )}
            </ItemSlot>
            <p className="mt-1 text-center font-mono text-xs">
              {shop.price} {currency.label}
            </p>
          </div>
        ))}
      </InventoryGrid>
    </div>
  );
}

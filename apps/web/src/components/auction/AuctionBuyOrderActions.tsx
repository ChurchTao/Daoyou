import {
  InkButton,
  InkQuantityInput,
  InkSelect,
} from '@app/components/ui';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import { useInventoryBag } from '@app/lib/resources/bag';
import type { AuctionBuyOrderView } from '@daoyou/contracts/auction';
import { calculateAuctionSettlement } from '@daoyou/game-rules/auction';
import { useState } from 'react';

export function AuctionBuyOrderActions({
  order,
  ownerId,
  now,
  pendingId,
  onSupply,
  onCancel,
  close,
}: {
  order: AuctionBuyOrderView;
  ownerId?: string;
  now: number;
  pendingId: string | null;
  onSupply: (
    order: AuctionBuyOrderView,
    itemId: string,
    revision: number,
    quantity: number,
  ) => Promise<boolean>;
  onCancel: (order: AuctionBuyOrderView) => Promise<boolean>;
  close: () => void;
}) {
  const isOwner = order.buyerId === ownerId;
  const bagQuery = useInventoryBag(!isOwner);
  const [quantity, setQuantity] = useState('1');
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const supplyableIds = new Set(order.supplyableItems.map((item) => item.id));
  const stacks = [...(bagQuery.data?.items ?? [])]
    .filter((item) => supplyableIds.has(item.id))
    .sort((a, b) => b.quantity - a.quantity);
  const stack =
    stacks.find((item) => item.id === selectedItemId) ?? stacks[0];
  const maxQuantity = Math.min(
    order.remainingQuantity,
    stack?.quantity ?? 0,
  );
  const count = Number(quantity);
  const validQuantity =
    Number.isInteger(count) && count >= 1 && count <= maxQuantity;
  const quote = validQuantity
    ? calculateAuctionSettlement(order.price, count)
    : null;
  const minutes = Math.max(
    0,
    Math.ceil((new Date(order.expiresAt).getTime() - now) / 60000),
  );
  const expired = minutes === 0;
  const refund = order.remainingQuantity * order.price;
  return (
    <div className="space-y-3 text-sm">
      <div className="text-ink-secondary flex flex-wrap gap-x-3">
        <span>
          求购者：{order.buyerName}
          {isOwner ? '（我）' : ''}
        </span>
        <span className={expired ? 'text-crimson' : undefined}>
          {expired
            ? '已过期'
            : `剩余 ${Math.floor(minutes / 60)}时${minutes % 60}分`}
        </span>
      </div>
      <p>
        收购单价 <SpiritStones amount={order.price} />／件 · 剩余{' '}
        <span className="font-mono">{order.remainingQuantity}</span> 件
      </p>
      {isOwner ? (
        <>
          <p className="text-amber-800">
            撤单后剩余冻结{' '}
            <SpiritStones amount={refund} className="font-semibold" />。
          </p>
          <p className="text-ink-secondary">
            冻结灵石通过邮件退回，已成交部分不受影响。
          </p>
          <InkButton
            variant="secondary"
            disabled={!!pendingId || expired}
            pending={pendingId === order.id}
            pendingLabel="处理中……"
            onClick={async () => {
              if (await onCancel(order)) close();
            }}
          >
            取消收购
          </InkButton>
        </>
      ) : (
        <>
          {stack ? (
            <div className="space-y-3">
              {stacks.length > 1 ? (
                <InkSelect
                  label="供货堆叠"
                  value={stack.id}
                  onChange={(value) => setSelectedItemId(value)}
                  disabled={!!pendingId}
                >
                  {stacks.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.quantity}件
                    </option>
                  ))}
                </InkSelect>
              ) : null}
              <div>
                <InkQuantityInput
                  showLabel
                  fullWidth
                  label="供货数量"
                  max={maxQuantity}
                  value={quantity}
                  onChange={setQuantity}
                  disabled={!!pendingId}
                />
                <p className="text-ink-secondary mt-1">
                  从背包「{stack.name}」扣除，最多可供{' '}
                  <span className="font-mono">{maxQuantity}</span> 件。
                </p>
              </div>
            </div>
          ) : (
            <p className="text-ink-secondary">
              {bagQuery.loading
                ? '正在核对背包……'
                : order.targetMode === 'condition'
                  ? '背包中没有符合收购条件的材料，无法供货。'
                  : '背包中没有与收购目标完全一致的物品，无法供货。'}
            </p>
          )}
          {quote ? (
            <p className="text-amber-800">
              成交额 <SpiritStones amount={quote.grossAmount} /> · 税费{' '}
              <SpiritStones amount={quote.feeAmount} /> · 实得{' '}
              <SpiritStones amount={quote.sellerAmount} className="font-semibold" />
            </p>
          ) : null}
          <p className="text-ink-secondary">
            收购款通过邮件发放，灵石与物品都需要领取。
          </p>
          <InkButton
            variant="primary"
            disabled={!!pendingId || expired || !stack || !validQuantity}
            pending={pendingId === order.id}
            pendingLabel="处理中……"
            onClick={async () => {
              if (!stack) return;
              if (await onSupply(order, stack.id, stack.revision, count))
                close();
            }}
          >
            供货
          </InkButton>
        </>
      )}
    </div>
  );
}

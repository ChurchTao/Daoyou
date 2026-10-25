import {
  InventoryGrid,
  ItemSlot,
} from '@app/components/feature/items/ItemSlot';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import type { AuctionBuyOrderView } from '@daoyou/contracts/auction';
import type { ReactNode } from 'react';

type Actions = (
  order: AuctionBuyOrderView,
  close: () => void,
) => ReactNode;

export function AuctionBuyOrders({
  orders,
  ownerId,
  actions,
}: {
  orders: AuctionBuyOrderView[];
  ownerId?: string;
  actions: Actions;
}) {
  return (
    <InventoryGrid className="grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6 lg:grid-cols-8">
      {orders.map((order) => (
        <div key={order.id} className="min-w-0">
          <ItemSlot
            className="w-full"
            item={{ ...order.item, quantity: order.remainingQuantity }}
            quantityLabel="库存"
            badge={
              order.buyerId === ownerId
                ? '我的'
                : order.supplyableQuantity > 0
                  ? '可供'
                  : undefined
            }
          >
            {(close) => actions(order, close)}
          </ItemSlot>
          <p
            className="mt-1 text-center text-xs"
            aria-label={`收购单价 ${order.price.toLocaleString()} 灵石`}
          >
            <SpiritStones amount={order.price} />
            {' · 收 '}
            <span className="font-mono">{order.remainingQuantity}</span>
          </p>
        </div>
      ))}
    </InventoryGrid>
  );
}

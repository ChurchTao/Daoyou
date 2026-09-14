import { useCultivatorCurrency } from '@app/lib/resources/player';
import type { ReactNode } from 'react';

/** Shared status row for bag management and item selection. */
export function InventoryHeader({
  title = '随身物品',
  capacity,
  actions,
}: {
  title?: ReactNode;
  capacity: ReactNode;
  actions?: ReactNode;
}) {
  const { data } = useCultivatorCurrency();
  return (
    <div className="@container">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm @min-[24rem]:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="min-w-0">{title}</div>
        <div className="text-ink-secondary order-3 col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs @min-[24rem]:order-2 @min-[24rem]:col-span-1">
          <span
            className="whitespace-nowrap"
            aria-live="polite"
            aria-atomic="true"
          >
            <span aria-hidden="true">💰</span>{' '}
            <span className="font-mono">
              {data?.spiritStones === undefined
                ? '—'
                : data.spiritStones.toLocaleString('zh-CN')}
            </span>{' '}
            灵石
          </span>
          <span className="font-mono whitespace-nowrap">{capacity}</span>
        </div>
        {actions ? (
          <div className="order-2 justify-self-end @min-[24rem]:order-3">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

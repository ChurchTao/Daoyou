import type { InventoryView } from '@shared/contracts/inventory';
import { BAG_CAPACITY } from '@shared/inventory';
import type { ComponentProps } from 'react';
import { InventoryGrid, ItemSlot } from './ItemSlot';

type Item = InventoryView['items'][number];
/** Bag positions and item previews have one owner across management and selection flows. */
export function InventoryItems({
  items,
  location = 'bag',
  compact = false,
  quickTouchHint = false,
  className,
  slotProps,
}: {
  items: Item[];
  location?: 'bag' | 'storage';
  compact?: boolean;
  quickTouchHint?: boolean;
  className?: string;
  slotProps: (
    item: Item | undefined,
    slot: number,
  ) => Omit<ComponentProps<typeof ItemSlot>, 'item'>;
}) {
  const slots = new Map(items.map((item) => [item.slotIndex, item]));
  const entries =
    location === 'bag' && !compact
      ? Array.from({ length: BAG_CAPACITY }, (_, slot) => ({
          item: slots.get(slot),
          slot,
        }))
      : items.map((item, slot) => ({ item, slot }));
  return (
    <div className="@container">
      {quickTouchHint ? (
        <p className="text-ink-secondary mb-2 text-xs sm:hidden">
          轻点操作，长按查看详情
        </p>
      ) : null}
      <InventoryGrid
        className={className ?? 'w-full grid-cols-5 gap-1.5 sm:grid-cols-5'}
      >
        {entries.map(({ item, slot }) => (
          <ItemSlot
            key={location === 'bag' && !compact ? slot : item!.id}
            item={item}
            emptyLabel=""
            {...slotProps(item, slot)}
          />
        ))}
      </InventoryGrid>
    </div>
  );
}

import type { InventoryView } from '@shared/contracts/inventory';
import { BAG_CAPACITY } from '@shared/inventory';
import type { ComponentProps } from 'react';
import { InventoryGrid, ItemSlot } from './ItemSlot';

type Item = InventoryView['items'][number];
/** Bag positions and item previews have one owner across management and selection flows. */
export function InventoryItems({
  items,
  location = 'bag',
  className,
  slotProps,
}: {
  items: Item[];
  location?: 'bag' | 'storage';
  className?: string;
  slotProps: (
    item: Item | undefined,
    slot: number,
  ) => Omit<ComponentProps<typeof ItemSlot>, 'item'>;
}) {
  const slots = new Map(items.map((item) => [item.slotIndex, item]));
  const entries =
    location === 'bag'
      ? Array.from({ length: BAG_CAPACITY }, (_, slot) => ({
          item: slots.get(slot),
          slot,
        }))
      : items.map((item, slot) => ({ item, slot }));
  return (
    <div className="@container">
      <InventoryGrid
        className={
          className ??
          'w-full grid-cols-4 gap-1 sm:grid-cols-4 @min-[360px]:grid-cols-5 @min-[480px]:grid-cols-8'
        }
      >
        {entries.map(({ item, slot }) => (
          <ItemSlot
            key={location === 'bag' ? slot : item!.id}
            item={item}
            emptyLabel=""
            {...slotProps(item, slot)}
          />
        ))}
      </InventoryGrid>
    </div>
  );
}

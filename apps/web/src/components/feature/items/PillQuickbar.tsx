import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { useInventoryBag } from '@app/lib/resources/bag';
import type { InventoryView } from '@daoyou/contracts/inventory';
import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';
import { itemDefinition } from '@daoyou/game-rules/inventory';
import { useRef, useState } from 'react';
import { ConsumableUseActions } from './ConsumableUseActions';
import { consumeInventoryItem } from './consumeInventoryItem';
import { BagInventoryItems } from './InventoryItems';

type Item = InventoryView['items'][number];

/** A filtered view of the shared bag; consumption updates the same resource store. */
export function PillQuickbar({
  disabled,
  onPendingChange,
}: {
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const bag = useInventoryBag();
  const { pushToast } = useInkUI();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const unavailable = disabled || pending || bag.isRefreshing || !!bag.error;
  const pills = (bag.data?.items ?? []).filter((item) => {
    if (itemDefinition(item.definitionId).kind !== 'consumable') return false;
    return ConsumableFactsSchema.parse(item.instanceData).spec.kind === 'pill';
  });

  async function consume(item: Item, quantity: number, close: () => void) {
    if (busy.current || unavailable) return;
    busy.current = true;
    setPending(true);
    onPendingChange(true);
    try {
      await consumeInventoryItem(item, quantity);
      close();
      pushToast({ message: '丹药已服用。', tone: 'success' });
    } catch (error) {
      bag.invalidate();
      close();
      pushToast({
        message:
          error instanceof Error
            ? error.message
            : '服用未完成，请重新核对丹药状态。',
        tone: 'danger',
      });
    } finally {
      busy.current = false;
      setPending(false);
      onPendingChange(false);
    }
  }

  return (
    <section
      aria-label="随身丹药"
      className="border-ink/15 space-y-3 border-t pt-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-medium">随身丹药</h2>
        <span className="text-ink-secondary text-xs">点击丹药，查看并服用</span>
      </div>
      {bag.error ? (
        <div role="alert" className="text-crimson text-sm">
          {bag.error}{' '}
          <InkButton onClick={() => void bag.reload()}>重试</InkButton>
        </div>
      ) : !bag.data ? (
        <p role="status" className="text-ink-secondary text-sm">
          正在读取丹药……
        </p>
      ) : pills.length ? (
        <div className="max-w-xl">
          <BagInventoryItems
            items={pills}
            compact
            slotProps={(item) => ({
              disabled: unavailable,
              children: item
                ? (close) => (
                    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
                      <ConsumableUseActions
                        key={`${item.id}:${item.revision}`}
                        item={item}
                        pending={unavailable}
                        onUse={(quantity) =>
                          void consume(item, quantity, close)
                        }
                      />
                    </div>
                  )
                : undefined,
            })}
          />
        </div>
      ) : (
        <p className="text-ink-secondary py-2 text-sm">储物袋中暂无丹药。</p>
      )}
    </section>
  );
}

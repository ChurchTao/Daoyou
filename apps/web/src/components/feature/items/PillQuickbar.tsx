import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { useInventoryBag } from '@app/lib/resources/bag';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import type { InventoryView } from '@daoyou/contracts/inventory';
import type { BodyCultivationTrackPath } from '@daoyou/game-domain/condition';
import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';
import {
  getBodyTrackKeyFromPath,
  isBodyCultivationTrackPath,
  isLegacyTemperingTrackPath,
} from '@daoyou/game-rules/body-cultivation/progress';
import { itemDefinition } from '@daoyou/game-rules/inventory';
import { useRef, useState } from 'react';
import { ConsumableUseActions } from './ConsumableUseActions';
import { consumeInventoryItem } from './consumeInventoryItem';
import { BagInventoryItems, InventoryItems } from './InventoryItems';

type Item = InventoryView['items'][number];

/** A filtered view of the shared bag; consumption updates the same resource store. */
export function PillQuickbar({
  disabled,
  onPendingChange,
  trainingTrack,
}: {
  trainingTrack?: BodyCultivationTrackPath | 'marrow_wash';
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const bag = useInventoryBag();
  const profile = useCultivatorIdentity();
  const condition = useCultivatorCondition();
  const { pushToast } = useInkUI();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const PillInventory = trainingTrack ? InventoryItems : BagInventoryItems;
  const unavailable = disabled || pending || bag.isRefreshing || !!bag.error;
  const pills = (bag.data?.items ?? []).filter((item) => {
    if (itemDefinition(item.definitionId).kind !== 'consumable') return false;
    const { spec } = ConsumableFactsSchema.parse(item.instanceData);
    return (
      spec.kind === 'pill' &&
      (!trainingTrack ||
        spec.operations.some((operation) => {
          if (operation.type !== 'advance_track' || operation.value <= 0)
            return false;
          const track =
            isBodyCultivationTrackPath(operation.track) ||
            isLegacyTemperingTrackPath(operation.track)
              ? `body.${getBodyTrackKeyFromPath(operation.track)}`
              : operation.track;
          return track === trainingTrack;
        }))
    );
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
        message: error instanceof Error ? error.message : '服用失败，请重试。',
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
      <h2 className="text-sm font-medium">
        {trainingTrack ? '丹药' : '随身丹药'}
      </h2>
      {bag.error ? (
        <div role="alert" className="text-crimson text-sm">
          {bag.error}{' '}
          <InkButton onClick={() => void bag.reload()}>重试</InkButton>
        </div>
      ) : !bag.data ? (
        <p role="status" className="text-ink-secondary text-sm">
          正在读取……
        </p>
      ) : pills.length ? (
        <div className="max-w-xl">
          <PillInventory
            items={pills}
            compact
            className={
              trainingTrack
                ? 'grid-cols-[repeat(auto-fill,6rem)] gap-2 sm:grid-cols-[repeat(auto-fill,6rem)]'
                : undefined
            }
            slotProps={(item) => ({
              className: trainingTrack
                ? '[&_.line-clamp-2]:text-xs [&_.line-clamp-2]:leading-4'
                : undefined,
              disabled: pending,
              previewOptions: {
                realm: profile.data?.cultivator.realm,
                condition: condition.data ?? undefined,
              },
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
        <p className="text-ink-secondary py-2 text-sm">
          {trainingTrack ? '暂无可用丹药' : '暂无丹药'}
        </p>
      )}
    </section>
  );
}

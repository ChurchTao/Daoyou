import { ConsumableUseActions } from '@app/components/feature/items/ConsumableUseActions';
import { consumeInventoryItem } from '@app/components/feature/items/consumeInventoryItem';
import { BagInventoryItems } from '@app/components/feature/items/InventoryItems';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCultivatorCondition } from '@app/lib/resources/player';
import type { InventoryView } from '@daoyou/contracts/inventory';
import { beastLureCharges } from '@daoyou/game-rules/combat/wild';
import { itemDefinition } from '@daoyou/game-rules/inventory';
import { useRef, useState } from 'react';

type Item = InventoryView['items'][number];

/** Seeking-page lure state. Unlit opens the shared bag so the incense can be used here. */
export function WildLureStatus({
  fallbackSearches,
}: {
  fallbackSearches: number;
}) {
  const condition = useCultivatorCondition();
  const searches = condition.data
    ? beastLureCharges(condition.data)
    : fallbackSearches;
  const lit = searches > 0;
  const [open, setOpen] = useState(false);
  const bag = useInventoryBag(open);
  const { pushToast } = useInkUI();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const incense = (bag.data?.items ?? []).filter(
    (item) => itemDefinition(item.definitionId).kind === 'beast_lure',
  );

  async function ignite(item: Item, close: () => void) {
    if (busy.current || pending) return;
    busy.current = true;
    setPending(true);
    try {
      await consumeInventoryItem(item, 1);
      close();
      setOpen(false);
      pushToast({ message: '引妖香已点燃。', tone: 'success' });
    } catch (error) {
      bag.invalidate();
      pushToast({
        message: error instanceof Error ? error.message : '引妖香没有点燃。',
        tone: 'danger',
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <div className="inline-flex items-center gap-1.5 text-sm leading-6">
        <span className={lit ? 'wild-lure-flame' : undefined}>
          <GameIcon value="🪔" className="text-lg" />
        </span>
        <span>引妖香：</span>
        {lit ? (
          <span role="status">
            <span className="font-mono font-semibold tracking-tight">
              {searches}
            </span>
            次
          </span>
        ) : (
          <button
            type="button"
            className="text-ink hover:text-crimson -my-2 cursor-pointer py-2 underline decoration-ink/30 underline-offset-4 hover:decoration-crimson/50"
            aria-label="打开储物袋点燃引妖香"
            onClick={() => setOpen(true)}
          >
            未点燃
          </button>
        )}
      </div>
      <InkDetailDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title="引妖香"
        size="md"
      >
        <LureBag
          error={bag.error}
          ready={!!bag.data}
          pending={pending || bag.isRefreshing}
          items={incense}
          onRetry={() => void bag.reload()}
          onUse={(item, close) => void ignite(item, close)}
        />
      </InkDetailDrawer>
    </>
  );
}

function LureBag({
  error,
  ready,
  pending,
  items,
  onRetry,
  onUse,
}: {
  error?: string;
  ready: boolean;
  pending: boolean;
  items: Item[];
  onRetry: () => void;
  onUse: (item: Item, close: () => void) => void;
}) {
  if (error) {
    return (
      <p role="alert" className="text-crimson text-sm">
        {error} <InkButton onClick={onRetry}>重新读取</InkButton>
      </p>
    );
  }
  if (!ready) {
    return (
      <p role="status" className="text-ink-secondary text-sm">
        正在读取储物袋……
      </p>
    );
  }
  if (!items.length) {
    return <p className="text-ink-secondary text-sm">储物袋里还没有引妖香。</p>;
  }
  return (
    <BagInventoryItems
      items={items}
      compact
      slotProps={(item) => ({
        disabled: pending,
        children: item
          ? (close) => (
              <ConsumableUseActions
                key={`${item.id}:${item.revision}`}
                item={item}
                pending={pending}
                onUse={() => onUse(item, close)}
              />
            )
          : undefined,
      })}
    />
  );
}

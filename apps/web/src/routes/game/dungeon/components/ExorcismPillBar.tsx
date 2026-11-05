import { ConsumableUseActions } from '@app/components/feature/items/ConsumableUseActions';
import { consumeInventoryItem } from '@app/components/feature/items/consumeInventoryItem';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { useInventoryBag } from '@app/lib/resources/bag';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import type { ExorcismRunState } from '@daoyou/game-domain/dungeon/exorcism';
import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';
import { isDungeonRecoveryPill } from '@daoyou/game-rules/dungeon';
import { useRef, useState } from 'react';

/**
 * 两场之间服用回复丹药，作用到局内状态。用标准物品格和物品预览，
 * 看详情、选数量、服用都和背包一致。这枚丹能补的都已补满时只能查看，不能服用。
 */
export function ExorcismPillBar({
  run,
  processing,
  onUsed,
}: {
  run: ExorcismRunState;
  processing: boolean;
  onUsed: () => Promise<void>;
}) {
  const bag = useInventoryBag();
  const profile = useCultivatorIdentity();
  const condition = useCultivatorCondition();
  const { pushToast } = useInkUI();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const player = run.resources?.player;
  if (!player) return null;
  const full = { hp: player.hp >= player.maxHp, mp: player.mp >= player.maxMp };

  const pills = (bag.data?.items ?? []).flatMap((item) => {
    if (item.definitionId !== 'consumable.v1') return [];
    const facts = ConsumableFactsSchema.safeParse(item.instanceData);
    if (
      !facts.success ||
      facts.data.spec.kind !== 'pill' ||
      !isDungeonRecoveryPill(facts.data)
    )
      return [];
    const wasted = facts.data.spec.operations.every(
      (operation) =>
        operation.type !== 'restore_resource' ||
        full[operation.resource === 'hp' ? 'hp' : 'mp'],
    );
    return [{ item, wasted }];
  });
  const wasted = new Set(
    pills.filter((pill) => pill.wasted).map((pill) => pill.item.id),
  );

  const use = async (
    entry: (typeof pills)[number]['item'],
    quantity: number,
    close: () => void,
  ) => {
    if (busy.current || processing) return;
    busy.current = true;
    setPending(true);
    try {
      await consumeInventoryItem(entry, quantity);
      close();
      pushToast({ message: '丹药已服用。', tone: 'success' });
    } catch (error) {
      close();
      pushToast({
        message: error instanceof Error ? error.message : '服药结果未确认',
        tone: 'warning',
      });
    } finally {
      // 成败都以服务端为准，不自动重试。
      await Promise.all([bag.reload(), onUsed()]);
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <section aria-label="回复丹药" className="space-y-2">
      <div>
        <h3 className="text-sm font-medium">回复丹药</h3>
        <p className="text-ink-secondary text-xs leading-5">
          局内状态独立于现实，时间不会恢复，只有调息和回复丹药能回。战斗中不能服药。
        </p>
      </div>
      {!bag.data ? null : pills.length ? (
        <InventoryItems
          items={pills.map((pill) => pill.item)}
          compact
          className="grid-cols-[repeat(auto-fill,4.5rem)] gap-1.5 sm:grid-cols-[repeat(auto-fill,4.5rem)]"
          slotProps={(item) => ({
            disabled: pending || processing || (!!item && wasted.has(item.id)),
            previewOptions: {
              realm: profile.data?.cultivator.realm,
              condition: condition.data ?? undefined,
            },
            children: item
              ? (close) =>
                  wasted.has(item.id) ? (
                    <p className="text-ink-secondary text-sm">
                      局内已满，现在不用服。
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
                      <ConsumableUseActions
                        key={`${item.id}:${item.revision}`}
                        item={item}
                        pending={pending || processing}
                        onUse={(quantity) => void use(item, quantity, close)}
                      />
                    </div>
                  )
              : undefined,
          })}
        />
      ) : (
        <p className="text-ink-secondary text-xs">储物袋里没有回复丹药。</p>
      )}
    </section>
  );
}

import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorCondition } from '@app/lib/resources/player';
import type { InventoryView } from '@shared/contracts/inventory';
import { itemDefinition } from '@shared/inventory';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { canUseDungeonRecoveryPill } from '@shared/lib/dungeon/rest';
import type { DungeonState } from '@shared/lib/dungeon/types';
import type { Cultivator } from '@shared/types/cultivator';
import { useRef, useState } from 'react';

export interface DungeonDisplayResources {
  hp: { current: number; max: number; percent: number };
  mp: { current: number; max: number; percent: number };
}

export function DungeonRunPanel({
  state,
  displayResources,
  onQuit,
  processing,
}: {
  state: DungeonState;
  cultivator: Pick<Cultivator, 'realm' | 'condition'> | null;
  displayResources?: {
    hp: { current: number; max: number };
    mp: { current: number; max: number };
  };
  onQuit: () => Promise<boolean>;
  processing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const bagQuery = useInventoryBag();
  const bag = bagQuery.data;
  const readError = bagQuery.error;
  const busy = useRef(false);
  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();
  const condition = useCultivatorCondition();
  const unavailable =
    !bag ||
    bagQuery.isRefreshing ||
    !!readError ||
    !!condition.error ||
    condition.loading ||
    condition.isRefreshing;
  const rewards = (state.v6Rewards ?? [])
    .flatMap((r) => r.items)
    .map(
      (item) => `${itemDefinition(item.definitionId).name} ×${item.quantity}`,
    );
  const refresh = () => Promise.all([bagQuery.reload(), condition.reload()]);
  const readInventory = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setOpen(true);
    try {
      await refresh();
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const consume = async (item: InventoryView['items'][number]) => {
    if (busy.current || processing || unavailable) return;
    busy.current = true;
    setPending(true);
    try {
      await mutate(
        fetch('/api/cultivator/consume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consumableId: item.id,
            revision: item.revision,
          }),
          signal: AbortSignal.timeout(15000),
        }),
      );
      pushToast({ message: `已使用一枚${item.name}`, tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '使用结果未确认',
        tone: 'danger',
      });
    } finally {
      // Verify actual stock after either success or an uncertain response.
      // Never replay the consumption request automatically.
      await refresh();
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>
          探索 {state.currentRound}/{state.maxRounds}
        </span>
        <div className="flex gap-2">
          <InkButton
            disabled={processing || pending}
            onClick={() => void readInventory()}
          >
            休整与收获
          </InkButton>
          <InkButton
            disabled={pending || processing || !!state.activeBattleId}
            onClick={() => void onQuit()}
          >
            结束探索
          </InkButton>
        </div>
      </div>
      <InkDetailDrawer
        isOpen={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="休整与收获"
      >
        <div className="space-y-4">
          <p className="font-mono">
            气血 {Math.floor(displayResources?.hp.current ?? 0)}/
            {displayResources?.hp.max ?? 0}
            {' · '}法力 {Math.floor(displayResources?.mp.current ?? 0)}/
            {displayResources?.mp.max ?? 0}
          </p>
          <p>
            {rewards.length ? rewards.join('、') : '暂未获得物品'}
            。离开秘境时统一结算。
          </p>
          <p>选择随身恢复丹药，查看药效后使用一枚。</p>
          {readError || condition.error ? (
            <p role="alert">
              {readError || '人物资源读取失败，请重新读取后再用药。'}
            </p>
          ) : null}
          <InkButton
            disabled={pending || processing}
            onClick={() => void readInventory()}
          >
            {pending ? '正在核实…' : '重新读取'}
          </InkButton>
          <InventoryItems
            items={bag?.items ?? []}
            slotProps={(item) => {
              const facts =
                item?.definitionId === 'consumable.v1'
                  ? ConsumableFactsSchema.safeParse(item.instanceData)
                  : undefined;
              const eligible =
                facts?.success && canUseDungeonRecoveryPill(state, facts.data);
              return {
                disabled: !item || pending || processing || unavailable,
                badge: eligible ? '可选' : undefined,
                children: item
                  ? (close) => (
                      <div className="space-y-2">
                        {!eligible ? <p>此物不能用于秘境休整。</p> : null}
                        <InkButton
                          disabled={
                            !eligible || pending || processing || unavailable
                          }
                          onClick={() => {
                            close();
                            void consume(item);
                          }}
                        >
                          使用一枚
                        </InkButton>
                      </div>
                    )
                  : undefined,
              };
            }}
          />
        </div>
      </InkDetailDrawer>
    </div>
  );
}

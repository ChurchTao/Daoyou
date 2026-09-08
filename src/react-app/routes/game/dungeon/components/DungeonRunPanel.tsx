import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useConsumableInventoryResource } from '@app/lib/resources/inventory';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { itemDefinition } from '@shared/inventory';
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
  const busy = useRef(false);
  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();
  const inventory = useConsumableInventoryResource({
    pageSize: 40,
    enabled: open,
    consumableKind: 'pill',
  });
  const pills = (inventory.items ?? []).filter(
    (item) =>
      item.spec.kind === 'pill' &&
      item.spec.operations.length > 0 &&
      item.spec.operations.some((op) => op.type === 'restore_resource') &&
      item.spec.operations.every(
        (op) => op.type === 'restore_resource' || op.type === 'change_gauge',
      ),
  );
  const rewards = (state.v6Rewards ?? [])
    .flatMap((r) => r.items)
    .map(
      (item) => `${itemDefinition(item.definitionId).name} ×${item.quantity}`,
    );
  const consume = async (consumableId: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await mutate(
        fetch('/api/cultivator/consume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consumableId }),
        }),
      );
      await inventory.reload();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '使用失败',
        tone: 'danger',
      });
    } finally {
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
          <InkButton disabled={processing} onClick={() => setOpen(true)}>
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
        onClose={() => setOpen(false)}
        title="休整与收获"
      >
        <div className="space-y-4">
          <p>
            气血 {Math.floor(displayResources?.hp.current ?? 0)}/
            {displayResources?.hp.max ?? 0} · 法力{' '}
            {Math.floor(displayResources?.mp.current ?? 0)}/
            {displayResources?.mp.max ?? 0}
          </p>
          <p>
            {rewards.length ? rewards.join('、') : '暂未获得物品'}
            。离开秘境时统一结算。
          </p>
          {pills.map((item) => (
            <InkButton
              key={item.id}
              disabled={pending || !!state.activeBattleId}
              onClick={() => void consume(item.id!)}
            >
              {item.name} ×{item.quantity}
            </InkButton>
          ))}
          {!pills.length ? <p>本页暂无可用于休整的恢复丹药。</p> : null}
          {(inventory.pagination?.totalPages ?? 0) > 1 ? (
            <div className="flex items-center gap-3">
              <InkButton
                disabled={pending || inventory.loading || inventory.page <= 1}
                onClick={inventory.goPrevPage}
              >
                上一页
              </InkButton>
              <span>
                {inventory.page} / {inventory.pagination?.totalPages}
              </span>
              <InkButton
                disabled={
                  pending ||
                  inventory.loading ||
                  inventory.page >= (inventory.pagination?.totalPages ?? 1)
                }
                onClick={inventory.goNextPage}
              >
                下一页
              </InkButton>
            </div>
          ) : null}
        </div>
      </InkDetailDrawer>
    </div>
  );
}

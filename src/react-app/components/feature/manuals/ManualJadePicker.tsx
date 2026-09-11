import { InkButton } from '@app/components/ui/InkButton';
import { useInventoryBag } from '@app/lib/resources/bag';
import type {
  ManualAction,
  ManualView,
} from '@shared/contracts/combatV6Manuals';
import { manualSlot } from '@shared/engine/combat-v6/manuals/compiler';
import { CHARACTER_MANUALS_V1 } from '@shared/engine/combat-v6/manuals/content';
import type { CharacterManualDefV1 } from '@shared/engine/combat-v6/manuals/types';
import { itemDefinition } from '@shared/inventory';
import { previewManualAction } from '@shared/manuals/action';
import { InventoryItems } from '../items/InventoryItems';

export function ManualJadePicker({
  view,
  realm,
  manualId,
  disabled,
  onChoose,
}: {
  view: ManualView;
  realm: CharacterManualDefV1['realm'];
  manualId?: string;
  disabled: boolean;
  onChoose: (action: ManualAction) => void;
}) {
  const bag = useInventoryBag();
  const items = bag.data?.items ?? [];
  const choices = items.flatMap((item) => {
    const definition = itemDefinition(item.definitionId);
    const manual = CHARACTER_MANUALS_V1.find(
      (entry) => entry.id === definition.manualId,
    );
    if (
      !manual ||
      manual.realm !== realm ||
      (manualId && manual.id !== manualId) ||
      !view.state
    )
      return [];
    const action: ManualAction = {
      action: manualId ? 'unlock' : 'learn',
      manualId: manual.id,
      slot: manualSlot(manual),
      expectedRevision: view.state.revision,
      item: { id: item.id, revision: item.revision },
    };
    if (
      !previewManualAction(view.state, view.realm, action, view.resources, item)
        .ok
    )
      return [];
    return [{ item, action }];
  });
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-ink-secondary">
          随身物品{' '}
          <span className="font-mono">
            {bag.data?.used ?? '—'}/{bag.data?.capacity ?? '—'}
          </span>{' '}
          格
        </span>
        <InkButton
          disabled={disabled || bag.isRefreshing}
          onClick={() => void bag.reload()}
        >
          刷新
        </InkButton>
      </div>
      <p className="text-ink-secondary">
        {manualId
          ? '选择一本同名玉简，突破当前瓶颈。'
          : `选择一本${realm}功法玉简，开始修习。`}
      </p>
      {bag.error ? (
        <p role="alert">{bag.error}</p>
      ) : bag.loading ? (
        <p role="status">正在读取储物袋……</p>
      ) : null}
      {bag.data && !bag.error && choices.length === 0 ? (
        <p role="status">
          {manualId
            ? '物品栏中暂无可用于突破的同名玉简。'
            : `物品栏中暂无可学习的${realm}功法玉简。`}
        </p>
      ) : null}
      <InventoryItems
        items={items}
        slotProps={(item) => {
          const choice = choices.find((entry) => entry.item.id === item?.id);
          return {
            disabled: disabled || bag.isRefreshing || !!bag.error,
            badge: choice ? '可选' : undefined,
            quickOnTouch: true,
            onQuickAction: choice ? () => onChoose(choice.action) : undefined,
            children: choice
              ? (close) => (
                  <InkButton
                    disabled={disabled || bag.isRefreshing || !!bag.error}
                    onClick={() => {
                      close();
                      onChoose(choice.action);
                    }}
                  >
                    选择玉简
                  </InkButton>
                )
              : item
                ? () => (
                    <p className="text-ink-secondary">
                      {itemDefinition(item.definitionId).kind !== 'manual_jade'
                        ? '此物品不是功法玉简。'
                        : manualId
                          ? '此玉简不能用于当前功法的瓶颈突破。'
                          : '此功法已学习或不属于当前境界位。'}
                    </p>
                  )
                : undefined,
          };
        }}
      />
    </div>
  );
}

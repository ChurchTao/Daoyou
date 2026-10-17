import { ItemPreviewView } from '@app/components/feature/items/ItemPreviewView';
import { itemPreviewModel } from '@app/components/feature/items/itemPreviewModel';
import type { InventoryView } from '@daoyou/contracts/inventory';
import type { DaoEquipmentInstanceV1 } from '@daoyou/game-domain/equipment';
import { previewEquipmentReplacement } from '@daoyou/game-rules/equipment/projection';
import { InventoryEquipmentSchema } from '@daoyou/game-rules/inventory/equipment';
import type { ReactNode } from 'react';

type Item = InventoryView['items'][number];
/** Bag-only preview: existing rows carry equipment deltas, no extra API or writes. */
export function EquipmentComparisonPreview({
  item,
  equipped,
  pending,
  level,
  close,
  actions,
}: {
  item: Item;
  equipped: Item[];
  pending: boolean;
  level?: number;
  close: () => void;
  actions: ReactNode;
}) {
  const equipment = InventoryEquipmentSchema.parse(
    item.instanceData,
  ) as DaoEquipmentInstanceV1;
  const result =
    pending || level === undefined
      ? undefined
      : previewEquipmentReplacement(
          {
            equipment: Object.fromEntries(
              equipped.map((entry) => {
                const data = InventoryEquipmentSchema.parse(
                  entry.instanceData,
                ) as DaoEquipmentInstanceV1;
                return [data.slot, data];
              }),
            ),
            level,
          },
          equipment,
        );
  const model = itemPreviewModel(item, {
    hideQuantity: true,
    equipmentComparison: result?.ok ? result : undefined,
  });
  const context = !result
    ? '正在核对穿戴状态……'
    : !result.ok
      ? result.reason
      : result.previous
        ? `较「${result.previous.name}」的装备属性变化`
        : '当前部位未装备';
  return (
    <div
      data-item-preview={item.definitionId}
      data-equipment-comparison="web-v1"
    >
      <ItemPreviewView
        model={model}
        context={context}
        close={close}
        actions={actions}
      />
    </div>
  );
}

import { InkButton } from '@app/components/ui/InkButton';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCraftStorage } from '@app/lib/resources/craftStorage';
import type {
  ManualAction,
  ManualView,
} from '@shared/contracts/combatV6Manuals';
import type { InventoryView } from '@shared/contracts/inventory';
import { manualSlot } from '@shared/engine/combat-v6/manuals/compiler';
import { CHARACTER_MANUALS_V1 } from '@shared/engine/combat-v6/manuals/content';
import type { CharacterManualDefV1 } from '@shared/engine/combat-v6/manuals/types';
import { itemDefinition } from '@shared/inventory';
import { manualJadeCost, previewManualAction } from '@shared/manuals/action';
import { useState } from 'react';
import { CraftInventoryPanel } from '../items/CraftInventoryPanel';
import {
  inventoryFilterActive,
  matchesInventoryFilters,
  type InventoryFilter,
} from '../items/inventoryFilterModel';
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
  onChoose: (
    action: ManualAction,
    item: InventoryView['items'][number],
  ) => void;
}) {
  const jadeCost =
    manualId && view.state
      ? manualJadeCost(view.state, { action: 'unlock', manualId })
      : 1;
  const bag = useInventoryBag();
  const [source, setSource] = useState<'bag' | 'storage'>('bag');
  const [filter, setFilter] = useState<InventoryFilter>({
    kind: 'manual_jade',
  });
  const storage = useCraftStorage(filter, source === 'storage');
  const inventory = source === 'bag' ? bag.data : storage.view;
  const error = source === 'bag' ? bag.error : storage.error;
  const loading = source === 'bag' ? bag.isRefreshing : storage.loading;
  const items = inventory?.items ?? [];
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
    <CraftInventoryPanel
      source={source}
      onSource={(value) => {
        if (value === 'storage') storage.reload();
        setSource(value);
      }}
      view={inventory}
      loading={loading}
      error={error}
      filter={filter}
      onFilter={(value) => {
        setFilter(value);
        storage.setPage(0);
      }}
      onPage={storage.setPage}
      onReload={() => (source === 'bag' ? void bag.reload() : storage.reload())}
    >
      <p className="text-ink-secondary">
        {manualId
          ? `选择同名玉简，本次突破消耗 ${jadeCost} 本。`
          : `选择一本${realm}功法玉简，开始修习。`}
      </p>
      {inventory && !error && choices.length === 0 ? (
        <p role="status">
          {manualId
            ? `${source === 'bag' ? '储物袋' : '洞府储藏室'}中没有足够的同名玉简，本次需要 ${jadeCost} 本。`
            : `${source === 'bag' ? '储物袋' : '洞府储藏室'}中没有可学习的${realm}功法玉简。`}
        </p>
      ) : null}
      <InventoryItems
        items={
          source === 'bag' && inventoryFilterActive(filter)
            ? items.filter((item) => matchesInventoryFilters(item, filter))
            : items
        }
        location={source}
        compact={source === 'bag' && inventoryFilterActive(filter)}
        slotProps={(item) => {
          const choice = choices.find((entry) => entry.item.id === item?.id);
          return {
            disabled: disabled || loading || !!error,
            badge: choice ? '可选' : undefined,
            quickOnTouch: true,
            onQuickAction: choice
              ? () => onChoose(choice.action, choice.item)
              : undefined,
            children: choice
              ? (close) => (
                  <InkButton
                    disabled={disabled || loading || !!error}
                    onClick={() => {
                      close();
                      onChoose(choice.action, choice.item);
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
    </CraftInventoryPanel>
  );
}

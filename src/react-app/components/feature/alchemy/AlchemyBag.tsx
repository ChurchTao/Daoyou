import {
  defaultInventoryFilter,
  inventoryFilterActive,
  matchesInventoryFilters,
  type InventoryFilter,
} from '@app/components/feature/items/inventoryFilterModel';
import { InkButton } from '@app/components/ui/InkButton';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCraftStorage } from '@app/lib/resources/craftStorage';
import {
  groupAlchemyBagMaterials,
  groupAlchemyStorageMaterials,
} from '@shared/inventory/alchemy';
import type { Material } from '@shared/types/cultivator';
import { useEffect, useState } from 'react';
import { CraftInventoryPanel } from '../items/CraftInventoryPanel';
import { InventoryItems } from '../items/InventoryItems';
import {
  ALCHEMY_MAX_DOSE,
  ALCHEMY_MAX_MATERIALS,
  useAlchemyCraftSession,
} from './alchemyCraftContext';

export function AlchemyBag({
  onChoose,
}: {
  onChoose?: (material: Material, dose: number) => void;
}) {
  const session = useAlchemyCraftSession();
  const bagQuery = useInventoryBag();
  const [source, setSource] = useState<'bag' | 'storage'>('bag');
  const [filter, setFilter] = useState<InventoryFilter>(defaultInventoryFilter);
  const storage = useCraftStorage(filter, source === 'storage');
  const reloadStorage = storage.reload;
  const view = source === 'bag' ? bagQuery.data : storage.view;
  const error = source === 'bag' ? bagQuery.error : storage.error;
  useEffect(() => {
    if (session.phase === 'result') reloadStorage();
  }, [session.phase, reloadStorage]);
  const locked =
    session.phase === 'firing' ||
    session.phase === 'result' ||
    !view ||
    (source === 'bag' ? bagQuery.isRefreshing : storage.loading) ||
    !!error;
  const groups =
    source === 'bag'
      ? groupAlchemyBagMaterials(view?.items ?? [])
      : groupAlchemyStorageMaterials(view?.items ?? []);
  return (
    <CraftInventoryPanel
      source={source}
      onSource={(value) => {
        if (value === 'storage') storage.reload();
        setSource(value);
      }}
      view={view}
      loading={source === 'bag' ? bagQuery.isRefreshing : storage.loading}
      error={error}
      filter={filter}
      onFilter={(value) => {
        setFilter(value);
        storage.setPage(0);
      }}
      onPage={storage.setPage}
      onReload={() =>
        source === 'bag' ? void bagQuery.reload() : storage.reload()
      }
    >
      <InventoryItems
        items={
          source === 'bag' && inventoryFilterActive(filter)
            ? (view?.items ?? []).filter((item) =>
                matchesInventoryFilters(item, filter),
              )
            : (view?.items ?? [])
        }
        location={source}
        compact={source === 'bag' && inventoryFilterActive(filter)}
        quickTouchHint
        slotProps={(item) => {
          const material = groups.find((g) =>
            g.members.some((m) => m.id === item?.id),
          );
          const dose = material
            ? session.materials.doses[material.id]
            : undefined;
          const full =
            session.materials.ids.length >= ALCHEMY_MAX_MATERIALS && !dose;
          const choose = (amount: number) => {
            if (material && !locked)
              (onChoose ?? session.addMaterialToFurnace)(
                { ...material, element: material.element ?? undefined },
                amount,
              );
          };
          return {
            disabled: locked || (!!material && full),
            quickOnTouch: true,
            badge: dose
              ? `已投${dose}`
              : material && !full
                ? '可选'
                : undefined,
            onQuickAction: material
              ? () =>
                  choose(
                    Math.min(
                      (dose ?? 0) + 1,
                      material.quantity,
                      ALCHEMY_MAX_DOSE,
                    ),
                  )
              : undefined,
            children: material
              ? (close) => (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      choose(Number(new FormData(e.currentTarget).get('dose')));
                      close();
                    }}
                  >
                    <label className="flex items-center gap-3">
                      投入份量
                      <input
                        key={dose}
                        aria-label={`${material.name}投入份量`}
                        name="dose"
                        type="number"
                        min={1}
                        max={Math.min(material.quantity, ALCHEMY_MAX_DOSE)}
                        defaultValue={dose ?? 1}
                        required
                        disabled={locked || full}
                        className="border-ink/20 w-20 border bg-transparent p-2 font-mono"
                      />
                    </label>
                    <InkButton type="submit" disabled={locked || full}>
                      {full ? '材料格已满' : dose ? '调整份量' : '投入丹炉'}
                    </InkButton>
                  </form>
                )
              : item
                ? () => (
                    <p className="text-ink-secondary">此物品不能用于炼丹。</p>
                  )
                : undefined,
          };
        }}
      />
    </CraftInventoryPanel>
  );
}

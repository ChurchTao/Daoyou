import {
  defaultInventoryFilter,
  inventoryFilterActive,
  matchesInventoryFilters,
  type InventoryFilter,
} from '@app/components/feature/items/inventoryFilterModel';
import { InkButton } from '@app/components/ui/InkButton';
import { InkQuantityInput } from '@app/components/ui/InkQuantityInput';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCraftStorage } from '@app/lib/resources/craftStorage';
import {
  groupAlchemyBagMaterials,
  groupAlchemyStorageMaterials,
  type AlchemyBagMaterial,
} from '@daoyou/shared/inventory/alchemy';
import type { Material } from '@daoyou/shared/types/cultivator';
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
                  <AlchemyDoseChoice
                    key={dose}
                    material={material}
                    dose={dose}
                    disabled={locked || full}
                    full={full}
                    choose={choose}
                    close={close}
                  />
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

function AlchemyDoseChoice({
  material,
  dose,
  disabled,
  full,
  choose,
  close,
}: {
  material: AlchemyBagMaterial;
  dose?: number;
  disabled: boolean;
  full: boolean;
  choose(amount: number): void;
  close(): void;
}) {
  const [quantity, setQuantity] = useState(String(dose ?? 1));
  const max = Math.min(material.quantity, ALCHEMY_MAX_DOSE);
  const amount = Number(quantity);
  const valid =
    quantity !== '' && Number.isInteger(amount) && amount >= 1 && amount <= max;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || disabled) return;
        choose(amount);
        close();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span>投入份量</span>
        <InkQuantityInput
          label={`${material.name}投入份量`}
          value={quantity}
          onChange={setQuantity}
          max={max}
          disabled={disabled}
        />
      </div>
      <InkButton type="submit" disabled={disabled || !valid}>
        {full ? '材料格已满' : dose ? '调整份量' : '投入丹炉'}
      </InkButton>
    </form>
  );
}

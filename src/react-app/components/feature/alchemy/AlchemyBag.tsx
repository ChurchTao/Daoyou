import { InventoryHeader } from '@app/components/feature/items/InventoryHeader';
import { InkButton } from '@app/components/ui/InkButton';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCraftStorage } from '@app/lib/resources/craftStorage';
import {
  groupAlchemyBagMaterials,
  groupAlchemyStorageMaterials,
} from '@shared/inventory/alchemy';
import type { Material } from '@shared/types/cultivator';
import { useEffect, useState } from 'react';
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
  const storage = useCraftStorage('material', source === 'storage');
  const reloadStorage = storage.reload;
  const view = source === 'bag' ? bagQuery.data : storage.view;
  const error = source === 'bag' ? bagQuery.error : storage.error;
  const [search, setSearch] = useState('');
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
    <div className="space-y-3 text-sm">
      <InventoryHeader
        title={source === 'bag' ? '储物袋' : '储藏室'}
        capacity={
          source === 'bag' ? (
            <>{view?.used ?? '—'} / 40</>
          ) : (
            <>{view?.total ?? '—'} 格</>
          )
        }
        actions={
          <InkButton
            disabled={
              source === 'bag' ? bagQuery.isRefreshing : storage.loading
            }
            onClick={() =>
              source === 'bag' ? void bagQuery.reload() : storage.reload()
            }
          >
            刷新
          </InkButton>
        }
      />
      <div className="flex gap-4" aria-label="材料位置">
        {(
          [
            ['bag', '储物袋'],
            ['storage', '储藏室'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={source === value}
            onClick={() => {
              if (value === 'storage') storage.reload();
              setSource(value);
            }}
            className="text-ink-secondary hover:text-crimson aria-pressed:text-crimson aria-pressed:border-crimson/60 min-h-10 cursor-pointer border-b border-transparent px-1"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <input
          aria-label="搜索物品"
          placeholder="搜索物品"
          value={source === 'bag' ? search : storage.search}
          onChange={(e) =>
            source === 'bag'
              ? setSearch(e.target.value)
              : storage.setSearch(e.target.value)
          }
          className="border-ink/20 min-w-0 flex-1 border-b bg-transparent p-2 text-sm"
        />
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !view ? (
        <p role="status">正在读取{source === 'bag' ? '储物袋' : '储藏室'}……</p>
      ) : null}
      <InventoryItems
        items={
          source === 'bag' && search
            ? (view?.items ?? []).filter((item) =>
                item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
              )
            : (view?.items ?? [])
        }
        location={source}
        compact={source === 'bag' && !!search}
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
      {source === 'storage' && view && view.total > 40 ? (
        <div className="flex items-center justify-between">
          <InkButton
            disabled={locked || view.page === 0}
            onClick={() => storage.setPage(view.page - 1)}
          >
            上一页
          </InkButton>
          <span className="font-mono">
            {view.page + 1} / {Math.ceil(view.total / 40)}
          </span>
          <InkButton
            disabled={locked || (view.page + 1) * 40 >= view.total}
            onClick={() => storage.setPage(view.page + 1)}
          >
            下一页
          </InkButton>
        </div>
      ) : null}
    </div>
  );
}

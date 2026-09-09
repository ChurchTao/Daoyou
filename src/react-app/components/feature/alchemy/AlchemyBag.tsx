import { InkButton } from '@app/components/ui/InkButton';
import type { InventoryView } from '@shared/contracts/inventory';
import { groupAlchemyBagMaterials } from '@shared/inventory/alchemy';
import type { Material } from '@shared/types/cultivator';
import { useEffect, useState } from 'react';
import { combatV6Request } from '../combat-v6/request';
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
  const owner = session.cultivator?.id;
  const [loaded, setLoaded] = useState<{
    owner: string;
    view: InventoryView;
  }>();
  const view = loaded?.owner === owner ? loaded?.view : undefined;
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const locked = session.phase === 'firing' || session.phase === 'result';
  useEffect(() => {
    const controller = new AbortController();
    if (owner)
      void combatV6Request<InventoryView>('/api/combat-v6/inventory', {
        signal: controller.signal,
      })
        .then((data) => {
          if (!controller.signal.aborted) {
            setLoaded({ owner, view: data });
            setError('');
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    return () => controller.abort();
  }, [owner, refresh, session.phase]);
  const groups = groupAlchemyBagMaterials(view?.items ?? []);
  return (
    <div className="space-y-3 text-sm">
      <header className="flex justify-between">
        <h3 className="font-medium">储物袋</h3>
        <span className="text-ink-secondary text-xs">
          {view?.used ?? '—'} / {view?.capacity ?? 40} 格
        </span>
      </header>
      <div className="flex gap-3">
        <input
          aria-label="搜索物品"
          placeholder="搜索物品"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-ink/20 min-w-0 flex-1 border-b bg-transparent p-2 text-sm"
        />
        <InkButton disabled={locked} onClick={() => setRefresh((n) => n + 1)}>
          刷新
        </InkButton>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !view ? (
        <p role="status">正在读取储物袋……</p>
      ) : null}
      <InventoryItems
        items={view?.items ?? []}
        slotProps={(item) => {
          const material = groups.find((g) =>
            g.members.some((m) => m.id === item?.id),
          );
          const dose = material
            ? session.materials.doses[material.id]
            : undefined;
          const matching = !item || item.name.includes(search);
          const full =
            session.materials.ids.length >= ALCHEMY_MAX_MATERIALS && !dose;
          const choose = (amount: number) => {
            if (material)
              (onChoose ?? session.addMaterialToFurnace)(
                { ...material, element: material.element ?? undefined },
                amount,
              );
          };
          return {
            disabled: locked || (!!material && full) || !matching,
            className: !matching ? 'opacity-25' : undefined,
            badge: dose ? `已投${dose}` : undefined,
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
    </div>
  );
}

import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkModal } from '@app/components/layout';
import { InkButton, InkInput, InkNotice } from '@app/components/ui';
import {
  formatDungeonCostName,
  formatDungeonCostValue,
} from '@app/lib/dungeon/formatDungeonCost';
import { useInventoryBag } from '@app/lib/resources/bag';
import type { DungeonMaterialSelection } from '@shared/contracts/combatV6Dungeon';
import type { InventoryView } from '@shared/contracts/inventory';
import {
  consumeDungeonMaterials,
  dungeonMaterialMatches,
} from '@shared/lib/dungeon/materialCosts';
import type { DungeonOption } from '@shared/lib/dungeon/types';
import { useState } from 'react';

export function DungeonMaterialSubmission({
  option,
  processing,
  onSubmit,
  onClose,
}: {
  option: DungeonOption;
  processing: boolean;
  onSubmit: (selections: DungeonMaterialSelection[]) => Promise<void>;
  onClose: () => void;
}) {
  const costs = option.costPreview ?? option.costs ?? [];
  const requirements = costs
    .map((cost, costIndex) => ({ cost, costIndex }))
    .filter(({ cost }) => cost.type === 'material' && cost.value > 0);
  const [activeIndex, setActiveIndex] = useState(requirements[0].costIndex);
  const bagQuery = useInventoryBag();
  const bag = bagQuery.data;
  const loading = bagQuery.loading || bagQuery.isRefreshing;
  const error = bagQuery.error;
  const [choices, setChoices] = useState<
    Array<{ costIndex: number; itemId: string; quantity: string }>
  >([]);
  const refresh = () => {
    setChoices([]);
    return bagQuery.reload();
  };
  const selections = requirements.map(({ costIndex }) => ({
    costIndex,
    items: choices
      .filter((c) => c.costIndex === costIndex)
      .map((c) => ({
        itemId: c.itemId,
        quantity: Number(c.quantity),
        revision: bag?.items.find((i) => i.id === c.itemId)?.revision ?? -1,
      })),
  }));
  let valid = false;
  try {
    consumeDungeonMaterials(bag?.items ?? [], costs, selections);
    valid = true;
  } catch {
    /* Selection is incomplete until each requirement is met. */
  }
  const busy = processing || loading || !!error || !bag;
  function toggle(item: InventoryView['items'][number]) {
    if (busy || !dungeonMaterialMatches(item, costs[activeIndex])) return;
    setChoices((current) =>
      current.some((c) => c.costIndex === activeIndex && c.itemId === item.id)
        ? current.filter(
            (c) => c.costIndex !== activeIndex || c.itemId !== item.id,
          )
        : [
            ...current,
            { costIndex: activeIndex, itemId: item.id, quantity: '1' },
          ],
    );
  }
  return (
    <InkModal
      isOpen
      title="选择提交物品"
      className="max-w-4xl"
      onClose={() => {
        if (!processing) onClose();
      }}
    >
      <div className="grid min-w-0 gap-5 md:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <p className="text-sm leading-7">{option.text}</p>
          <div className="flex flex-wrap gap-2">
            {requirements.map(({ cost, costIndex }) => (
              <InkButton
                key={costIndex}
                disabled={busy}
                variant={costIndex === activeIndex ? 'primary' : 'secondary'}
                onClick={() => setActiveIndex(costIndex)}
              >
                {formatDungeonCostName(cost)} · {cost.value}份
              </InkButton>
            ))}
          </div>
          {requirements.map(({ cost, costIndex }) => (
            <div key={costIndex} className="space-y-2">
              <p className="text-ink-secondary text-sm">
                {formatDungeonCostName(cost)}：已选{' '}
                <span className="font-mono">
                  {choices
                    .filter((c) => c.costIndex === costIndex)
                    .reduce(
                      (sum, c) => sum + (Number(c.quantity) || 0),
                      0,
                    )}{' '}
                  / {cost.value}
                </span>
              </p>
              {choices
                .filter((c) => c.costIndex === costIndex)
                .map((choice) => {
                  const item = bag?.items.find((i) => i.id === choice.itemId);
                  if (!item)
                    return (
                      <p key={choice.itemId} role="alert">
                        所选物品已变化，请刷新选物。
                      </p>
                    );
                  return (
                    <div
                      key={choice.itemId}
                      className="flex items-center gap-2"
                    >
                      <div className="w-12 shrink-0">
                        <ItemSlot item={item} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{item.name}</p>
                        <InkInput
                          label={`${item.name}提交数量`}
                          type="number"
                          min={1}
                          max={Math.min(item.quantity, cost.value)}
                          value={choice.quantity}
                          disabled={busy}
                          onChange={(quantity) =>
                            setChoices((current) =>
                              current.map((c) =>
                                c === choice ? { ...c, quantity } : c,
                              ),
                            )
                          }
                        />
                      </div>
                      <InkButton
                        disabled={busy}
                        onClick={() =>
                          setChoices((current) =>
                            current.filter((c) => c !== choice),
                          )
                        }
                      >
                        移出
                      </InkButton>
                    </div>
                  );
                })}
            </div>
          ))}
          {costs.some((c) => c.type !== 'material') ? (
            <p className="text-sm">
              同时消耗：
              {costs
                .filter((c) => c.type !== 'material')
                .map(
                  (c) =>
                    `${formatDungeonCostName(c)} ${formatDungeonCostValue(c)}`,
                )
                .join('、')}
            </p>
          ) : null}
          <p className="text-ink-secondary text-sm leading-6">
            只提交选中的物品。储藏室与宝库物品须在探索前取出；取消不会消耗物品。
          </p>
          {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
          <div className="flex gap-3">
            <InkButton disabled={processing} onClick={onClose}>
              取消
            </InkButton>
            <InkButton
              variant="primary"
              disabled={busy || !!error || !valid}
              pending={processing}
              onClick={() => void onSubmit(selections)}
            >
              确认提交并行动
            </InkButton>
          </div>
        </div>
        <section className="min-w-0 space-y-3" aria-label="秘境提交物品栏">
          <div className="flex items-center justify-between">
            <p className="text-sm">随身物品</p>
            <InkButton
              disabled={processing || loading}
              onClick={() => void refresh()}
            >
              刷新选物
            </InkButton>
          </div>
          {loading ? <p className="text-sm">正在读取物品…</p> : null}
          <InventoryItems
            items={bag?.items ?? []}
            slotProps={(item) => {
              const eligible =
                !!item && dungeonMaterialMatches(item, costs[activeIndex]);
              return {
                disabled: !item || busy,
                selected:
                  !!item &&
                  choices.some(
                    (c) => c.costIndex === activeIndex && c.itemId === item.id,
                  ),
                badge: eligible ? '可选' : undefined,
                onQuickAction:
                  item && eligible ? () => toggle(item) : undefined,
                children: item
                  ? (close) => (
                      <div className="space-y-2">
                        {!eligible ? (
                          <p className="text-sm">此物不符合当前材料要求</p>
                        ) : null}
                        <InkButton
                          disabled={busy || !eligible}
                          onClick={() => {
                            toggle(item);
                            close();
                          }}
                        >
                          选择／移出
                        </InkButton>
                      </div>
                    )
                  : undefined,
              };
            }}
          />
        </section>
      </div>
    </InkModal>
  );
}

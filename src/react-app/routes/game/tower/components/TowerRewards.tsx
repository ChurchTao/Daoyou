import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import {
  itemPresentation,
  type DisplayItem,
} from '@app/components/feature/items/itemPresentation';
import { GameIcon } from '@app/components/ui/GameIcon';
import type {
  TowerRewardPreview,
  TowerView,
} from '@shared/contracts/combatV6Tower';
import type { ItemGrant } from '@shared/inventory';
import { itemDefinition } from '@shared/inventory';
import { materialFactsOf } from '@shared/items/material';
import { useState } from 'react';

function rewardItem(item: ItemGrant): DisplayItem {
  return {
    ...item,
    instanceData: item.instanceData ?? null,
    name:
      item.definitionId === 'material.v1'
        ? materialFactsOf(item.instanceData).name
        : itemDefinition(item.definitionId).name,
  };
}

function RewardSlots({
  drops,
  realm,
}: {
  drops: TowerRewardPreview['drops'];
  realm: TowerView['rewardRealm'];
}) {
  const [poolId, setPoolId] = useState<string | null>(null);
  const pool = drops.find((drop) => drop.id === poolId);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {drops
          .filter((drop) => drop.chance > 0)
          .map((drop) => {
            const first = rewardItem({
              definitionId: drop.definitionIds[0],
              quantity: drop.quantity,
            });
            return (
              <div key={drop.id} className="w-24 space-y-1.5">
                <ItemSlot
                  className="w-full"
                  item={drop.random ? undefined : first}
                  emptyLabel={drop.label}
                  emptyIcon={itemPresentation(first).icon}
                  badge={drop.random ? `随机 ×${drop.quantity}` : undefined}
                  selected={poolId === drop.id}
                  quantityLabel="奖励"
                  onQuickAction={
                    drop.random
                      ? () =>
                          setPoolId((current) =>
                            current === drop.id ? null : drop.id,
                          )
                      : undefined
                  }
                />
                <p className="text-ink-secondary text-center text-xs">
                  {drop.chance < 1 ? (
                    <>
                      <span className="font-mono">
                        {Math.round(drop.chance * 100)}%
                      </span>{' '}
                      额外掉落
                    </>
                  ) : (
                    '必得'
                  )}
                </p>
              </div>
            );
          })}
      </div>
      {pool ? (
        <div className="space-y-3" aria-label={pool.label}>
          <div className="flex items-start justify-between gap-2 text-sm">
            <div>
              <p>{pool.label} · 随机一种</p>
              {pool.realmLimited ? (
                <p className="text-ink-secondary text-xs">
                  不高于{realm}，仅含已开放境界
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setPoolId(null)}
              className="text-ink-secondary hover:text-ink shrink-0"
            >
              收起
            </button>
          </div>
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto p-1">
            {pool.definitionIds.map((id) => (
              <ItemSlot
                key={id}
                item={rewardItem({ definitionId: id, quantity: pool.quantity })}
                quantityLabel="奖励"
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TowerRewards({ view }: { view: TowerView }) {
  const receipts = new Map(
    view.rewards.map((reward) => [reward.floor, reward]),
  );
  const highest = Math.max(
    0,
    ...view.rewards.map((reward) => reward.floor),
    view.state?.season.seasonKey === view.season.seasonKey
      ? view.state.highestFloor
      : 0,
  );
  const [selected, setSelected] = useState(Math.min(highest + 1, 20));
  const preview = view.rewardPreviews.find(
    (reward) => reward.floor === selected,
  )!;
  const received = receipts.get(selected);
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ink-secondary text-sm">
          本周登临{' '}
          <span className="text-ink font-mono text-2xl font-semibold">
            {highest}
          </span>
          <span className="ml-1 font-mono">/ 20</span>
        </p>
        <p className="text-ink-secondary text-xs">每层每周首次通关自动领取</p>
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div role="group" aria-label="楼层奖励进度" className="space-y-2">
          {[0, 5, 10, 15].map((start) => (
            <div key={start} className="relative grid grid-cols-5 items-center">
              <div
                aria-hidden="true"
                className="bg-ink/15 absolute right-[10%] left-[10%] h-px"
              />
              {view.rewardPreviews.slice(start, start + 5).map((reward) => {
                const claimed = receipts.has(reward.floor);
                const major = reward.floor % 5 === 0;
                return (
                  <button
                    key={reward.floor}
                    type="button"
                    aria-pressed={selected === reward.floor}
                    aria-controls="tower-floor-reward"
                    aria-label={`第${reward.floor}层，${claimed ? '已领取' : reward.floor <= highest ? '已通关，未领取' : '未通关'}${major ? '，关键层' : ''}`}
                    onClick={() => setSelected(reward.floor)}
                    className="hover:bg-ink/6 focus-visible:outline-ink relative flex min-h-14 min-w-11 cursor-pointer items-center justify-center rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <span
                      className={`bg-paper flex items-center justify-center rounded-full border font-mono ${major ? 'size-12 text-lg font-semibold' : 'size-8 text-sm'} ${selected === reward.floor ? 'border-crimson text-crimson ring-crimson/20 ring-offset-paper ring-2 ring-offset-2' : claimed ? 'border-ink text-ink' : 'border-ink/25 text-ink-secondary'}`}
                    >
                      {reward.floor}
                    </span>
                    {claimed ? (
                      <span
                        aria-hidden="true"
                        className="bg-paper text-ink absolute right-1/2 bottom-0 translate-x-1/2 text-xs"
                      >
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <section
          id="tower-floor-reward"
          aria-label={`第${selected}层奖励`}
          className="border-ink/15 border-t pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              第 <span className="font-mono">{selected}</span> 层
            </h2>
            <span className="text-ink-secondary text-sm">
              {received ? '已领取' : '首次通关可得'}
            </span>
          </div>
          <div className="space-y-3 text-sm leading-6">
            {preview.spiritStones > 0 ? (
              <p>
                <GameIcon value="💰" />{' '}
                <span className="font-mono">{preview.spiritStones}</span> 灵石
              </p>
            ) : null}
            {preview.reputation > 0 ? (
              <p>
                <GameIcon value="🏵️" />{' '}
                <span className="font-mono">{preview.reputation}</span> 声望
              </p>
            ) : null}
            <RewardSlots
              key={selected}
              drops={preview.drops}
              realm={view.rewardRealm}
            />
          </div>
          {received ? (
            <div className="text-ink-secondary mt-5 text-sm leading-6">
              <p>本周所得</p>
              <p>
                {received.spiritStones > 0 ? (
                  <>
                    <span className="font-mono">{received.spiritStones}</span>{' '}
                    灵石{' '}
                  </>
                ) : null}
                {received.reputation > 0 ? (
                  <>
                    <span className="font-mono">{received.reputation}</span>{' '}
                    声望
                  </>
                ) : null}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {received.items.map((item, index) => (
                  <ItemSlot
                    key={`${item.definitionId}:${index}`}
                    className="w-24"
                    item={rewardItem(item)}
                    quantityLabel="奖励"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

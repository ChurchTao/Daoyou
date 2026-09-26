import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import type { DisplayItem } from '@app/components/feature/items/itemPresentation';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkTag } from '@app/components/ui/InkTag';
import type { ResourceOperation } from '@shared/engine/resource/types';
import type { DungeonSettlement as DungeonSettlementType } from '@shared/lib/dungeon/types';
import { getResourceTypeInfo } from '@shared/lib/gameConceptDisplay';
import { dungeonRewardItemName } from '@shared/rewards/dungeon';

interface DungeonSettlementProps {
  settlement: DungeonSettlementType | undefined;
  realGains?: ResourceOperation[];
  onConfirm?: () => void;
}

export function DungeonSettlement({
  settlement,
  realGains = [],
  onConfirm,
}: DungeonSettlementProps) {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
      return;
    }

    window.location.href = '/game';
  };

  const tier = settlement?.settlement?.reward_tier ?? 'C';
  const tierTheme: Record<string, { title: string }> = {
    S: { title: '天命垂青' },
    A: { title: '机缘深厚' },
    B: { title: '收获颇丰' },
    C: { title: '小有所获' },
    D: { title: '险中脱身' },
  };

  const gainByType = realGains.reduce<Record<string, number>>((acc, gain) => {
    acc[gain.type] = (acc[gain.type] || 0) + gain.value;
    return acc;
  }, {});

  const keyResources = [
    'spirit_stones',
    'cultivation_exp',
    'comprehension_insight',
    'lifespan',
  ]
    .map((type) => ({
      type,
      value: gainByType[type] || 0,
      info: getResourceTypeInfo(type),
    }))
    .filter((item) => item.value > 0);

  const grouped = new Map<string, DisplayItem>();
  for (const item of settlement?.inventoryRewards ?? []) {
    const key = JSON.stringify([item.definitionId, item.instanceData]);
    const existing = grouped.get(key);
    if (existing) existing.quantity += item.quantity;
    else
      grouped.set(key, {
        definitionId: item.definitionId,
        instanceData: item.instanceData ?? null,
        name: dungeonRewardItemName(item),
        quantity: item.quantity,
      });
  }

  return (
    <InkCard className="space-y-5 overflow-hidden p-4">
      <div className="border-ink/15 border border-dashed p-4">
        <div className="text-ink-secondary text-xs tracking-[0.2em]">
          天机判词
        </div>
        <div className="mt-2">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-semibold">
              {tierTheme[tier]?.title}
            </div>
            <div className="text-ink-secondary">
              评价 <span className="text-crimson ml-1 text-3xl">{tier}</span>
            </div>
          </div>
          <div className="mt-2 space-x-1">
            {settlement?.settlement?.performance_tags?.map((tag, index) => (
              <InkTag key={`${tag}-${index}`} variant="outline">
                {tag}
              </InkTag>
            ))}
          </div>
        </div>
      </div>

      <p className="text-ink/80 leading-relaxed">
        {settlement?.ending_narrative || '此行尘埃落定，且看所得机缘。'}
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {keyResources.length > 0 ? (
          keyResources.map((gain) => (
            <div
              key={gain.type}
              className="bg-ink/5 border-ink/10 border px-3 py-2"
            >
              <div className="text-ink-secondary text-xs">
                {gain.info.label}
              </div>
              <div className="mt-1 text-lg font-semibold">
                {gain.info.icon} +{gain.value.toLocaleString()}
              </div>
            </div>
          ))
        ) : (
          <div className="text-ink-secondary bg-ink/5 border-ink/15 border border-dashed px-3 py-4 text-sm sm:col-span-2">
            此行未见修为精进
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">所得物品</div>
        {grouped.size > 0 ? (
          <div className="flex flex-wrap gap-2">
            {[...grouped].map(([key, item]) => (
              <ItemSlot
                key={key}
                item={item}
                className="w-20"
                quantityLabel="奖励"
              />
            ))}
          </div>
        ) : (
          <div className="text-ink-secondary bg-ink/5 border-ink/15 border border-dashed px-3 py-4 text-sm">
            此行机缘浅薄，未得可携物品
          </div>
        )}
      </div>

      <InkButton
        onClick={handleConfirm}
        variant="primary"
        className="mt-4 block w-full text-center"
      >
        返回洞府
      </InkButton>
    </InkCard>
  );
}

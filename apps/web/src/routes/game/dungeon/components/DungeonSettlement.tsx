import { RewardItemGrid } from '@app/components/feature/items/RewardItemGrid';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkTag } from '@app/components/ui/InkTag';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import type { ResourceOperation } from '@daoyou/game-domain/resources';
import type { DungeonSettlement as DungeonSettlementType } from '@daoyou/game-domain/dungeon';
import { getResourceTypeInfo } from '@daoyou/game-content/presentation/concepts';
import type { MysteryPlayerView } from '@daoyou/game-domain/dungeon/mystery';
import { DungeonMysteryResult } from '@app/components/feature/dungeon/DungeonMysteryResult';
import type { ExorcismRunState } from '@daoyou/game-domain/dungeon/exorcism';
import { ExorcismResult } from './ExorcismResult';

interface DungeonSettlementProps {
  settlement: DungeonSettlementType | undefined;
  realGains?: ResourceOperation[];
  mysteryResult?: MysteryPlayerView['result'];
  exorcism?: ExorcismRunState;
  onConfirm?: () => void;
}

export function DungeonSettlement({
  settlement,
  realGains = [],
  mysteryResult,
  exorcism,
  onConfirm,
}: DungeonSettlementProps) {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
      return;
    }

    window.location.href = '/game';
  };

  const confirmButton = (
    <InkButton
      onClick={handleConfirm}
      variant="primary"
      className="mt-4 block w-full text-center"
    >
      返回洞府
    </InkButton>
  );

  if (!settlement && !mysteryResult && realGains.length === 0) {
    return (
      <InkCard variant={exorcism ? 'plain' : undefined} className="space-y-5 p-4">
        <p className="text-ink/80 leading-relaxed">
          {exorcism ? '除祟已结束。' : '探索已结束。'}
        </p>
        {confirmButton}
      </InkCard>
    );
  }

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

  const items = settlement?.inventoryRewards ?? [];

  return (
    <InkCard
      variant={exorcism ? 'plain' : undefined}
      className="space-y-5 overflow-hidden p-4"
    >
      {exorcism ? (
        <ExorcismResult
          run={exorcism}
          tags={settlement?.settlement?.performance_tags ?? []}
        />
      ) : (
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
      )}

      <p className="text-ink/80 leading-relaxed">
        {settlement?.ending_narrative || '探索已结束。'}
      </p>

      {mysteryResult ? <DungeonMysteryResult result={mysteryResult} /> : null}

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
                {gain.type === 'spirit_stones' ? <>+<SpiritStones amount={gain.value} /></> : <>{gain.info.icon} +{gain.value.toLocaleString()}</>}
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
        {items.length > 0 ? (
          <RewardItemGrid grants={items} />
        ) : (
          <div className="text-ink-secondary bg-ink/5 border-ink/15 border border-dashed px-3 py-4 text-sm">
            本次没有获得物品
          </div>
        )}
      </div>

      {confirmButton}
    </InkCard>
  );
}

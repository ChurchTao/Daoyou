import { itemPresentation } from '@app/components/feature/items/itemPresentation';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { GameIcon } from '@app/components/ui/GameIcon';
import { BEAST_SUPERIOR_BOOK_SKILL_IDS } from '@shared/engine/combat-v6/beasts/content';
import { itemDefinition } from '@shared/inventory';
import { getGameConceptInfo } from '@shared/lib/gameConceptDisplay';
import { HUNT_DROP_POOL } from '@shared/rewards/hunt';
import { HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM } from '@shared/rewards/hunt-material-quality';
import type { RealmType } from '@shared/types/constants';
import { useState } from 'react';

const bookEntries = HUNT_DROP_POOL.groups.find((g) => g.id === 'book')!.entries;
const bookPools = [
  { id: 'ordinary', label: '普通传承灵印', superior: false },
  { id: 'superior', label: '上品传承灵印', superior: true },
].map((pool) => ({
  ...pool,
  entries: bookEntries.filter(
    (entry) =>
      BEAST_SUPERIOR_BOOK_SKILL_IDS.has(
        itemDefinition(entry.rewardId).skillId!,
      ) === pool.superior,
  ),
}));
const materialCount = HUNT_DROP_POOL.groups.find((g) => g.id === 'materials')!
  .entries[0].quantity.min;
const dewEntries = HUNT_DROP_POOL.groups.find((g) => g.id === 'dew')!.entries;
function previewItem(definitionId: string) {
  return {
    definitionId,
    name: itemDefinition(definitionId).name,
    quantity: 1,
    instanceData: null,
  };
}

export function HuntRewardPreview({ realm }: { realm: RealmType }) {
  const [showMaterials, setShowMaterials] = useState(false);
  return (
    <section aria-label="讨伐所得" className="space-y-3">
      <h3>讨伐所得</h3>
      <div className="grid max-w-[19.5rem] grid-cols-4 gap-2">
        {['cultivation_exp', 'spirit_stones', 'comprehension_insight'].map(
          (key) => {
            const resource = getGameConceptInfo(key);
            return (
              <div key={key} className="space-y-1.5">
                <ItemSlot
                  className="w-full cursor-default"
                  emptyLabel={resource.label}
                  emptyIcon={
                    <GameIcon
                      value={resource.icon}
                      purpose="artwork"
                      className="text-ink"
                    />
                  }
                />
                <p className="text-ink-secondary text-center text-xs">必得</p>
              </div>
            );
          },
        )}
        <div className="space-y-1.5">
          <ItemSlot
            className="w-full"
            emptyLabel="灵材"
            emptyIcon="💎"
            badge={`×${materialCount}`}
            selected={showMaterials}
            onQuickAction={() => setShowMaterials((shown) => !shown)}
          />
          <p className="text-ink-secondary text-center text-xs">必得</p>
        </div>
        {bookPools
          .filter((p) => p.entries.length)
          .map((p) => (
            <div key={p.id} className="space-y-1.5">
              <ItemSlot
                className="w-full cursor-default"
                emptyLabel={p.label}
                emptyIcon={
                  <GameIcon
                    value={
                      itemPresentation(previewItem(p.entries[0].rewardId)).icon
                    }
                    purpose="artwork"
                    className="text-ink"
                  />
                }
              />
              <p className="text-ink-secondary text-center text-xs">可能获得</p>
            </div>
          ))}
        {dewEntries.map((entry) => (
          <div key={entry.rewardId} className="space-y-1.5">
            <ItemSlot
              className="w-full"
              item={previewItem(entry.rewardId)}
              quantityLabel="奖励"
            />
            <p className="text-ink-secondary text-center text-xs">可能获得</p>
          </div>
        ))}
      </div>
      {showMaterials ? (
        <div className="space-y-3" aria-label="灵材品质">
          <div className="flex items-center justify-between gap-2">
            <p>可得灵材品质</p>
            <button
              type="button"
              onClick={() => setShowMaterials(false)}
              className="text-ink-secondary shrink-0"
            >
              收起
            </button>
          </div>
          <p className="text-ink-secondary">
            {Object.entries(HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM[realm])
              .filter(([, chance]) => chance > 0)
              .map(([quality]) => quality)
              .join('、')}
          </p>
        </div>
      ) : null}
    </section>
  );
}

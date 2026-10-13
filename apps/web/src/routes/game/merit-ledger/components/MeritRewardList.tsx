import { InventoryGrid, ItemSlot } from '@app/components/feature/items/ItemSlot';
import { GameIcon } from '@app/components/ui/GameIcon';
import type { RewardSelection } from '@daoyou/game-domain/rewards';
import { rewardDisplayItem } from '@daoyou/game-rules/rewards/materials';
import { meritRewardLabel } from './MeritRewardList.helpers';

export function MeritRewardList({ rewards }: { rewards: RewardSelection[] }) {
  const amounts = rewards.filter((reward) => reward.type !== 'inventory_v1');
  const items = rewards.flatMap((reward) =>
    reward.type === 'inventory_v1' ? [reward.inventory] : [],
  );
  if (!rewards.length) return null;
  return (
    <div className="space-y-3">
      {amounts.length > 0 && (
        <p className="text-sm leading-6">
          {amounts.map((reward, index) => {
            const { label, quantity } = meritRewardLabel(reward);
            return (
              <span key={`${label}-${index}`}>
                {index > 0 ? '、' : null}
                <GameIcon
                  value={reward.type === 'spirit_stones' ? '💰' : '🏵️'}
                />{' '}
                {label}
                <span className="font-mono font-semibold tracking-tight">
                  {' '}
                  {quantity.toLocaleString('zh-CN')}
                </span>
              </span>
            );
          })}
        </p>
      )}
      {items.length > 0 && (
        <InventoryGrid className="grid-cols-4 sm:grid-cols-6">
          {items.map((item, index) => (
            <ItemSlot
              key={`${item.definitionId}-${index}`}
              item={rewardDisplayItem(item)}
              quantityLabel="奖励"
            />
          ))}
        </InventoryGrid>
      )}
    </div>
  );
}

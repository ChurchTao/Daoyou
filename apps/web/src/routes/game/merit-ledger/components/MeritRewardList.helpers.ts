import type { RewardSelection } from '@daoyou/game-domain/rewards';
import { rewardDisplayItem } from '@daoyou/game-rules/rewards/materials';

export function meritRewardLabel(reward: RewardSelection): {
  label: string;
  quantity: number;
} {
  if (reward.type === 'spirit_stones') {
    return { label: '灵石', quantity: reward.quantity };
  }
  if (reward.type === 'reputation') {
    return { label: '声望', quantity: reward.quantity };
  }
  return {
    label: rewardDisplayItem(reward.inventory).name,
    quantity: reward.inventory.quantity,
  };
}

export function meritRewardSummary(rewards: RewardSelection[]): string {
  return rewards
    .map((reward) => {
      const { label, quantity } = meritRewardLabel(reward);
      return `${label} ${quantity.toLocaleString('zh-CN')}`;
    })
    .join('、');
}

import {
  parseRewardSelectionDrafts,
  type RewardSelectionDraft,
} from '@app/routes/admin/_components/RewardSelectionEditor.helpers';
import type { RewardSelection } from '@daoyou/game-domain/rewards';
import { rewardDrafts } from '@app/routes/admin/broadcast/game-mail/systemMailUi';

export type EditableSubscriptionPlan = {
  id: string;
  level: string;
  name: string;
  afdianPlanId: string;
  enabled: boolean;
  rewards: RewardSelectionDraft[];
};

export function editableSubscriptionPlans(
  plans: {
    id: string;
    level: number;
    name: string;
    afdianPlanId: string;
    enabled: boolean;
    dailyRewards: RewardSelection[];
  }[],
): EditableSubscriptionPlan[] {
  return plans.map((plan) => ({
    id: plan.id,
    level: String(plan.level),
    name: plan.name,
    afdianPlanId: plan.afdianPlanId,
    enabled: plan.enabled,
    rewards: rewardDrafts(plan.dailyRewards),
  }));
}

export function serializeSubscriptionPlans(plans: EditableSubscriptionPlan[]) {
  return plans.map((plan) => ({
    id: plan.id,
    level: Number(plan.level),
    name: plan.name.trim(),
    afdianPlanId: plan.afdianPlanId.trim(),
    enabled: plan.enabled,
    dailyRewards: parseRewardSelectionDrafts(plan.rewards, { allowEmpty: true }),
  }));
}

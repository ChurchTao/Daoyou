import type { DungeonRewardResourceContext } from '@daoyou/game-domain/dungeon';
import {
  planDungeonReward,
  planDungeonStepResources,
} from '../rewards/dungeon.js';
import {
  INQUIRY_COMPLETION_KEY,
  inquiryBattleKey,
  inquiryVisitKey,
} from './progress.js';


function planStep(
  seed: number,
  key: string,
  source: 'exploration' | 'battle' | 'completion',
  level: number,
  context: DungeonRewardResourceContext,
) {
  return {
    key,
    resources: planDungeonStepResources(seed, key, source, context),
    plan: planDungeonReward(seed, key, source, level),
  };
}

export function planInquiryVisitReward(
  seed: number,
  locationId: string,
  level: number,
  context: DungeonRewardResourceContext,
) {
  return planStep(seed, inquiryVisitKey(locationId), 'exploration', level, context);
}

export function planInquiryBattleReward(
  seed: number,
  battleId: string,
  level: number,
  context: DungeonRewardResourceContext,
) {
  return planStep(seed, inquiryBattleKey(battleId), 'battle', level, context);
}

export function planInquiryCompletionReward(
  seed: number,
  level: number,
  context: DungeonRewardResourceContext,
) {
  return planStep(seed, INQUIRY_COMPLETION_KEY, 'completion', level, context);
}

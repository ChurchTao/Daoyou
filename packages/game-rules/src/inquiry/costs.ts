import type { DungeonDifficultyTier } from '@daoyou/game-domain/dungeon';
import {
  INQUIRY_COST_TYPES,
  type InquiryCostSpec,
  type InquiryCostType,
} from '@daoyou/game-domain/inquiry';
import type { RealmType } from '@daoyou/constants/realms';
import {
  calculateDungeonResourceCost,
  calculateDungeonStatLoss,
} from '../dungeon/costPolicy.js';

export type InquiryPricedCost = {
  type: InquiryCostSpec['type'];
  value: number;
};

export function isInquiryCostType(type: string): type is InquiryCostType {
  return (INQUIRY_COST_TYPES as readonly string[]).includes(type);
}

export function assertInquiryCostType(type: string): InquiryCostType {
  if (!isInquiryCostType(type)) throw new Error(`秘境探查不接受代价 ${type}`);
  return type;
}

export function quoteInquiryCost(
  spec: InquiryCostSpec,
  realm: RealmType,
  difficulty: DungeonDifficultyTier,
): InquiryPricedCost {
  const type = assertInquiryCostType(spec.type);
  if (type === 'battle') throw new Error('战斗不是一条可报价的代价');
  if (type === 'hp_loss' || type === 'mp_loss') {
    return {
      type,
      value: calculateDungeonStatLoss({ realm, difficulty, rank: spec.rank }),
    };
  }
  return {
    type,
    value: calculateDungeonResourceCost({
      type,
      realm,
      difficulty,
      rank: spec.rank,
    }),
  };
}

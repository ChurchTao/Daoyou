import type { ApiSuccess } from './http';
import type { BodyCultivationRealm } from '@shared/types/condition';
import type { MaterialType, Quality } from '@shared/types/constants';
import type { AlchemyPropertyKey, PillFamily } from '@shared/types/consumable';

export type BodyCultivationBreakthroughCostType = 'material' | 'consumable';

export interface BodyCultivationBreakthroughInventoryRequirement {
  type: BodyCultivationBreakthroughCostType;
  name: string;
  label?: string;
  quantity: number;
  ownedQuantity: number;
  met: boolean;
  materialType?: MaterialType;
  family?: PillFamily;
  property?: AlchemyPropertyKey;
  minQuality?: Quality;
}

export interface BodyCultivationBreakthroughReadinessData {
  nextRealm: BodyCultivationRealm | null;
  canAttempt: boolean;
  successChance: number;
  guaranteeProgress: number;
  failedAttempts: number;
  ruleRequirements: {
    label: string;
    met: boolean;
  }[];
  inventoryRequirements: BodyCultivationBreakthroughInventoryRequirement[];
}

export type BodyCultivationBreakthroughReadinessResponse =
  ApiSuccess<BodyCultivationBreakthroughReadinessData>;

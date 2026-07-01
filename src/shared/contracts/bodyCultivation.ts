import type { ApiSuccess } from './http';
import type { BodyCultivationRealm } from '@shared/types/condition';
import type { MaterialType, Quality } from '@shared/types/constants';
import type { AlchemyPropertyKey, PillFamily } from '@shared/types/consumable';

export type BodyCultivationBreakthroughCostType = 'material' | 'consumable';

export interface BodyCultivationBreakthroughCostRequirement {
  type: BodyCultivationBreakthroughCostType;
  name: string;
  label?: string;
  quantity: number;
  materialType?: MaterialType;
  family?: PillFamily;
  property?: AlchemyPropertyKey;
  minQuality?: Quality;
}

export interface BodyCultivationBreakthroughInventoryRequirement
  extends BodyCultivationBreakthroughCostRequirement {
  ownedQuantity: number;
  met: boolean;
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
  costRequirements: BodyCultivationBreakthroughCostRequirement[];
  inventoryRequirements?: BodyCultivationBreakthroughInventoryRequirement[];
}

export type BodyCultivationBreakthroughReadinessResponse =
  ApiSuccess<BodyCultivationBreakthroughReadinessData>;

export interface BodyCultivationBreakthroughSelection {
  id: string;
  quantity: number;
}

export interface BodyCultivationBreakthroughRequest {
  materialSelections: BodyCultivationBreakthroughSelection[];
  consumableSelections: BodyCultivationBreakthroughSelection[];
}

export interface BodyCultivationBreakthroughEligibleData {
  requirements: BodyCultivationBreakthroughCostRequirement[];
  materials: Array<{
    id: string;
    name: string;
    type: MaterialType;
    rank: Quality;
    quantity: number;
    element?: string;
    description?: string;
    requirementLabel: string;
  }>;
  consumables: Array<{
    id: string;
    name: string;
    type: string;
    quality: Quality;
    quantity: number;
    requirementLabel: string;
  }>;
}

export type BodyCultivationBreakthroughEligibleResponse =
  ApiSuccess<BodyCultivationBreakthroughEligibleData>;

import type {
  BodyCultivationRealm,
  CultivatorCondition,
} from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type { ApiSuccess } from './http';

export interface BodyCultivationBreakthroughReadinessData {
  currentRealm: BodyCultivationRealm;
  nextRealm: BodyCultivationRealm | null;
  canAdvance: boolean;
  totalLevel: number;
  requiredTotalLevel: number | null;
  requiredCultivationRealm: RealmType | null;
  requirements: Array<{ label: string; met: boolean }>;
}

export type BodyCultivationBreakthroughReadinessResponse =
  ApiSuccess<BodyCultivationBreakthroughReadinessData>;

export type BodyCultivationBreakthroughRequest = Record<string, never>;

export interface BodyCultivationBreakthroughResultData {
  fromRealm: BodyCultivationRealm;
  toRealm: BodyCultivationRealm;
  condition: CultivatorCondition;
}

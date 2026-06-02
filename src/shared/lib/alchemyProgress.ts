import { calculateSceneCultivationExp } from '@shared/engine/cultivation/ExpBudgetCalculator';
import type { Quality, RealmStage, RealmType } from '@shared/types/constants';

const INSIGHT_GAIN_BY_QUALITY: Record<Quality, number> = {
  凡品: 1,
  灵品: 2,
  玄品: 3,
  真品: 4,
  地品: 6,
  天品: 8,
  仙品: 11,
  神品: 15,
};

export interface CultivationGainSnapshotInput {
  realm: RealmType;
  realmStage?: RealmStage;
  expCap?: number;
  quality: Quality;
  fitMultiplier?: number;
}

export function buildCultivationGain(
  input: CultivationGainSnapshotInput,
): number;
export function buildCultivationGain(
  realm: RealmType,
  quality: Quality,
): number;
export function buildCultivationGain(
  inputOrRealm: CultivationGainSnapshotInput | RealmType,
  quality?: Quality,
): number {
  const input =
    typeof inputOrRealm === 'string'
      ? {
          realm: inputOrRealm,
          realmStage: '初期' as const,
          quality: quality ?? '凡品',
        }
      : inputOrRealm;

  return calculateSceneCultivationExp('pill', {
    realm: input.realm,
    realmStage: input.realmStage ?? '初期',
    expCap: input.expCap,
    quality: input.quality,
    fitMultiplier: input.fitMultiplier,
  }).baseExp;
}

export function buildInsightGain(quality: Quality): number {
  return INSIGHT_GAIN_BY_QUALITY[quality];
}

export function scaleProgressGain(value: number, factor: number): number {
  return Math.max(1, Math.floor(value * factor));
}

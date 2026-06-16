import { buildInsightGain as buildInsightGainV2 } from '@shared/lib/pillEffectScaling';
import { calculatePillCultivationExp } from '@shared/lib/pillCultivationExp';
import type { Quality, RealmStage, RealmType } from '@shared/types/constants';

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

  return calculatePillCultivationExp({
    realm: input.realm,
    realmStage: input.realmStage ?? '初期',
    expCap: input.expCap,
    quality: input.quality,
    fitMultiplier: input.fitMultiplier,
  }).baseExp;
}

export function buildInsightGain(quality: Quality): number {
  return buildInsightGainV2(quality);
}

export function scaleProgressGain(value: number, factor: number): number {
  return Math.max(1, Math.floor(value * factor));
}

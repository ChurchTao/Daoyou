import { scaleFateAdjustedValue } from '@shared/lib/fates';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';

export const INN_RECOVERY_SPIRIT_STONE_COST_MIN = 500;
export const INN_RECOVERY_SPIRIT_STONE_COST_STEP = 500;
export const INN_RECOVERY_LOSS_PERCENT_MIN = 1;
export const INN_RECOVERY_LOSS_PERCENT_MAX = 6;

export function getInnRecoveryBaseSpiritStoneCost(realm: RealmType): number {
  return (
    INN_RECOVERY_SPIRIT_STONE_COST_MIN +
    REALM_ORDER[realm] * INN_RECOVERY_SPIRIT_STONE_COST_STEP
  );
}

export function calculateInnRecoverySpiritStoneCost(
  realm: RealmType,
  multiplier = 1,
): number {
  return scaleFateAdjustedValue(
    getInnRecoveryBaseSpiritStoneCost(realm),
    multiplier,
  );
}

export function calculateInnRecoveryLossAmount(
  cultivationExp: number,
  lossPercent: number,
  multiplier = 1,
): number {
  return scaleFateAdjustedValue(
    Math.max(0, cultivationExp) * (lossPercent / 100),
    multiplier,
  );
}

export function calculateInnRecoveryLossRange(
  cultivationExp: number,
  multiplier = 1,
) {
  return {
    min: calculateInnRecoveryLossAmount(
      cultivationExp,
      INN_RECOVERY_LOSS_PERCENT_MIN,
      multiplier,
    ),
    max: calculateInnRecoveryLossAmount(
      cultivationExp,
      INN_RECOVERY_LOSS_PERCENT_MAX,
      multiplier,
    ),
  };
}

export function rollInnRecoveryLossPercent(rng: () => number = Math.random) {
  const span =
    INN_RECOVERY_LOSS_PERCENT_MAX - INN_RECOVERY_LOSS_PERCENT_MIN + 1;
  return INN_RECOVERY_LOSS_PERCENT_MIN + Math.floor(rng() * span);
}

import { QUALITY_ORDER, type Quality } from '@daoyou/shared/types/constants';
import type { ConditionStatusKey } from '@daoyou/shared/types/condition';

type HealingCuredStatus = Extract<
  ConditionStatusKey,
  'minor_wound' | 'major_wound' | 'near_death'
>;

export function getHealingCuredStatus(quality: Quality): HealingCuredStatus {
  if (QUALITY_ORDER[quality] >= QUALITY_ORDER['天品']) {
    return 'near_death';
  }

  if (QUALITY_ORDER[quality] >= QUALITY_ORDER['地品']) {
    return 'major_wound';
  }

  return 'minor_wound';
}

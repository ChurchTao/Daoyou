import type { BattleUnitInitFragment } from '@shared/engine/battle-v5/setup/types';
import type { CultivatorCondition } from '@shared/types/condition';
import { isConditionStatusActive } from './condition';

export function buildConditionBattleUnitInitFragment(
  condition: CultivatorCondition,
  now: Date,
): BattleUnitInitFragment {
  return {
    statusRefs: condition.statuses
      .filter((status) => isConditionStatusActive(status, now))
      .map((status) => ({
        version: 1,
        templateId: status.key,
        stacks: status.stacks,
        usesRemaining: status.usesRemaining,
        expiresAt:
          status.duration.kind === 'time'
            ? Date.parse(status.duration.expiresAt)
            : undefined,
        payload: status.payload,
      })),
  };
}

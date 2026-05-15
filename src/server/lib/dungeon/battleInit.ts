import type {
  BattleInitConfigV5,
} from '@shared/engine/battle-v5/setup/types';
import type {
  ConditionStatusInstance,
  ConditionStatusKey,
  CultivatorCondition,
} from '@shared/types/condition';
import { isConditionStatusActive } from '@shared/lib/condition';

export interface DungeonBattleInitSource {
  accumulatedHpLoss?: number;
  accumulatedMpLoss?: number;
  condition?: CultivatorCondition;
}

export function buildPersistentStatus(
  statusKey: ConditionStatusKey,
  stacks: number,
): ConditionStatusInstance {
  const now = new Date().toISOString();
  return {
    key: statusKey,
    stacks: Math.max(1, Math.floor(stacks)),
    source: 'event',
    duration: { kind: 'until_removed' },
    createdAt: now,
    updatedAt: now,
  };
}

export function clampRemainingPercent(lossPercent: number): number {
  return Math.max(0, Math.min(1, 1 - lossPercent));
}

export function buildDungeonBattleInit(
  state: DungeonBattleInitSource,
): BattleInitConfigV5 {
  if (state.condition) {
    return {
      player: {
        resourceState: {
          hp: {
            mode: 'absolute',
            value: state.condition.resources.hp.current,
          },
          mp: {
            mode: 'absolute',
            value: state.condition.resources.mp.current,
          },
        },
        statusRefs: state.condition.statuses
          .filter((status) => isConditionStatusActive(status))
          .map((status) => ({
            version: 1 as const,
            templateId: status.key,
            stacks: status.stacks,
          })),
      },
    };
  }

  return {
    player: {
      resourceState: {
        hp: {
          mode: 'percent',
          value: clampRemainingPercent(state.accumulatedHpLoss ?? 0),
        },
        mp: {
          mode: 'percent',
          value: clampRemainingPercent(state.accumulatedMpLoss ?? 0),
        },
      },
      statusRefs: [],
    },
  };
}

export function incrementOrInsertStatus(
  statuses: ConditionStatusInstance[],
  statusKey: ConditionStatusKey,
  stacks: number,
  cap = 10,
): ConditionStatusInstance[] {
  const next = [...statuses];
  const existing = next.find((status) => status.key === statusKey);
  if (existing) {
    existing.stacks = Math.min(cap, existing.stacks + Math.floor(stacks));
    existing.updatedAt = new Date().toISOString();
    return next;
  }

  next.push(buildPersistentStatus(statusKey, stacks));
  return next;
}

export function promoteInjuryStatus(
  statuses: ConditionStatusInstance[],
): ConditionStatusInstance[] {
  const hasMinorWound = statuses.find((status) => status.key === 'minor_wound');
  const hasMajorWound = statuses.find((status) => status.key === 'major_wound');
  const hasNearDeath = statuses.find((status) => status.key === 'near_death');

  if (hasNearDeath) {
    hasNearDeath.stacks = Math.min(10, hasNearDeath.stacks + 1);
    hasNearDeath.updatedAt = new Date().toISOString();
    return [...statuses];
  }

  if (hasMajorWound) {
    return [
      ...statuses.filter((status) => status.key !== 'major_wound'),
      buildPersistentStatus('near_death', 1),
    ];
  }

  if (hasMinorWound) {
    return [
      ...statuses.filter((status) => status.key !== 'minor_wound'),
      buildPersistentStatus('major_wound', 1),
    ];
  }

  return [...statuses, buildPersistentStatus('minor_wound', 1)];
}

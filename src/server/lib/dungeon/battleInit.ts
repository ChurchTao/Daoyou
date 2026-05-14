import type {
  BattleInitConfigV5,
  PersistentCombatStatusV5,
} from '@shared/engine/battle-v5/setup/types';
import type { CultivatorPersistentState } from '@shared/types/cultivator';

export interface DungeonBattleInitSource {
  accumulatedHpLoss?: number;
  accumulatedMpLoss?: number;
  persistentState?: CultivatorPersistentState;
  persistentStatuses: PersistentCombatStatusV5[];
}

export function buildPersistentStatus(
  templateId: string,
  stacks: number,
): PersistentCombatStatusV5 {
  return {
    version: 1,
    templateId,
    stacks: Math.max(1, Math.floor(stacks)),
  };
}

export function clampRemainingPercent(lossPercent: number): number {
  return Math.max(0, Math.min(1, 1 - lossPercent));
}

export function buildDungeonBattleInit(
  state: DungeonBattleInitSource,
): BattleInitConfigV5 {
  if (
    typeof state.persistentState?.currentHp === 'number' &&
    typeof state.persistentState?.currentMp === 'number'
  ) {
    return {
      player: {
        resourceState: {
          hp: {
            mode: 'absolute',
            value: state.persistentState.currentHp,
          },
          mp: {
            mode: 'absolute',
            value: state.persistentState.currentMp,
          },
        },
        statusRefs: state.persistentStatuses,
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
      statusRefs: state.persistentStatuses,
    },
  };
}

export function incrementOrInsertStatus(
  statuses: PersistentCombatStatusV5[],
  templateId: string,
  stacks: number,
  cap = 10,
): PersistentCombatStatusV5[] {
  const next = [...statuses];
  const existing = next.find((status) => status.templateId === templateId);
  if (existing) {
    existing.stacks = Math.min(cap, existing.stacks + Math.floor(stacks));
    return next;
  }

  next.push(buildPersistentStatus(templateId, stacks));
  return next;
}

export function promoteInjuryStatus(
  statuses: PersistentCombatStatusV5[],
): PersistentCombatStatusV5[] {
  const hasMinorWound = statuses.find((status) => status.templateId === 'minor_wound');
  const hasMajorWound = statuses.find((status) => status.templateId === 'major_wound');
  const hasNearDeath = statuses.find((status) => status.templateId === 'near_death');

  if (hasNearDeath) {
    hasNearDeath.stacks = Math.min(10, hasNearDeath.stacks + 1);
    return [...statuses];
  }

  if (hasMajorWound) {
    return [
      ...statuses.filter((status) => status.templateId !== 'major_wound'),
      buildPersistentStatus('near_death', 1),
    ];
  }

  if (hasMinorWound) {
    return [
      ...statuses.filter((status) => status.templateId !== 'minor_wound'),
      buildPersistentStatus('major_wound', 1),
    ];
  }

  return [...statuses, buildPersistentStatus('minor_wound', 1)];
}

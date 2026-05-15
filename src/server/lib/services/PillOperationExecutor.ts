import { getTrackConfig } from '@shared/lib/trackConfigRegistry';
import type { Consumable } from '@shared/types/cultivator';
import type {
  ConditionStatusDuration,
  ConditionStatusInstance,
  ConditionStatusKey,
  ConditionTrackPath,
  CultivatorCondition,
} from '@shared/types/condition';
import type { ConditionOperation, PillSpec } from '@shared/types/consumable';
import type { Cultivator } from '@shared/types/cultivator';
import { isPillConsumable } from '@shared/lib/consumables';
import { REALM_PILL_USAGE_LIMITS } from '@shared/config/consumableSystem';
import { ConditionService } from './ConditionService';

const EXECUTION_ORDER: ConditionOperation['type'][] = [
  'restore_resource',
  'change_gauge',
  'remove_status',
  'add_status',
  'advance_track',
];

const BREAKTHROUGH_SUPPORT_STATUSES: ConditionStatusKey[] = [
  'breakthrough_focus',
  'protect_meridians',
  'clear_mind',
];

interface TrackLevelUpResult {
  track: ConditionTrackPath;
  newLevel: number;
}

export interface PillExecutionResult {
  cultivator: Cultivator;
  consumed: Consumable & { spec: PillSpec };
  trackLevelUps: TrackLevelUpResult[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cloneCultivator(cultivator: Cultivator): Cultivator {
  return structuredClone(cultivator);
}

function createUntilRemovedDuration(): ConditionStatusDuration {
  return { kind: 'until_removed' };
}

function removeStatuses(
  statuses: ConditionStatusInstance[],
  key: ConditionStatusKey,
): ConditionStatusInstance[] {
  return statuses.filter((status) => status.key !== key);
}

function replaceStatus(
  statuses: ConditionStatusInstance[],
  nextStatus: ConditionStatusInstance,
): ConditionStatusInstance[] {
  const existing = statuses.find((status) => status.key === nextStatus.key);
  return [
    ...statuses.filter((status) => status.key !== nextStatus.key),
    {
      ...nextStatus,
      createdAt: existing?.createdAt ?? nextStatus.createdAt,
    },
  ];
}

function getTrackState(
  condition: CultivatorCondition,
  track: ConditionTrackPath,
) {
  if (track === 'marrow_wash') {
    return condition.tracks.marrowWash;
  }

  const key = track.replace('tempering.', '') as keyof CultivatorCondition['tracks']['tempering'];
  return condition.tracks.tempering[key];
}

function setTrackState(
  condition: CultivatorCondition,
  track: ConditionTrackPath,
  level: number,
  progress: number,
): CultivatorCondition {
  if (track === 'marrow_wash') {
    return {
      ...condition,
      tracks: {
        ...condition.tracks,
        marrowWash: {
          level,
          progress,
        },
      },
    };
  }

  const key = track.replace('tempering.', '') as keyof CultivatorCondition['tracks']['tempering'];
  return {
    ...condition,
    tracks: {
      ...condition.tracks,
      tempering: {
        ...condition.tracks.tempering,
        [key]: {
          level,
          progress,
        },
      },
    },
  };
}

function applyTrackReward(
  cultivator: Cultivator,
  track: ConditionTrackPath,
): Cultivator {
  const nextCultivator = cultivator;
  const reward = getTrackConfig(track).reward;

  if (reward.kind === 'attribute') {
    nextCultivator.attributes = {
      ...nextCultivator.attributes,
      [reward.attribute]:
        nextCultivator.attributes[reward.attribute] + reward.amount,
    };
    return nextCultivator;
  }

  nextCultivator.spiritual_roots = nextCultivator.spiritual_roots.map((root) => ({
    ...root,
    strength: clamp(root.strength + reward.amount, 0, reward.cap),
  }));

  return nextCultivator;
}

function applyTrackProgress(
  cultivator: Cultivator,
  condition: CultivatorCondition,
  track: ConditionTrackPath,
  value: number,
): { cultivator: Cultivator; condition: CultivatorCondition; levelUps: TrackLevelUpResult[] } {
  let nextCultivator = cultivator;
  let nextCondition = condition;
  const levelUps: TrackLevelUpResult[] = [];

  const current = getTrackState(nextCondition, track);
  let level = current.level;
  let progress = current.progress + Math.max(0, Math.floor(value));

  while (progress >= getTrackConfig(track).thresholdByLevel(level)) {
    progress -= getTrackConfig(track).thresholdByLevel(level);
    level += 1;
    nextCultivator = applyTrackReward(nextCultivator, track);
    levelUps.push({ track, newLevel: level });
  }

  nextCondition = setTrackState(nextCondition, track, level, progress);
  return {
    cultivator: nextCultivator,
    condition: nextCondition,
    levelUps,
  };
}

function applyRestoreResourceOperation(
  cultivator: Cultivator,
  condition: CultivatorCondition,
  operation: Extract<ConditionOperation, { type: 'restore_resource' }>,
): CultivatorCondition {
  const { maxHp, maxMp } = ConditionService.getMaxResources(cultivator);
  const max = operation.resource === 'hp' ? maxHp : maxMp;
  const delta =
    operation.mode === 'percent'
      ? Math.floor(max * operation.value)
      : Math.floor(operation.value);
  const current =
    operation.resource === 'hp'
      ? condition.resources.hp.current
      : condition.resources.mp.current;
  const next = clamp(current + delta, 0, max);

  return operation.resource === 'hp'
    ? {
        ...condition,
        resources: {
          ...condition.resources,
          hp: { current: next },
        },
      }
    : {
        ...condition,
        resources: {
          ...condition.resources,
          mp: { current: next },
        },
      };
}

function applyRemoveStatusOperation(
  condition: CultivatorCondition,
  operation: Extract<ConditionOperation, { type: 'remove_status' }>,
): CultivatorCondition {
  return {
    ...condition,
    statuses: removeStatuses(condition.statuses, operation.status),
  };
}

function applyAddStatusOperation(
  condition: CultivatorCondition,
  operation: Extract<ConditionOperation, { type: 'add_status' }>,
  now: Date,
): CultivatorCondition {
  const existing = condition.statuses.find((status) => status.key === operation.status);
  const nextStatus: ConditionStatusInstance = {
    key: operation.status,
    stacks: Math.max(1, (existing?.stacks ?? 0) + Math.floor(operation.stacks ?? 1)),
    source: 'pill',
    duration: operation.duration ?? existing?.duration ?? createUntilRemovedDuration(),
    usesRemaining:
      operation.usesRemaining ?? existing?.usesRemaining,
    payload: operation.payload ?? existing?.payload,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return {
    ...condition,
    statuses: replaceStatus(condition.statuses, nextStatus),
  };
}

function sortOperations(operations: ConditionOperation[]): ConditionOperation[] {
  return [...operations].sort(
    (left, right) =>
      EXECUTION_ORDER.indexOf(left.type) - EXECUTION_ORDER.indexOf(right.type),
  );
}

function consumeBreakthroughStatus(
  status: ConditionStatusInstance,
  now: Date,
): ConditionStatusInstance | null {
  if (
    typeof status.usesRemaining === 'number' &&
    status.usesRemaining > 0
  ) {
    const nextUses = status.usesRemaining - 1;
    if (nextUses <= 0) {
      return null;
    }
    return {
      ...status,
      usesRemaining: nextUses,
      updatedAt: now.toISOString(),
    };
  }

  return null;
}

export const PillOperationExecutor = {
  sortOperations,

  execute(
    cultivator: Cultivator,
    consumable: Consumable,
    now: Date = new Date(),
  ): PillExecutionResult {
    if (!isPillConsumable(consumable)) {
      throw new Error('该消耗品并非丹药，无法按丹药协议执行。');
    }

    if (consumable.spec.consumeRules.scene !== 'out_of_battle_only') {
      throw new Error('该丹药当前不可在背包内直接服用。');
    }

    const nextCultivator = cloneCultivator(cultivator);
    let nextCondition = ConditionService.tickNaturalRecovery(
      nextCultivator,
      nextCultivator.condition,
      now,
    );
    const trackLevelUps: TrackLevelUpResult[] = [];

    if (consumable.spec.consumeRules.countsTowardLongTermQuota) {
      const used =
        nextCondition.counters.longTermPillUsesByRealm[nextCultivator.realm] ?? 0;
      const limit = REALM_PILL_USAGE_LIMITS[nextCultivator.realm];
      if (used >= limit) {
        throw new Error(
          `本境长期丹药服用次数已达上限（${used}/${limit}），无法继续服用。`,
        );
      }
      nextCondition = {
        ...nextCondition,
        counters: {
          ...nextCondition.counters,
          longTermPillUsesByRealm: {
            ...nextCondition.counters.longTermPillUsesByRealm,
            [nextCultivator.realm]: used + 1,
          },
        },
      };
    }

    for (const operation of sortOperations(consumable.spec.operations)) {
      switch (operation.type) {
        case 'restore_resource':
          nextCondition = applyRestoreResourceOperation(
            nextCultivator,
            nextCondition,
            operation,
          );
          break;
        case 'change_gauge':
          nextCondition = {
            ...nextCondition,
            gauges: {
              ...nextCondition.gauges,
              pillToxicity: clamp(
                nextCondition.gauges.pillToxicity + operation.delta,
                0,
                1000,
              ),
            },
          };
          break;
        case 'remove_status':
          nextCondition = applyRemoveStatusOperation(nextCondition, operation);
          break;
        case 'add_status':
          nextCondition = applyAddStatusOperation(nextCondition, operation, now);
          break;
        case 'advance_track': {
          const result = applyTrackProgress(
            nextCultivator,
            nextCondition,
            operation.track,
            operation.value,
          );
          nextCultivator.attributes = result.cultivator.attributes;
          nextCultivator.spiritual_roots = result.cultivator.spiritual_roots;
          nextCondition = result.condition;
          trackLevelUps.push(...result.levelUps);
          break;
        }
      }
    }

    nextCondition = ConditionService.normalizeCondition(
      nextCultivator,
      {
        ...nextCondition,
        timestamps: {
          ...nextCondition.timestamps,
          lastPillAt: now.toISOString(),
        },
      },
      now,
    );
    nextCultivator.condition = nextCondition;

    return {
      cultivator: nextCultivator,
      consumed: consumable,
      trackLevelUps,
    };
  },

  consumeBreakthroughSupportStatuses(
    conditionInput: CultivatorCondition | undefined,
    cultivator: Cultivator,
    now: Date = new Date(),
  ): CultivatorCondition {
    const condition = ConditionService.normalizeCondition(cultivator, conditionInput, now);

    return {
      ...condition,
      statuses: condition.statuses.flatMap((status) => {
        if (!BREAKTHROUGH_SUPPORT_STATUSES.includes(status.key)) {
          return [status];
        }

        const consumed = consumeBreakthroughStatus(status, now);
        return consumed ? [consumed] : [];
      }),
      timestamps: {
        ...condition.timestamps,
        lastBreakthroughAt: now.toISOString(),
      },
    };
  },
};

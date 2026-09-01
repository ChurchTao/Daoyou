import { getOrInitCultivationProgress } from '@server/utils/cultivationUtils';
import {
  CULTIVATION_PILL_MAX_QUALITY_BY_REALM,
  getMinimumPillQualityByRealm,
  PILL_TOXICITY_CAP,
  REALM_PILL_USAGE_LIMITS,
} from '@shared/config/consumableSystem';
import type { CultivatorDisplayInput } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import {
  BODY_CULTIVATION_REALM_REQUIREMENTS,
  BODY_REALM_LABELS,
  getBodyTrackKeyFromPath,
  isBodyCultivationTrackPath,
  isLegacyTemperingTrackPath,
} from '@shared/lib/bodyCultivation/config';
import {
  createDefaultBodyCultivationState,
  normalizeBodyCultivationState,
} from '@shared/lib/bodyCultivation/normalize';
import { getConditionStatusCureTargets } from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import {
  isPillConsumable,
  isSpiritFruitConsumable,
} from '@shared/lib/consumables';
import {
  CULTIVATION_BOOST_STATUS_KEY,
  getCultivationBoostPercent,
} from '@shared/lib/cultivationBoost';
import {
  advanceMarrowWashTowardBreakthrough,
  getMarrowWashLevelCapByCultivationRealm,
  getNextMarrowWashBreakthroughLevel,
  isMarrowWashBreakthroughRequired,
  normalizeMarrowWashState,
} from '@shared/lib/marrowWash';
import {
  BREAKTHROUGH_FOCUS_STATUS_KEY,
  CLEAR_MIND_STATUS_KEY,
  getBreakthroughFocusBonus,
  getProtectMeridiansReductionPercent,
  PROTECT_MERIDIANS_STATUS_KEY,
} from '@shared/lib/pillEffectScaling';
import {
  getPillUsageLimitReachedText,
  getPrimaryPillQuotaCategory,
} from '@shared/lib/pillUsageText';
import { getTrackConfig } from '@shared/lib/trackConfigRegistry';
import type {
  BodyCultivationTrackPath,
  ConditionStatusDuration,
  ConditionStatusInstance,
  ConditionStatusKey,
  ConditionTrackPath,
  CultivatorCondition,
} from '@shared/types/condition';
import { QUALITY_ORDER } from '@shared/types/constants';
import type { ConditionOperation, PillSpec } from '@shared/types/consumable';
import type {
  Consumable,
  CultivationProgress,
  Cultivator,
} from '@shared/types/cultivator';
import { ConditionService } from './ConditionService';

const EXECUTION_ORDER: ConditionOperation['type'][] = [
  'restore_resource',
  'change_gauge',
  'gain_progress',
  'increase_lifespan',
  'remove_status',
  'add_status',
  'advance_track',
];

const MAX_LIFESPAN_DELTA = 100_000;
const MAX_LIFESPAN_TOTAL = 10_000_000;
const PILL_TOXICITY_BLOCK_MESSAGE =
  '丹毒已达上限，暂不可继续服用会增加丹毒的丹药。请先炼制或服用解毒丹化解丹毒。';

const BREAKTHROUGH_SUPPORT_STATUSES: ConditionStatusKey[] = [
  'breakthrough_focus',
  'protect_meridians',
  'clear_mind',
];

interface TrackLevelUpResult {
  track: ConditionTrackPath;
  newLevel: number;
}

export type PillCultivatorFacts = CultivatorDisplayInput &
  Pick<
    Cultivator,
    | 'lifespan'
    | 'unallocated_attribute_points'
    | 'spiritual_roots'
    | 'pre_heaven_fates'
    | 'cultivation_progress'
  >;

export interface PillExecutionResult {
  cultivator: PillCultivatorFacts;
  consumed: Consumable & { spec: PillSpec };
  trackLevelUps: TrackLevelUpResult[];
  appliedEffects: string[];
  noEffectReasons: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cloneCultivator(cultivator: PillCultivatorFacts): PillCultivatorFacts {
  return structuredClone(cultivator);
}

function createUntilRemovedDuration(): ConditionStatusDuration {
  return { kind: 'until_removed' };
}

function assertPillQualityAllowed(
  cultivator: PillCultivatorFacts,
  consumable: Consumable & { spec: PillSpec },
  itemLabel: '丹药' | '灵果' = '丹药',
): void {
  const maxQuality = CULTIVATION_PILL_MAX_QUALITY_BY_REALM[cultivator.realm];
  const minQuality = getMinimumPillQualityByRealm(cultivator.realm);
  const pillQuality = consumable.quality ?? '凡品';
  const pillOrder = QUALITY_ORDER[pillQuality] ?? 0;
  if (pillOrder > (QUALITY_ORDER[maxQuality] ?? 0)) {
    throw new Error(
      `药力过盛，强行服用恐爆体而亡。当前境界最多可承受${maxQuality}${itemLabel}。`,
    );
  }
  if (pillOrder < (QUALITY_ORDER[minQuality] ?? 0)) {
    throw new Error(
      `这枚${itemLabel}药力过于稀薄，无法在当前境界形成有效药路。`,
    );
  }
}

function getProgressValue(
  cultivator: PillCultivatorFacts,
  target: Extract<ConditionOperation, { type: 'gain_progress' }>['target'],
): number {
  const progress = getOrInitCultivationProgress(
    (cultivator.cultivation_progress ?? {}) as CultivationProgress,
    cultivator.realm,
    cultivator.realm_stage,
  );
  return target === 'cultivation_exp'
    ? progress.cultivation_exp
    : progress.comprehension_insight;
}

function getStatusSnapshot(
  condition: CultivatorCondition,
  status: ConditionStatusKey,
): string {
  return JSON.stringify(
    condition.statuses.find((item) => item.key === status) ?? null,
  );
}

function removeStatuses(
  statuses: ConditionStatusInstance[],
  keys: ConditionStatusKey[],
): ConditionStatusInstance[] {
  const keySet = new Set(keys);
  return statuses.filter((status) => !keySet.has(status.key));
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

  if (isBodyCultivationTrackPath(track) || isLegacyTemperingTrackPath(track)) {
    const key = getBodyTrackKeyFromPath(track);
    return (
      condition.tracks.bodyCultivation?.tracks[key] ?? {
        level: 0,
        progress: 0,
      }
    );
  }

  throw new Error(`未知的长期进度轨道：${track satisfies never}`);
}

function getAppliedTrackProgress(
  track: ConditionTrackPath,
  before: ReturnType<typeof getTrackState>,
  after: ReturnType<typeof getTrackState>,
): number {
  let applied = after.progress - before.progress;
  for (let level = before.level; level < after.level; level += 1) {
    applied += getTrackConfig(track).thresholdByLevel(level);
  }
  return Math.max(0, Math.floor(applied));
}

function setTrackState(
  condition: CultivatorCondition,
  track: ConditionTrackPath,
  level: number,
  progress: number,
): CultivatorCondition {
  if (track === 'marrow_wash') {
    const state = normalizeMarrowWashState(condition);
    return {
      ...condition,
      tracks: {
        ...condition.tracks,
        marrowWash: {
          ...state,
          level,
          progress,
        },
      },
    };
  }

  if (isBodyCultivationTrackPath(track) || isLegacyTemperingTrackPath(track)) {
    const key = getBodyTrackKeyFromPath(track);
    const bodyCultivation =
      condition.tracks.bodyCultivation ?? createDefaultBodyCultivationState();

    return {
      ...condition,
      tracks: {
        ...condition.tracks,
        bodyCultivation: {
          ...bodyCultivation,
          tracks: {
            ...bodyCultivation.tracks,
            [key]: {
              level,
              progress,
            },
          },
        },
      },
    };
  }

  throw new Error(`未知的长期进度轨道：${track satisfies never}`);
}

function applyTrackReward(
  cultivator: PillCultivatorFacts,
  track: ConditionTrackPath,
): PillCultivatorFacts {
  const nextCultivator = cultivator;
  const reward = getTrackConfig(track).reward;

  if (track === 'marrow_wash') {
    nextCultivator.unallocated_attribute_points =
      Math.max(
        0,
        Math.floor(nextCultivator.unallocated_attribute_points ?? 0),
      ) + 1;
    return nextCultivator;
  }

  if (reward.kind === 'none') {
    return nextCultivator;
  }

  if (reward.kind === 'body_modifier') {
    return nextCultivator;
  }

  if (reward.kind === 'attribute') {
    nextCultivator.attributes = {
      ...nextCultivator.attributes,
      [reward.attribute]:
        nextCultivator.attributes[reward.attribute] + reward.amount,
    };
    return nextCultivator;
  }

  nextCultivator.spiritual_roots = nextCultivator.spiritual_roots.map(
    (root) => ({
      ...root,
      strength: clamp(root.strength + reward.amount, 0, reward.cap),
    }),
  );

  return nextCultivator;
}

function getEffectiveTrackProgressValue(value: number): number {
  const baseValue = Math.max(0, Math.floor(value));
  return baseValue;
}

function applyTrackProgress(
  cultivator: PillCultivatorFacts,
  condition: CultivatorCondition,
  track: ConditionTrackPath,
  value: number,
): {
  cultivator: PillCultivatorFacts;
  condition: CultivatorCondition;
  levelUps: TrackLevelUpResult[];
} {
  let nextCultivator = cultivator;
  let nextCondition = condition;
  const levelUps: TrackLevelUpResult[] = [];
  const levelUpTrack: ConditionTrackPath =
    isBodyCultivationTrackPath(track) || isLegacyTemperingTrackPath(track)
      ? (`body.${getBodyTrackKeyFromPath(track)}` as BodyCultivationTrackPath)
      : track;

  const current = getTrackState(nextCondition, track);
  if (track === 'marrow_wash') {
    const result = advanceMarrowWashTowardBreakthrough(
      normalizeMarrowWashState(nextCondition),
      getEffectiveTrackProgressValue(value),
    );
    for (const newLevel of result.levelUps) {
      nextCultivator = applyTrackReward(nextCultivator, track);
      levelUps.push({ track: levelUpTrack, newLevel });
    }
    nextCondition = setTrackState(
      nextCondition,
      track,
      result.state.level,
      result.state.progress,
    );
    return {
      cultivator: nextCultivator,
      condition: nextCondition,
      levelUps,
    };
  }

  let level = current.level;
  let progress = current.progress + getEffectiveTrackProgressValue(value);

  while (progress >= getTrackConfig(track).thresholdByLevel(level)) {
    progress -= getTrackConfig(track).thresholdByLevel(level);
    level += 1;
    nextCultivator = applyTrackReward(nextCultivator, track);
    levelUps.push({ track: levelUpTrack, newLevel: level });
  }

  nextCondition = setTrackState(nextCondition, track, level, progress);
  return {
    cultivator: nextCultivator,
    condition: nextCondition,
    levelUps,
  };
}

function applyRestoreResourceOperation(
  cultivator: PillCultivatorFacts,
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
    statuses: removeStatuses(
      condition.statuses,
      getConditionStatusCureTargets(operation.status),
    ),
  };
}

function applyAddStatusOperation(
  condition: CultivatorCondition,
  operation: Extract<ConditionOperation, { type: 'add_status' }>,
  now: Date,
): CultivatorCondition {
  const existing = condition.statuses.find(
    (status) => status.key === operation.status,
  );
  if (
    operation.status === CULTIVATION_BOOST_STATUS_KEY &&
    existing &&
    getCultivationBoostPercent(existing) >=
      getCultivationBoostPercent(operation)
  ) {
    return condition;
  }

  if (
    operation.status === BREAKTHROUGH_FOCUS_STATUS_KEY &&
    existing &&
    getBreakthroughFocusBonus(existing) >= getBreakthroughFocusBonus(operation)
  ) {
    return condition;
  }

  if (
    operation.status === PROTECT_MERIDIANS_STATUS_KEY &&
    existing &&
    getProtectMeridiansReductionPercent(existing) >=
      getProtectMeridiansReductionPercent(operation)
  ) {
    return condition;
  }

  if (operation.status === CLEAR_MIND_STATUS_KEY && existing) {
    const existingUses = existing.usesRemaining ?? 1;
    const nextUses = operation.usesRemaining ?? 1;
    const nextStatus: ConditionStatusInstance = {
      ...existing,
      stacks: Math.max(1, existing.stacks),
      source: 'pill',
      duration: operation.duration ?? existing.duration,
      usesRemaining: Math.max(existingUses, nextUses),
      payload: {
        ...existing.payload,
        ...operation.payload,
      },
      updatedAt: now.toISOString(),
    };
    return {
      ...condition,
      statuses: replaceStatus(condition.statuses, nextStatus),
    };
  }

  const nextStatus: ConditionStatusInstance = {
    key: operation.status,
    stacks: Math.max(
      1,
      (existing?.stacks ?? 0) + Math.floor(operation.stacks ?? 1),
    ),
    source: 'pill',
    duration:
      operation.duration ?? existing?.duration ?? createUntilRemovedDuration(),
    usesRemaining: operation.usesRemaining ?? existing?.usesRemaining,
    payload: operation.payload ?? existing?.payload,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return {
    ...condition,
    statuses: replaceStatus(condition.statuses, nextStatus),
  };
}

function applyGainProgressOperation(
  cultivator: PillCultivatorFacts,
  operation: Extract<ConditionOperation, { type: 'gain_progress' }>,
): PillCultivatorFacts {
  const progress = getOrInitCultivationProgress(
    (cultivator.cultivation_progress ?? {}) as CultivationProgress,
    cultivator.realm,
    cultivator.realm_stage,
  );

  const nextProgress =
    operation.target === 'cultivation_exp'
      ? {
          ...progress,
          cultivation_exp:
            progress.cultivation_exp + Math.max(0, Math.floor(operation.value)),
        }
      : {
          ...progress,
          comprehension_insight: Math.max(
            0,
            Math.min(
              100,
              progress.comprehension_insight +
                Math.max(0, Math.floor(operation.value)),
            ),
          ),
        };

  cultivator.cultivation_progress = nextProgress;
  return cultivator;
}

function applyIncreaseLifespanOperation(
  cultivator: PillCultivatorFacts,
  operation: Extract<ConditionOperation, { type: 'increase_lifespan' }>,
): PillCultivatorFacts {
  if (!Number.isFinite(operation.value) || operation.value <= 0) {
    throw new Error('寿元丹药效异常，无法服用。');
  }

  const delta = clamp(Math.floor(operation.value), 1, MAX_LIFESPAN_DELTA);
  cultivator.lifespan = clamp(
    Math.floor(cultivator.lifespan) + delta,
    0,
    MAX_LIFESPAN_TOTAL,
  );
  return cultivator;
}

function sortOperations(
  operations: ConditionOperation[],
): ConditionOperation[] {
  return [...operations].sort(
    (left, right) =>
      EXECUTION_ORDER.indexOf(left.type) - EXECUTION_ORDER.indexOf(right.type),
  );
}

function getNetPillToxicityDelta(spec: PillSpec): number {
  return spec.operations.reduce((sum, operation) => {
    if (
      operation.type !== 'change_gauge' ||
      operation.gauge !== 'pillToxicity'
    ) {
      return sum;
    }

    return sum + operation.delta;
  }, 0);
}

function assertBodyCultivationPillTrackCaps(
  condition: CultivatorCondition,
  spec: PillSpec,
  itemLabel: '丹药' | '灵果',
): void {
  let projectedCondition = condition;

  for (const operation of sortOperations(spec.operations)) {
    if (
      operation.type !== 'advance_track' ||
      (!isBodyCultivationTrackPath(operation.track) &&
        !isLegacyTemperingTrackPath(operation.track))
    ) {
      continue;
    }

    const value = Math.max(0, Math.floor(operation.value));
    if (value <= 0) {
      continue;
    }

    const bodyState = normalizeBodyCultivationState(projectedCondition);
    const cap =
      BODY_CULTIVATION_REALM_REQUIREMENTS[bodyState.realm].softTrackCap;
    const trackState = getTrackState(projectedCondition, operation.track);
    const trackName = getTrackConfig(operation.track).name;
    const realmLabel = BODY_REALM_LABELS[bodyState.realm];

    if (trackState.level >= cap) {
      throw new Error(
        `${trackName}已达当前肉身境界「${realmLabel}」的单轨上限 Lv.${cap}，请先完成肉身破限后再服用${itemLabel}。`,
      );
    }

    let level = trackState.level;
    let progress = trackState.progress;
    let remaining = value;

    while (remaining > 0) {
      const threshold = getTrackConfig(operation.track).thresholdByLevel(level);
      const needed = threshold - progress;
      if (remaining < needed) {
        progress += remaining;
        break;
      }

      remaining -= needed;
      level += 1;
      progress = 0;

      if (level > cap || (level === cap && remaining > 0)) {
        throw new Error(
          `${trackName}本次药力将超过当前肉身境界「${realmLabel}」的单轨上限 Lv.${cap}，请先完成肉身破限后再服用${itemLabel}。`,
        );
      }
    }

    projectedCondition = setTrackState(
      projectedCondition,
      operation.track,
      level,
      progress,
    );
  }
}

function assertMarrowWashPillTrackCaps(
  cultivator: PillCultivatorFacts,
  condition: CultivatorCondition,
  spec: PillSpec,
  itemLabel: '丹药' | '灵果',
): void {
  let projectedState = normalizeMarrowWashState(condition);
  const cap = getMarrowWashLevelCapByCultivationRealm(cultivator.realm);

  for (const operation of sortOperations(spec.operations)) {
    if (
      operation.type !== 'advance_track' ||
      operation.track !== 'marrow_wash'
    ) {
      continue;
    }

    const value = Math.max(0, Math.floor(operation.value));
    if (value <= 0) {
      continue;
    }

    if (isMarrowWashBreakthroughRequired(projectedState)) {
      const breakthroughLevel =
        getNextMarrowWashBreakthroughLevel(projectedState);
      throw new Error(
        `洗髓已达破限瓶颈 Lv.${breakthroughLevel}，请先完成本次破限后再服用${itemLabel}。`,
      );
    }

    if (projectedState.level >= cap) {
      throw new Error(
        `洗髓已达当前修为境界的等级上限 Lv.${cap}，请先提升修为境界后再服用${itemLabel}。`,
      );
    }

    const advancement = advanceMarrowWashTowardBreakthrough(
      projectedState,
      value,
    );
    if (
      advancement.state.level > cap ||
      (advancement.state.level === cap && advancement.state.progress > 0)
    ) {
      throw new Error(
        `本次药力将超过当前修为境界的洗髓等级上限 Lv.${cap}，请先提升修为境界后再服用${itemLabel}。`,
      );
    }

    projectedState = advancement.state;
  }
}

function getEffectiveQuotaCategory(
  spec: PillSpec,
): PillSpec['consumeRules']['quotaCategory'] {
  return getPrimaryPillQuotaCategory(spec);
}

function consumeBreakthroughStatus(
  status: ConditionStatusInstance,
  now: Date,
): ConditionStatusInstance | null {
  if (typeof status.usesRemaining === 'number' && status.usesRemaining > 0) {
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
    cultivator: PillCultivatorFacts,
    consumable: Consumable,
    now: Date = new Date(),
  ): PillExecutionResult {
    const isSpiritFruit = isSpiritFruitConsumable(consumable);
    const effectConsumable: Consumable & { spec: PillSpec } = isPillConsumable(
      consumable,
    )
      ? consumable
      : isSpiritFruitConsumable(consumable)
        ? {
            ...consumable,
            type: '丹药',
            spec: {
              kind: 'pill',
              family: consumable.spec.family,
              operations: consumable.spec.operations.filter(
                (operation) =>
                  operation.type !== 'change_gauge' || operation.delta <= 0,
              ),
              consumeRules: {
                scene: 'out_of_battle_only',
                quotaCategory: 'none',
              },
              alchemyMeta: {
                source: 'improvised',
                sourceMaterials: [],
                stability: 100,
                toxicityRating: 0,
                tags: ['spirit-fruit'],
                version: 4,
              },
            },
          }
        : (() => {
            throw new Error('该消耗品并非丹药或灵果，无法按药效协议执行。');
          })();

    const itemLabel = isSpiritFruit ? '灵果' : '丹药';
    if (effectConsumable.spec.consumeRules.scene !== 'out_of_battle_only') {
      throw new Error(`该${itemLabel}当前不可在背包内直接服用。`);
    }

    assertPillQualityAllowed(cultivator, effectConsumable, itemLabel);

    const nextCultivator = cloneCultivator(cultivator);
    let nextCondition = ConditionService.tickNaturalRecovery(
      nextCultivator,
      nextCultivator.condition,
      now,
    );
    const trackLevelUps: TrackLevelUpResult[] = [];
    const appliedEffects: string[] = [];
    const noEffectReasons: string[] = [];

    const quotaCategory = isSpiritFruit
      ? 'none'
      : getEffectiveQuotaCategory(effectConsumable.spec);
    if (
      nextCondition.gauges.pillToxicity >= PILL_TOXICITY_CAP &&
      getNetPillToxicityDelta(effectConsumable.spec) > 0
    ) {
      throw new Error(PILL_TOXICITY_BLOCK_MESSAGE);
    }
    assertBodyCultivationPillTrackCaps(
      nextCondition,
      effectConsumable.spec,
      itemLabel,
    );
    assertMarrowWashPillTrackCaps(
      nextCultivator,
      nextCondition,
      effectConsumable.spec,
      itemLabel,
    );

    if (quotaCategory === 'long_term') {
      const used =
        nextCondition.counters.longTermPillUsesByRealm[nextCultivator.realm] ??
        0;
      const limit = REALM_PILL_USAGE_LIMITS[nextCultivator.realm];
      if (used >= limit) {
        throw new Error(getPillUsageLimitReachedText('long_term', used, limit));
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

    if (quotaCategory === 'longevity') {
      const used =
        nextCondition.counters.longevityPillUsesByRealm[nextCultivator.realm] ??
        0;
      const limit = REALM_PILL_USAGE_LIMITS[nextCultivator.realm];
      if (used >= limit) {
        throw new Error(getPillUsageLimitReachedText('longevity', used, limit));
      }
      nextCondition = {
        ...nextCondition,
        counters: {
          ...nextCondition.counters,
          longevityPillUsesByRealm: {
            ...nextCondition.counters.longevityPillUsesByRealm,
            [nextCultivator.realm]: used + 1,
          },
        },
      };
    }

    for (const operation of sortOperations(effectConsumable.spec.operations)) {
      switch (operation.type) {
        case 'restore_resource': {
          const before =
            operation.resource === 'hp'
              ? nextCondition.resources.hp.current
              : nextCondition.resources.mp.current;
          nextCondition = applyRestoreResourceOperation(
            nextCultivator,
            nextCondition,
            operation,
          );
          const after =
            operation.resource === 'hp'
              ? nextCondition.resources.hp.current
              : nextCondition.resources.mp.current;
          const restored = Math.max(0, after - before);
          const label = operation.resource === 'hp' ? '气血' : '法力';
          if (restored > 0) appliedEffects.push(`${label} +${restored}`);
          else noEffectReasons.push(`${label}已满`);
          break;
        }
        case 'change_gauge': {
          const before = nextCondition.gauges.pillToxicity;
          nextCondition = {
            ...nextCondition,
            gauges: {
              ...nextCondition.gauges,
              pillToxicity: clamp(
                nextCondition.gauges.pillToxicity + operation.delta,
                0,
                PILL_TOXICITY_CAP,
              ),
            },
          };
          const delta = nextCondition.gauges.pillToxicity - before;
          if (delta !== 0) {
            appliedEffects.push(`丹毒 ${delta > 0 ? '+' : ''}${delta}`);
          } else {
            noEffectReasons.push(
              operation.delta < 0 ? '丹毒已为 0' : '丹毒已达上限',
            );
          }
          break;
        }
        case 'gain_progress': {
          const before = getProgressValue(nextCultivator, operation.target);
          applyGainProgressOperation(nextCultivator, operation);
          const after = getProgressValue(nextCultivator, operation.target);
          const gained = Math.max(0, after - before);
          const label =
            operation.target === 'cultivation_exp' ? '修为' : '感悟';
          if (gained > 0) appliedEffects.push(`${label} +${gained}`);
          else noEffectReasons.push(`${label}已达当前上限`);
          break;
        }
        case 'increase_lifespan': {
          const before = nextCultivator.lifespan;
          applyIncreaseLifespanOperation(nextCultivator, operation);
          const gained = Math.max(0, nextCultivator.lifespan - before);
          if (gained > 0) appliedEffects.push(`寿元 +${gained} 年`);
          else noEffectReasons.push('寿元已达上限');
          break;
        }
        case 'remove_status': {
          const before = nextCondition.statuses.length;
          nextCondition = applyRemoveStatusOperation(nextCondition, operation);
          const removed = Math.max(0, before - nextCondition.statuses.length);
          if (removed > 0) appliedEffects.push(`化解异常状态 ${removed} 项`);
          else noEffectReasons.push('当前没有可化解的异常状态');
          break;
        }
        case 'add_status': {
          const beforeStatus = getStatusSnapshot(
            nextCondition,
            operation.status,
          );
          const beforeInnerDemon = Boolean(
            nextCultivator.cultivation_progress?.inner_demon,
          );
          if (operation.status === CLEAR_MIND_STATUS_KEY) {
            const progress = getOrInitCultivationProgress(
              (nextCultivator.cultivation_progress ??
                {}) as CultivationProgress,
              nextCultivator.realm,
              nextCultivator.realm_stage,
            );
            nextCultivator.cultivation_progress = {
              ...progress,
              inner_demon: false,
            };
          }
          nextCondition = applyAddStatusOperation(
            nextCondition,
            operation,
            now,
          );
          const statusChanged =
            getStatusSnapshot(nextCondition, operation.status) !== beforeStatus;
          const innerDemonRemoved =
            beforeInnerDemon &&
            !nextCultivator.cultivation_progress?.inner_demon;
          const statusName =
            getConditionStatusTemplate(operation.status)?.name ??
            operation.status;
          if (statusChanged || innerDemonRemoved) {
            appliedEffects.push(`获得「${statusName}」助力`);
          } else {
            noEffectReasons.push('已有同等或更强的对应助力');
          }
          break;
        }
        case 'advance_track': {
          const before = getTrackState(nextCondition, operation.track);
          const result = applyTrackProgress(
            nextCultivator,
            nextCondition,
            operation.track,
            operation.value,
          );
          nextCultivator.attributes = result.cultivator.attributes;
          nextCultivator.unallocated_attribute_points =
            result.cultivator.unallocated_attribute_points;
          nextCultivator.spiritual_roots = result.cultivator.spiritual_roots;
          nextCondition = result.condition;
          trackLevelUps.push(...result.levelUps);
          const after = getTrackState(nextCondition, operation.track);
          const applied = getAppliedTrackProgress(
            operation.track,
            before,
            after,
          );
          if (applied > 0) {
            appliedEffects.push(
              `${getTrackConfig(operation.track).name}进度 +${applied}`,
            );
          } else {
            noEffectReasons.push(
              `${getTrackConfig(operation.track).name}无法继续推进`,
            );
          }
          break;
        }
      }
    }

    if (isSpiritFruit && appliedEffects.length === 0) {
      const reason = [...new Set(noEffectReasons)].join('；');
      throw new Error(
        reason
          ? `当前服用不会产生有效收益：${reason}。`
          : '当前服用不会产生有效收益。',
      );
    }

    nextCondition = ConditionService.normalizeCondition(
      nextCultivator,
      isSpiritFruit
        ? nextCondition
        : {
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
      consumed: effectConsumable,
      trackLevelUps,
      appliedEffects,
      noEffectReasons,
    };
  },

  consumeBreakthroughSupportStatuses(
    conditionInput: CultivatorCondition | undefined,
    cultivator: PillCultivatorFacts,
    now: Date = new Date(),
  ): CultivatorCondition {
    const condition = ConditionService.normalizeCondition(
      cultivator,
      conditionInput,
      now,
    );

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

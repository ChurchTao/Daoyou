import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type { BattleInitConfigV5 } from '@shared/engine/battle-v5/setup/types';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import {
  getBreakthroughPenalty,
  getNaturalRecoveryStatusMultiplier,
  getPillToxicityRecoveryMultiplier,
  isConditionStatusActive,
  NATURAL_RECOVERY_CONFIG,
} from '@shared/lib/condition';
import { evaluateFateContext } from '@shared/lib/fates';
import {
  isConditionStatusKey,
} from '@shared/lib/conditionStatusRegistry';
import {
  createDefaultBodyCultivationState,
  normalizeBodyCultivationState,
} from '@shared/lib/bodyCultivation/normalize';
import {
  breakthroughBodyCultivationRealm as advanceBodyCultivationRealm,
} from '@shared/lib/bodyCultivation/breakthrough';
import {
  getBodyCultivationBattleInitHooks,
  getBodyCultivationBattleSettleHooks,
  getBodyCultivationExternalResourceLossHooks,
  getBodyCultivationNaturalRecoveryMultiplier,
} from '@shared/lib/bodyCultivation/effects';
import type {
  BattleMode,
  BodyCultivationRealm,
  ConditionStatusDuration,
  ConditionStatusInstance,
  ConditionStatusKey,
  CultivatorCondition,
  TemperingTrackKey,
} from '@shared/types/condition';
import type { Cultivator } from '@shared/types/cultivator';

const WOUND_SEVERITY_ORDER: ConditionStatusKey[] = [
  'minor_wound',
  'major_wound',
  'near_death',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createUntilRemovedDuration(): ConditionStatusDuration {
  return { kind: 'until_removed' };
}

function createBaseTemperingTrack() {
  return {
    vitality: { level: 0, progress: 0 },
    spirit: { level: 0, progress: 0 },
    wisdom: { level: 0, progress: 0 },
    speed: { level: 0, progress: 0 },
    willpower: { level: 0, progress: 0 },
  } satisfies Record<
    TemperingTrackKey,
    CultivatorCondition['tracks']['tempering'][TemperingTrackKey]
  >;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isValidIsoString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function normalizeStatusDuration(
  value: unknown,
): ConditionStatusDuration {
  if (!isRecord(value)) {
    return createUntilRemovedDuration();
  }

  if (
    value.kind === 'time' &&
    isValidIsoString(value.expiresAt)
  ) {
    return {
      kind: 'time',
      expiresAt: value.expiresAt,
    };
  }

  return createUntilRemovedDuration();
}

function normalizeStatuses(
  value: unknown,
  now: Date,
): ConditionStatusInstance[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.key !== 'string') {
      return [];
    }
    if (!isConditionStatusKey(entry.key)) {
      return [];
    }

    const createdAt = isValidIsoString(entry.createdAt)
      ? entry.createdAt
      : now.toISOString();
    const updatedAt = isValidIsoString(entry.updatedAt)
      ? entry.updatedAt
      : createdAt;
    const usesRemaining =
      typeof entry.usesRemaining === 'number' && Number.isFinite(entry.usesRemaining)
        ? Math.max(0, Math.floor(entry.usesRemaining))
        : undefined;

    return [
      {
        key: entry.key,
        stacks:
          typeof entry.stacks === 'number' && Number.isFinite(entry.stacks)
            ? Math.max(1, Math.floor(entry.stacks))
            : 1,
        source:
          entry.source === 'battle' ||
          entry.source === 'pill' ||
          entry.source === 'event' ||
          entry.source === 'system'
            ? entry.source
            : 'system',
        duration: normalizeStatusDuration(entry.duration),
        usesRemaining,
        payload: isRecord(entry.payload)
          ? (entry.payload as Record<string, number | string | boolean>)
          : undefined,
        createdAt,
        updatedAt,
      },
    ];
  });
}

function pruneInactiveStatuses(
  statuses: ConditionStatusInstance[],
  now: Date,
): ConditionStatusInstance[] {
  return statuses.filter((status) => isConditionStatusActive(status, now));
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

function removeStatuses(
  statuses: ConditionStatusInstance[],
  keys: ConditionStatusKey[],
): ConditionStatusInstance[] {
  const keySet = new Set(keys);
  return statuses.filter((status) => !keySet.has(status.key));
}

export interface ExternalResourceLossPreview {
  maxHp: number;
  maxMp: number;
  rawHpLoss: number;
  rawMpLoss: number;
  hpLoss: number;
  mpLoss: number;
  preventedHpLoss: number;
  preventedMpLoss: number;
  hpLossMultiplier: number;
  mpLossMultiplier: number;
  triggerTexts: string[];
}

function getWoundSeverityIndex(key: ConditionStatusKey): number {
  return WOUND_SEVERITY_ORDER.indexOf(key);
}

function getCurrentWoundStatus(
  statuses: ConditionStatusInstance[],
): ConditionStatusKey | null {
  const woundStatuses = statuses
    .map((status) => status.key)
    .filter((key): key is ConditionStatusKey => getWoundSeverityIndex(key) >= 0);

  if (woundStatuses.length === 0) return null;
  return woundStatuses.sort(
    (left, right) => getWoundSeverityIndex(right) - getWoundSeverityIndex(left),
  )[0] ?? null;
}

function downgradeWoundStatus(
  woundStatus: ConditionStatusKey,
  steps: number,
): ConditionStatusKey | null {
  const currentIndex = getWoundSeverityIndex(woundStatus);
  if (currentIndex < 0) return woundStatus;
  const nextIndex = currentIndex - Math.max(0, Math.floor(steps));
  return nextIndex >= 0 ? WOUND_SEVERITY_ORDER[nextIndex] : null;
}

function setMinimumWoundStatus(
  statuses: ConditionStatusInstance[],
  target: ConditionStatusKey,
  now: Date,
): ConditionStatusInstance[] {
  const current = getCurrentWoundStatus(statuses);
  const currentIndex = current ? getWoundSeverityIndex(current) : -1;
  const targetIndex = getWoundSeverityIndex(target);
  const nextKey =
    currentIndex > targetIndex && current ? current : target;

  return replaceStatus(
    removeStatuses(statuses, WOUND_SEVERITY_ORDER),
    {
      key: nextKey,
      stacks: 1,
      source: 'battle',
      duration: createUntilRemovedDuration(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  );
}

function setBattleWoundStatus(
  statuses: ConditionStatusInstance[],
  target: ConditionStatusKey,
  downgradeSteps: number,
  now: Date,
): ConditionStatusInstance[] {
  const downgraded = downgradeWoundStatus(target, downgradeSteps);
  if (!downgraded) {
    return removeStatuses(statuses, WOUND_SEVERITY_ORDER);
  }

  return setMinimumWoundStatus(statuses, downgraded, now);
}

function toBattleStatusRefs(statuses: ConditionStatusInstance[], now: Date) {
  return statuses
    .filter((status) => isConditionStatusActive(status, now))
    .map((status) => ({
      version: 1 as const,
      templateId: status.key,
      stacks: status.stacks,
    }));
}

function buildDefaultCondition(
  cultivator: Cultivator,
  now: Date,
): CultivatorCondition {
  const display = getCultivatorDisplayAttributes(cultivator);
  return {
    version: 1,
    resources: {
      hp: { current: display.maxHp },
      mp: { current: display.maxMp },
    },
    gauges: {
      pillToxicity: 0,
    },
    tracks: {
      bodyCultivation: createDefaultBodyCultivationState(),
      tempering: createBaseTemperingTrack(),
      marrowWash: { level: 0, progress: 0 },
    },
    counters: {
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
      bodyCultivationPillUses: 0,
    },
    statuses: [],
    timestamps: {
      lastRecoveryAt: now.toISOString(),
    },
    metrics: {
      totalRecoveredHp: 0,
      totalRecoveredMp: 0,
    },
  };
}

export const ConditionService = {
  getMaxResources(
    cultivator: Cultivator,
    conditionInput?: CultivatorCondition,
  ): { maxHp: number; maxMp: number } {
    const display = getCultivatorDisplayAttributes(
      conditionInput
        ? {
            ...cultivator,
            condition: conditionInput,
          }
        : cultivator,
    );
    return {
      maxHp: display.maxHp,
      maxMp: display.maxMp,
    };
  },

  normalizeCondition(
    cultivator: Cultivator,
    input?: CultivatorCondition,
    now: Date = new Date(),
  ): CultivatorCondition {
    const defaults = buildDefaultCondition(cultivator, now);
    const raw = input ?? cultivator.condition;
    const { maxHp, maxMp } = this.getMaxResources(cultivator, raw);
    const rawTempering = raw?.tracks?.tempering;

    return {
      version: 1,
      resources: {
        hp: {
          current: clamp(
            raw?.resources?.hp?.current ?? defaults.resources.hp.current,
            0,
            maxHp,
          ),
        },
        mp: {
          current: clamp(
            raw?.resources?.mp?.current ?? defaults.resources.mp.current,
            0,
            maxMp,
          ),
        },
      },
      gauges: {
        pillToxicity: clamp(raw?.gauges?.pillToxicity ?? 0, 0, 1000),
      },
      tracks: {
        bodyCultivation: normalizeBodyCultivationState(raw),
        tempering: {
          vitality: {
            level: Math.max(0, Math.floor(rawTempering?.vitality?.level ?? 0)),
            progress: Math.max(0, Math.floor(rawTempering?.vitality?.progress ?? 0)),
          },
          spirit: {
            level: Math.max(0, Math.floor(rawTempering?.spirit?.level ?? 0)),
            progress: Math.max(0, Math.floor(rawTempering?.spirit?.progress ?? 0)),
          },
          wisdom: {
            level: Math.max(0, Math.floor(rawTempering?.wisdom?.level ?? 0)),
            progress: Math.max(0, Math.floor(rawTempering?.wisdom?.progress ?? 0)),
          },
          speed: {
            level: Math.max(0, Math.floor(rawTempering?.speed?.level ?? 0)),
            progress: Math.max(0, Math.floor(rawTempering?.speed?.progress ?? 0)),
          },
          willpower: {
            level: Math.max(0, Math.floor(rawTempering?.willpower?.level ?? 0)),
            progress: Math.max(0, Math.floor(rawTempering?.willpower?.progress ?? 0)),
          },
        },
        marrowWash: {
          level: Math.max(0, Math.floor(raw?.tracks?.marrowWash?.level ?? 0)),
          progress: Math.max(
            0,
            Math.floor(raw?.tracks?.marrowWash?.progress ?? 0),
          ),
        },
      },
      counters: {
        longTermPillUsesByRealm:
          raw?.counters?.longTermPillUsesByRealm ??
          defaults.counters.longTermPillUsesByRealm,
        cultivationPillUsesByRealm:
          raw?.counters?.cultivationPillUsesByRealm ??
          defaults.counters.cultivationPillUsesByRealm,
        longevityPillUsesByRealm:
          raw?.counters?.longevityPillUsesByRealm ??
          defaults.counters.longevityPillUsesByRealm,
        bodyCultivationPillUses: Math.max(
          0,
          Math.floor(raw?.counters?.bodyCultivationPillUses ?? 0),
        ),
      },
      statuses: pruneInactiveStatuses(
        normalizeStatuses(raw?.statuses, now),
        now,
      ),
      timestamps: {
        lastRecoveryAt:
          raw?.timestamps?.lastRecoveryAt ?? defaults.timestamps.lastRecoveryAt,
        lastBattleAt: raw?.timestamps?.lastBattleAt,
        lastPillAt: raw?.timestamps?.lastPillAt,
        lastBreakthroughAt: raw?.timestamps?.lastBreakthroughAt,
      },
      metrics: {
        totalRecoveredHp: Math.max(
          0,
          Math.floor(raw?.metrics?.totalRecoveredHp ?? 0),
        ),
        totalRecoveredMp: Math.max(
          0,
          Math.floor(raw?.metrics?.totalRecoveredMp ?? 0),
        ),
      },
    };
  },

  tickNaturalRecovery(
    cultivator: Cultivator,
    conditionInput?: CultivatorCondition,
    now: Date = new Date(),
  ): CultivatorCondition {
    const condition = this.normalizeCondition(cultivator, conditionInput, now);
    const { maxHp, maxMp } = this.getMaxResources(cultivator, condition);
    const statuses = pruneInactiveStatuses(condition.statuses, now);
    const lastRecoveryAt = Date.parse(condition.timestamps.lastRecoveryAt ?? '');

    if (!Number.isFinite(lastRecoveryAt)) {
      return {
        ...condition,
        statuses,
        timestamps: {
          ...condition.timestamps,
          lastRecoveryAt: now.toISOString(),
        },
      };
    }

    const elapsedHours = Math.max(0, now.getTime() - lastRecoveryAt) / 3600000;
    if (elapsedHours <= 0) {
      return {
        ...condition,
        statuses,
      };
    }

    const fateContext = evaluateFateContext(cultivator.pre_heaven_fates ?? []);
    const toxicityMultiplier = getPillToxicityRecoveryMultiplier(
      condition,
      fateContext.toxicityPenaltyMultiplier,
    );
    const statusMultiplier = getNaturalRecoveryStatusMultiplier(condition, now);
    const bodyCultivationMultiplier =
      getBodyCultivationNaturalRecoveryMultiplier(condition);
    const recoveryFactor =
      toxicityMultiplier *
      statusMultiplier *
      bodyCultivationMultiplier *
      fateContext.naturalRecoveryMultiplier;
    const hpRecover = Math.floor(
      maxHp * NATURAL_RECOVERY_CONFIG.hpPerHour * elapsedHours * recoveryFactor,
    );
    const mpRecover = Math.floor(
      maxMp * NATURAL_RECOVERY_CONFIG.mpPerHour * elapsedHours * recoveryFactor,
    );
    const nextHp = clamp(condition.resources.hp.current + hpRecover, 0, maxHp);
    const nextMp = clamp(condition.resources.mp.current + mpRecover, 0, maxMp);

    return {
      ...condition,
      resources: {
        hp: { current: nextHp },
        mp: { current: nextMp },
      },
      statuses,
      timestamps: {
        ...condition.timestamps,
        lastRecoveryAt: now.toISOString(),
      },
      metrics: {
        totalRecoveredHp:
          (condition.metrics?.totalRecoveredHp ?? 0) +
          Math.max(0, nextHp - condition.resources.hp.current),
        totalRecoveredMp:
          (condition.metrics?.totalRecoveredMp ?? 0) +
          Math.max(0, nextMp - condition.resources.mp.current),
      },
    };
  },

  applyExternalResourceLoss(
    cultivator: Cultivator,
    conditionInput: CultivatorCondition | undefined,
    options: {
      hpPercent?: number;
      mpPercent?: number;
      hpFlat?: number;
      mpFlat?: number;
    },
    now: Date = new Date(),
  ): CultivatorCondition {
    const condition = this.tickNaturalRecovery(cultivator, conditionInput, now);
    const preview = this.previewExternalResourceLoss(cultivator, condition, options);
    const { maxHp, maxMp, hpLoss, mpLoss } = preview;

    return {
      ...condition,
      resources: {
        hp: {
          current: clamp(condition.resources.hp.current - hpLoss, 0, maxHp),
        },
        mp: {
          current: clamp(condition.resources.mp.current - mpLoss, 0, maxMp),
        },
      },
      timestamps: {
        ...condition.timestamps,
        lastRecoveryAt: now.toISOString(),
      },
    };
  },

  previewExternalResourceLoss(
    cultivator: Cultivator,
    conditionInput: CultivatorCondition | undefined,
    options: {
      hpPercent?: number;
      mpPercent?: number;
      hpFlat?: number;
      mpFlat?: number;
    },
  ): ExternalResourceLossPreview {
    const condition = this.normalizeCondition(cultivator, conditionInput);
    const { maxHp, maxMp } = this.getMaxResources(cultivator, condition);
    const bodyHooks = getBodyCultivationExternalResourceLossHooks(condition);
    const rawHpLossValue =
      maxHp * (options.hpPercent ?? 0) + (options.hpFlat ?? 0);
    const rawMpLossValue =
      maxMp * (options.mpPercent ?? 0) + (options.mpFlat ?? 0);
    const hpLoss = Math.floor(rawHpLossValue * bodyHooks.hpLossMultiplier);
    const mpLoss = Math.floor(rawMpLossValue * bodyHooks.mpLossMultiplier);
    const rawHpLoss = Math.floor(rawHpLossValue);
    const rawMpLoss = Math.floor(rawMpLossValue);
    const preventedHpLoss = Math.max(0, rawHpLoss - hpLoss);
    const preventedMpLoss = Math.max(0, rawMpLoss - mpLoss);
    const triggerTexts: string[] = [];

    if (preventedHpLoss > 0) {
      triggerTexts.push(`肉身炼体生效：外护与承压降低气血损耗 ${preventedHpLoss} 点`);
    }
    if (preventedMpLoss > 0) {
      triggerTexts.push(`肉身炼体生效：气血与元神稳住灵力损耗 ${preventedMpLoss} 点`);
    }

    return {
      maxHp,
      maxMp,
      rawHpLoss,
      rawMpLoss,
      hpLoss,
      mpLoss,
      preventedHpLoss,
      preventedMpLoss,
      hpLossMultiplier: bodyHooks.hpLossMultiplier,
      mpLossMultiplier: bodyHooks.mpLossMultiplier,
      triggerTexts,
    };
  },

  addOrStackStatus(
    conditionInput: CultivatorCondition,
    statusKey: ConditionStatusKey,
    stacks: number,
    source: ConditionStatusInstance['source'],
    now: Date = new Date(),
  ): CultivatorCondition {
    const status = conditionInput.statuses.find((item) => item.key === statusKey);
    const nextStatus: ConditionStatusInstance = {
      key: statusKey,
      stacks: Math.max(1, (status?.stacks ?? 0) + Math.floor(stacks)),
      source,
      duration: status?.duration ?? createUntilRemovedDuration(),
      usesRemaining: status?.usesRemaining,
      payload: status?.payload,
      createdAt: status?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return {
      ...conditionInput,
      statuses: replaceStatus(conditionInput.statuses, nextStatus),
    };
  },

  buildBattleInit(
    cultivator: Cultivator,
    conditionInput: CultivatorCondition | undefined,
    mode: BattleMode,
    now: Date = new Date(),
  ): BattleInitConfigV5 {
    if (mode !== 'persistent_pve') {
      return {};
    }

    const condition = this.tickNaturalRecovery(cultivator, conditionInput, now);
    const { maxHp } = this.getMaxResources(cultivator, condition);
    const battleInitHooks = getBodyCultivationBattleInitHooks(condition);
    const startingShield = Math.floor(
      maxHp * battleInitHooks.startingShieldPercent,
    );

    return {
      player: {
        resourceState: {
          hp: {
            mode: 'absolute',
            value: condition.resources.hp.current,
          },
          mp: {
            mode: 'absolute',
            value: condition.resources.mp.current,
          },
          ...(startingShield > 0 ? { shield: startingShield } : {}),
        },
        statusRefs: toBattleStatusRefs(condition.statuses, now),
        startingBuffs: battleInitHooks.startingBuffs.map((buff) => ({
          buff,
          source: 'self',
        })),
      },
    };
  },

  applyBattleOutcome(
    cultivator: Cultivator,
    conditionInput: CultivatorCondition | undefined,
    playerSnapshot: UnitStateSnapshot,
    mode: BattleMode,
    didLose: boolean,
    now: Date = new Date(),
  ): CultivatorCondition {
    if (mode !== 'persistent_pve') {
      return this.normalizeCondition(cultivator, conditionInput, now);
    }

    const condition = this.tickNaturalRecovery(cultivator, conditionInput, now);
    const { maxHp, maxMp } = this.getMaxResources(cultivator, condition);
    const bodyHooks = getBodyCultivationBattleSettleHooks(condition);

    if (didLose) {
      const defeatProtection = bodyHooks.defeatProtection;
      return {
        ...condition,
        resources: {
          hp: { current: defeatProtection?.hpFloor ?? 1 },
          mp: { current: 0 },
        },
        statuses: defeatProtection
          ? setBattleWoundStatus(
              condition.statuses,
              defeatProtection.woundStatus,
              0,
              now,
            )
          : setMinimumWoundStatus(condition.statuses, 'near_death', now),
        timestamps: {
          ...condition.timestamps,
          lastBattleAt: now.toISOString(),
          lastRecoveryAt: now.toISOString(),
        },
      };
    }

    const currentHp = clamp(playerSnapshot.hp.current, 0, maxHp);
    const currentMp = clamp(playerSnapshot.mp.current, 0, maxMp);
    const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;
    let statuses = condition.statuses;

    if (hpRatio <= 0.15) {
      statuses = setBattleWoundStatus(
        statuses,
        'major_wound',
        bodyHooks.woundDowngradeSteps,
        now,
      );
    } else if (hpRatio <= 0.35) {
      statuses = setBattleWoundStatus(
        statuses,
        'minor_wound',
        bodyHooks.woundDowngradeSteps,
        now,
      );
    }
    const settledHp =
      hpRatio > 0 &&
      hpRatio < 0.5 &&
      bodyHooks.lowHpRecoveryPercent > 0
        ? clamp(
            currentHp + Math.floor(maxHp * bodyHooks.lowHpRecoveryPercent),
            0,
            maxHp,
          )
        : currentHp;

    return {
      ...condition,
      resources: {
        hp: { current: settledHp },
        mp: { current: currentMp },
      },
      statuses,
      timestamps: {
        ...condition.timestamps,
        lastBattleAt: now.toISOString(),
        lastRecoveryAt: now.toISOString(),
      },
    };
  },

  getBreakthroughPenalty(
    cultivator: Cultivator,
    conditionInput: CultivatorCondition | undefined,
  ): number {
    return getBreakthroughPenalty(
      conditionInput,
      evaluateFateContext(cultivator.pre_heaven_fates ?? []).toxicityPenaltyMultiplier,
    );
  },

  breakthroughBodyCultivationRealm(
    cultivator: Cultivator,
    conditionInput: CultivatorCondition | undefined,
    now: Date = new Date(),
    rng: () => number = Math.random,
  ): {
    condition: CultivatorCondition;
    fromRealm: BodyCultivationRealm;
    toRealm: BodyCultivationRealm;
    success: boolean;
    chance: number;
    roll: number;
    failedAttempts: number;
    guaranteeProgress: number;
  } {
    const condition = this.normalizeCondition(cultivator, conditionInput, now);
    const result = advanceBodyCultivationRealm(condition, {
      cultivatorRealm: cultivator.realm,
    }, rng);

    return {
      condition: {
        ...condition,
        tracks: {
          ...condition.tracks,
          bodyCultivation: result.state,
        },
      },
      fromRealm: result.fromRealm,
      toRealm: result.toRealm,
      success: result.success,
      chance: result.chance,
      roll: result.roll,
      failedAttempts: result.failedAttempts,
      guaranteeProgress: result.guaranteeProgress,
    };
  },
};

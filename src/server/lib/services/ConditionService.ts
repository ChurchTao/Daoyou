import {
  characterResourceMaxima,
  normalizeCharacterResource,
  type CultivatorDisplayInput,
} from '@shared/lib/cultivatorDisplay';
import {
  getBreakthroughPenalty,
  isConditionStatusActive,
  projectNaturalRecoveryResources,
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
import { PILL_TOXICITY_CAP } from '@shared/config/consumableSystem';
import { normalizeMarrowWashState } from '@shared/lib/marrowWash';
import type {
  BodyCultivationRealm,
  ConditionStatusDuration,
  ConditionStatusInstance,
  ConditionStatusKey,
  ConditionResourcePoint,
  CultivatorCondition,
  TemperingTrackKey,
} from '@shared/types/condition';
import type { Cultivator } from '@shared/types/cultivator';

export type ConditionCultivatorFacts = CultivatorDisplayInput &
  Pick<Cultivator, 'pre_heaven_fates'>;

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

function buildDefaultCondition(
  cultivator: CultivatorDisplayInput,
  now: Date,
): CultivatorCondition {
  const display = characterResourceMaxima(cultivator);
  return {
    version: 1,
    resources: {
      hp: { current: display.maxHp, max: display.maxHp },
      mp: { current: display.maxMp, max: display.maxMp },
    },
    gauges: {
      pillToxicity: 0,
    },
    tracks: {
      bodyCultivation: createDefaultBodyCultivationState(),
      tempering: createBaseTemperingTrack(),
          marrowWash: {
            version: 1,
            level: 0,
            progress: 0,
            realm: 0,
            breakthroughs: 0,
          },
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

function normalizeResourcePoint(args: {
  current: number | undefined;
  defaultCurrent: number;
  runtimeMax: number;
}): ConditionResourcePoint {
  const rawCurrent =
    typeof args.current === 'number' && Number.isFinite(args.current)
      ? Math.floor(args.current)
      : args.defaultCurrent;
  return normalizeCharacterResource(rawCurrent, args.runtimeMax);
}

export const ConditionService = {
  /** v6 supplies authoritative maxima; this path never invokes legacy projections. */
  applyCombatV6Resources(condition: CultivatorCondition, resources: {hp:number;mp:number;maxHp:number;maxMp:number}, now = new Date()): CultivatorCondition {
    return { ...structuredClone(condition), resources: {hp:{current:resources.hp,max:resources.maxHp},mp:{current:resources.mp,max:resources.maxMp}}, timestamps:{...condition.timestamps,lastRecoveryAt:now.toISOString(),lastBattleAt:now.toISOString()} };
  },
  recoverCombatV6Resources(condition: CultivatorCondition, maxima: {maxHp:number;maxMp:number}, now = new Date(), recovery: {toxicityPenaltyMultiplier:number;naturalRecoveryMultiplier:number} = {toxicityPenaltyMultiplier:1,naturalRecoveryMultiplier:1}): CultivatorCondition {
    const projection = projectNaturalRecoveryResources({conditionInput:condition,...maxima,now,...recovery});
    return {...structuredClone(condition),resources:projection.resources,timestamps:{...condition.timestamps,lastRecoveryAt:now.toISOString()}};
  },
  getMaxResources(
    cultivator: CultivatorDisplayInput,
    conditionInput?: CultivatorCondition,
  ): { maxHp: number; maxMp: number } {
    return characterResourceMaxima(cultivator, conditionInput);
  },

  normalizeCondition(
    cultivator: CultivatorDisplayInput,
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
        hp: normalizeResourcePoint({
          current: raw?.resources?.hp?.current,
          defaultCurrent: defaults.resources.hp.current,
          runtimeMax: maxHp,
        }),
        mp: normalizeResourcePoint({
          current: raw?.resources?.mp?.current,
          defaultCurrent: defaults.resources.mp.current,
          runtimeMax: maxMp,
        }),
      },
      gauges: {
        pillToxicity: clamp(raw?.gauges?.pillToxicity ?? 0, 0, PILL_TOXICITY_CAP),
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
        marrowWash: normalizeMarrowWashState(raw),
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
    cultivator: ConditionCultivatorFacts,
    conditionInput?: CultivatorCondition,
    now: Date = new Date(),
  ): CultivatorCondition {
    const condition = this.normalizeCondition(
      cultivator,
      conditionInput,
      now,
    );
    const { maxHp, maxMp } = this.getMaxResources(cultivator, condition);
    const statuses = pruneInactiveStatuses(condition.statuses, now);
    if (cultivator.combatV6ResourceAuthority?.recoveryPaused) return {...condition,statuses};
    const fateContext = evaluateFateContext(cultivator.pre_heaven_fates ?? []);
    const projection = projectNaturalRecoveryResources({
      conditionInput: condition,
      maxHp,
      maxMp,
      toxicityPenaltyMultiplier: fateContext.toxicityPenaltyMultiplier,
      naturalRecoveryMultiplier: fateContext.naturalRecoveryMultiplier,
      now,
    });

    if (!projection.timestampValid) {
      return {
        ...condition,
        statuses,
        timestamps: {
          ...condition.timestamps,
          lastRecoveryAt: now.toISOString(),
        },
      };
    }

    if (projection.elapsedMs <= 0) {
      return {
        ...condition,
        statuses,
      };
    }

    const nextHp = projection.resources.hp.current;
    const nextMp = projection.resources.mp.current;

    return {
      ...condition,
      resources: projection.resources,
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
    cultivator: ConditionCultivatorFacts,
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
          max: maxHp,
        },
        mp: {
          current: clamp(condition.resources.mp.current - mpLoss, 0, maxMp),
          max: maxMp,
        },
      },
      timestamps: {
        ...condition.timestamps,
        lastRecoveryAt: now.toISOString(),
      },
    };
  },

  previewExternalResourceLoss(
    cultivator: CultivatorDisplayInput,
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
    const rawHpLossValue =
      maxHp * (options.hpPercent ?? 0) + (options.hpFlat ?? 0);
    const rawMpLossValue =
      maxMp * (options.mpPercent ?? 0) + (options.mpFlat ?? 0);
    const hpLoss = Math.floor(rawHpLossValue);
    const mpLoss = Math.floor(rawMpLossValue);
    const rawHpLoss = Math.floor(rawHpLossValue);
    const rawMpLoss = Math.floor(rawMpLossValue);

    return {
      maxHp,
      maxMp,
      rawHpLoss,
      rawMpLoss,
      hpLoss,
      mpLoss,
      preventedHpLoss: 0,
      preventedMpLoss: 0,
      hpLossMultiplier: 1,
      mpLossMultiplier: 1,
      triggerTexts: [],
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

  getBreakthroughPenalty(
    cultivator: Pick<Cultivator, 'pre_heaven_fates'>,
    conditionInput: CultivatorCondition | undefined,
  ): number {
    return getBreakthroughPenalty(
      conditionInput,
      evaluateFateContext(cultivator.pre_heaven_fates ?? []).toxicityPenaltyMultiplier,
    );
  },

  breakthroughBodyCultivationRealm(
    cultivator: Pick<Cultivator, 'realm' | 'condition'>,
    conditionInput: CultivatorCondition | undefined,
  ): {
    condition: CultivatorCondition;
    fromRealm: BodyCultivationRealm;
    toRealm: BodyCultivationRealm;
  } {
    const condition = conditionInput ?? cultivator.condition;
    if (!condition) {
      throw new Error('角色状态尚未初始化，无法进行肉身破限');
    }
    const result = advanceBodyCultivationRealm(condition, {
      cultivatorRealm: cultivator.realm,
    });

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
    };
  },
};

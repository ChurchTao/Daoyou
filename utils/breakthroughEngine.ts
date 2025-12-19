import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '../types/constants';
import type {
  Attributes,
  BreakthroughHistoryEntry,
  Cultivator,
  RetreatRecord,
} from '../types/cultivator';
import {
  calculateFinalAttributes,
  getRealmStageAttributeCap,
} from './cultivatorUtils';

const REALM_ORDER = [...REALM_VALUES];
const STAGE_ORDER = [...REALM_STAGE_VALUES];
const ATTRIBUTE_KEYS: Array<keyof Attributes> = [
  'vitality',
  'spirit',
  'wisdom',
  'speed',
  'willpower',
];

const LIFESPAN_BONUS_BY_REALM: Partial<Record<RealmType, number>> = {
  筑基: 200,
  金丹: 500,
  元婴: 1200,
  化神: 2000,
  炼虚: 3000,
  合体: 4000,
  大乘: 5000,
  渡劫: 8000,
};

type BreakthroughAttemptType = 'minor' | 'major';

export interface BreakthroughModifiers {
  base: number;
  comprehension: number;
  years: number;
  failureStreak: number;
  summaryDifficulty: number;
}

export interface BreakthroughAttemptSummary {
  success: boolean;
  isMajor: boolean;
  yearsSpent: number;
  chance: number;
  roll: number;
  fromRealm: RealmType;
  fromStage: RealmStage;
  toRealm?: RealmType;
  toStage?: RealmStage;
  lifespanGained: number;
  attributeGrowth: Partial<Attributes>;
  lifespanDepleted: boolean;
  failureReason?: 'MAX_REALM';
  modifiers: BreakthroughModifiers;
}

export interface BreakthroughOutcome {
  cultivator: Cultivator;
  summary: BreakthroughAttemptSummary;
}

export interface RetreatOptions {
  years: number;
  rng?: () => number;
}

export interface BreakthroughChanceResult {
  chance: number;
  modifiers: BreakthroughModifiers;
  nextStage: { realm: RealmType; stage: RealmStage } | null;
}

export function calculateBreakthroughChance(
  cultivator: Cultivator,
  years: number,
): BreakthroughChanceResult {
  const fromRealm = cultivator.realm;
  const fromStage = cultivator.realm_stage;
  const nextStage = getNextStage(fromRealm, fromStage);
  const isMajor = nextStage ? nextStage.realm !== fromRealm : false;
  const attemptType: BreakthroughAttemptType = isMajor ? 'major' : 'minor';

  const finalAttributes = calculateFinalAttributes(cultivator);
  const modifiers: BreakthroughModifiers = {
    // 基础成功率
    base: nextStage ? getBreakthroughBaseChance(fromRealm, attemptType) : 0,
    // 悟性修正
    comprehension: getComprehensionModifier(finalAttributes.final.wisdom),
    // 闭关年限修正
    years: getRetreatYearModifier(years),
    // 失败连败修正
    failureStreak: getFailureStreakModifier(
      cultivator.closed_door_years_total || 0,
    ),
    // 突破难度修正
    summaryDifficulty: getBreakthroughSummaryDifficulty(fromRealm),
  };

  const chance = nextStage
    ? modifiers.summaryDifficulty *
      (modifiers.base +
        modifiers.comprehension +
        modifiers.years +
        modifiers.failureStreak)
    : 0;

  return { chance, modifiers, nextStage };
}

export function performRetreatBreakthrough(
  rawCultivator: Cultivator,
  options: RetreatOptions,
): BreakthroughOutcome {
  if (options.years <= 0) {
    throw new Error('闭关年限必须大于0');
  }

  const rng = options.rng ?? Math.random;
  const years = Math.floor(options.years);

  const { chance, modifiers, nextStage } = calculateBreakthroughChance(
    rawCultivator,
    years,
  );

  const fromRealm = rawCultivator.realm;
  const fromStage = rawCultivator.realm_stage;
  const isMajor = nextStage ? nextStage.realm !== fromRealm : false;

  const roll = rng();
  const success = nextStage ? roll <= chance : false;

  const updatedCultivator: Cultivator = {
    ...rawCultivator,
    attributes: { ...rawCultivator.attributes },
    retreat_records: [...(rawCultivator.retreat_records ?? [])],
    breakthrough_history: [...(rawCultivator.breakthrough_history ?? [])],
  };
  updatedCultivator.age = rawCultivator.age + years;
  // 如果突破成功，则重置闭关年限，否则累加闭关年限
  updatedCultivator.closed_door_years_total = Math.floor(
    (rawCultivator.closed_door_years_total ?? 0) + years,
  );
  if (success) {
    updatedCultivator.closed_door_years_total = 0;
  }

  let lifespanGained = 0;
  const attributeGrowth: Partial<Attributes> = {};

  if (success && nextStage) {
    const cap = getRealmStageAttributeCap(nextStage.realm, nextStage.stage);
    const growthRange = getAttributeGrowthRange(
      rawCultivator.attributes.wisdom,
      { realm: fromRealm, stage: fromStage },
      nextStage,
      isMajor,
    );
    const { attributes: grownAttributes, growth } = applyAttributeGrowth(
      updatedCultivator.attributes,
      cap,
      growthRange,
      isMajor,
      rng,
    );
    updatedCultivator.attributes = grownAttributes;
    Object.assign(attributeGrowth, growth);

    updatedCultivator.realm = nextStage.realm;
    updatedCultivator.realm_stage = nextStage.stage;

    if (nextStage.realm !== fromRealm) {
      lifespanGained = LIFESPAN_BONUS_BY_REALM[nextStage.realm] ?? 0;
      updatedCultivator.lifespan = rawCultivator.lifespan + lifespanGained;
    }

    const historyEntry: BreakthroughHistoryEntry = {
      from_realm: fromRealm,
      from_stage: fromStage,
      to_realm: nextStage.realm,
      to_stage: nextStage.stage,
      age: updatedCultivator.age,
      years_spent: years,
    };
    updatedCultivator.breakthrough_history =
      updatedCultivator.breakthrough_history ?? [];
    updatedCultivator.breakthrough_history.push(historyEntry);
  }

  const retreatRecord: RetreatRecord = {
    realm: fromRealm,
    realm_stage: fromStage,
    years,
    success,
    chance,
    roll,
    timestamp: new Date().toISOString(),
    modifiers,
  };
  updatedCultivator.retreat_records?.push(retreatRecord);

  const lifespanDepleted =
    !success && updatedCultivator.age >= updatedCultivator.lifespan;

  return {
    cultivator: updatedCultivator,
    summary: {
      success,
      isMajor,
      yearsSpent: years,
      chance,
      roll,
      fromRealm,
      fromStage,
      toRealm: success && nextStage ? nextStage.realm : undefined,
      toStage: success && nextStage ? nextStage.stage : undefined,
      lifespanGained,
      attributeGrowth,
      lifespanDepleted,
      failureReason: nextStage ? undefined : 'MAX_REALM',
      modifiers,
    },
  };
}

export function getNextStage(
  realm: RealmType,
  stage: RealmStage,
): { realm: RealmType; stage: RealmStage } | null {
  const stageIndex = STAGE_ORDER.indexOf(stage);
  if (stageIndex === -1) return null;
  if (stageIndex < STAGE_ORDER.length - 1) {
    return { realm, stage: STAGE_ORDER[stageIndex + 1] };
  }
  const realmIndex = REALM_ORDER.indexOf(realm);
  if (realmIndex === -1 || realmIndex >= REALM_ORDER.length - 1) {
    return null;
  }
  return { realm: REALM_ORDER[realmIndex + 1], stage: STAGE_ORDER[0] };
}

function getBreakthroughBaseChance(
  realm: RealmType,
  type: BreakthroughAttemptType,
): number {
  const base = type === 'minor' ? 0.7 : 0.4;
  const difficulty = getBreakthroughDifficulty(realm);
  return base * difficulty;
}

function getBreakthroughDifficulty(realm: RealmType): number {
  const realmIndex = REALM_ORDER.indexOf(realm);
  return Math.pow(0.6, realmIndex);
}

function getBreakthroughSummaryDifficulty(realm: RealmType): number {
  const realmIndex = REALM_ORDER.indexOf(realm);
  return Math.pow(0.9, realmIndex);
}

function getComprehensionModifier(wisdom: number): number {
  // 悟性越高，修正倍率越高，最高不超过0.18
  return Math.min(0.18, Math.max((wisdom - 50) / 1000, 0));
}

function getRetreatYearModifier(years: number): number {
  if (years <= 0) return 0;
  const scaled = years / 1000;
  return Math.min(0.3, scaled);
}

function getFailureStreakModifier(closedDoorYearsTotal: number): number {
  const scaled = closedDoorYearsTotal / 2000;
  return Math.min(0.15, scaled);
}

/**
 * 获取属性增长范围
 * @param wisdom 悟性
 * @param fromStage 当前境界
 * @param nextStage 下一境界
 * @param isMajor 是否大境界突破
 * @returns 属性增长范围
 */
function getAttributeGrowthRange(
  wisdom: number,
  fromStage: { realm: RealmType; stage: RealmStage },
  nextStage: { realm: RealmType; stage: RealmStage },
  isMajor: boolean,
): { min: number; max: number } {
  const fromCap = getRealmStageAttributeCap(fromStage.realm, fromStage.stage);
  const nextCap = getRealmStageAttributeCap(nextStage.realm, nextStage.stage);
  const capDiff = nextCap - fromCap;
  const wisdomModifier = getComprehensionModifier(wisdom);
  const min = Math.round(capDiff * (0.7 + wisdomModifier));
  const max = Math.round(capDiff * (0.8 + wisdomModifier));
  const majorMin = Math.round(capDiff * (0.8 + wisdomModifier));
  const majorMax = Math.round(capDiff * (0.9 + wisdomModifier));
  return isMajor ? { min: majorMin, max: majorMax } : { min, max };
}

function applyAttributeGrowth(
  attributes: Attributes,
  cap: number,
  range: { min: number; max: number },
  isMajor: boolean,
  rng: () => number,
): { attributes: Attributes; growth: Partial<Attributes> } {
  const updated = { ...attributes };
  const growth: Partial<Attributes> = {};
  ATTRIBUTE_KEYS.forEach((key) => {
    if (key === 'wisdom' && !isMajor) {
      // 只有大境界突破才可能提升悟性
      growth[key] = 0;
      return;
    }
    const delta = randomInt(range.min, range.max, rng);
    const current = Math.min(updated[key], cap);
    if (current !== updated[key]) {
      updated[key] = current;
    }
    const boosted = Math.min(current + delta, cap);
    growth[key] = boosted - current;
    updated[key] = boosted;
  });
  return { attributes: updated, growth };
}

function randomInt(min: number, max: number, rng: () => number): number {
  if (max <= min) return min;
  return Math.floor(rng() * (max - min + 1)) + min;
}

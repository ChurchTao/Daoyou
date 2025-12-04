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
import { getRealmStageAttributeCap } from './cultivatorUtils';

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

export function performRetreatBreakthrough(
  rawCultivator: Cultivator,
  options: RetreatOptions,
): BreakthroughOutcome {
  if (options.years <= 0) {
    throw new Error('闭关年限必须大于0');
  }

  const rng = options.rng ?? Math.random;
  const years = Math.floor(options.years);
  const fromRealm = rawCultivator.realm;
  const fromStage = rawCultivator.realm_stage;
  const nextStage = getNextStage(fromRealm, fromStage);
  const isMajor = nextStage ? nextStage.realm !== fromRealm : false;
  const attemptType: BreakthroughAttemptType = isMajor ? 'major' : 'minor';

  const failureStreakBonus = getFailureStreakModifier(
    rawCultivator.retreat_records,
    fromRealm,
    fromStage,
  );
  const modifiers: BreakthroughModifiers = {
    // 基础成功率
    base: nextStage ? getBreakthroughBaseChance(fromRealm, attemptType) : 0,
    // 悟性修正
    comprehension: getComprehensionModifier(rawCultivator.attributes.wisdom),
    // 闭关年限修正
    years: getRetreatYearModifier(years),
    // 失败连败修正
    failureStreak: failureStreakBonus,
  };

  const chance = nextStage
    ? clampChance(
        fromRealm,
        attemptType,
        modifiers.base +
          modifiers.comprehension +
          modifiers.years +
          modifiers.failureStreak,
      )
    : 0;
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
  updatedCultivator.closed_door_years_total = success
    ? 0
    : (rawCultivator.closed_door_years_total ?? 0) + years;

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
  const realmIndex = REALM_ORDER.indexOf(realm);
  const base = type === 'minor' ? 0.7 : 0.4;
  const difficulty = Math.pow(0.82, realmIndex);
  return base * difficulty;
}

function clampChance(
  realm: RealmType,
  type: BreakthroughAttemptType,
  value: number,
): number {
  const realmIndex = REALM_ORDER.indexOf(realm);
  const maxBase = type === 'minor' ? 0.9 : 0.55;
  const minBase = type === 'minor' ? 0.15 : 0.05;
  const maxDecay = Math.pow(0.9, realmIndex);
  const minDecay = Math.pow(0.95, realmIndex);
  const max =
    type === 'major' && realm === '渡劫'
      ? 0.3
      : Math.max(0.08, maxBase * maxDecay);
  const min = Math.max(0.02, minBase * minDecay);
  return clamp(value, min, max);
}

function getComprehensionModifier(wisdom: number): number {
  // 悟性越高，修正倍率越高，最高不超过0.18
  return Math.min(0.18, Math.max((wisdom - 50) / 1000, 0));
}

function getRetreatYearModifier(years: number): number {
  if (years <= 0) return 0;
  const scaled = Math.log1p(years / 3) / 6;
  return Math.min(0.25, scaled);
}

function getFailureStreakModifier(
  records: RetreatRecord[] | undefined,
  realm: RealmType,
  stage: RealmStage,
): number {
  if (!records?.length) return 0;
  let bonus = 0;
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const record = records[i];
    if (record.realm !== realm || record.realm_stage !== stage) break;
    if (record.success) break;
    const years = record.years;
    // 每次闭关年限越长，修正倍率呈对数增长，最终修正为倍率% * 0.05，最大不超过0.05
    bonus += Math.min(0.05, (Math.log1p(years) / 10) * 0.05);
    // 累计修正不超过0.15
    if (bonus >= 0.15) break;
  }
  return bonus;
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
  const min = capDiff * Math.min(1, 0.3 + wisdomModifier);
  const max = capDiff * Math.min(1, 0.7 + wisdomModifier);
  const majorMin = min * Math.min(1, 0.5 + wisdomModifier);
  const majorMax = max * Math.min(1, 0.8 + wisdomModifier);
  return isMajor ? { min: majorMin, max: majorMax } : { min, max };
}

function applyAttributeGrowth(
  attributes: Attributes,
  cap: number,
  range: { min: number; max: number },
  rng: () => number,
): { attributes: Attributes; growth: Partial<Attributes> } {
  const updated = { ...attributes };
  const growth: Partial<Attributes> = {};
  ATTRIBUTE_KEYS.forEach((key) => {
    if (key === 'wisdom') {
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

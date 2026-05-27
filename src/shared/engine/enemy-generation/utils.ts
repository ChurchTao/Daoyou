import { ELEMENT_NAME_PREFIX } from '@shared/engine/creation-v2/config/CreationMappings';
import { CREATION_RESERVED_ENERGY } from '@shared/engine/creation-v2/config/CreationBalance';
import type { ElementType, EnemyRace, RealmStage, RealmType } from '@shared/types/constants';
import {
  ATTRIBUTE_KEYS,
  type DifficultyBand,
  type EnemyProductRole,
} from './types';

export function hashText(input: string): number {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function pickBySeed<T>(pool: readonly T[], seed: string): T {
  return pool[hashText(seed) % pool.length];
}

export function rotateBySeed<T>(
  pool: readonly T[],
  seed: string,
  count: number,
): T[] {
  if (pool.length === 0 || count <= 0) return [];
  const offset = hashText(seed) % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.slice(0, Math.min(count, rotated.length));
}

export function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildDifficultyFactor(difficulty: number): number {
  return 0.5 + (difficulty / 100) * 3.5;
}

export function difficultyToBand(
  difficulty: number,
  isBoss: boolean,
): DifficultyBand {
  if (isBoss || difficulty >= 85) return 'legendary';
  if (difficulty >= 60) return 'advanced';
  if (difficulty >= 25) return 'variant';
  return 'core';
}

export function sumAttributeWeights(
  weights: Record<(typeof ATTRIBUTE_KEYS)[number], number>,
): number {
  return ATTRIBUTE_KEYS.reduce((sum, key) => sum + weights[key], 0);
}

export function buildRaceFallbackName(
  race: EnemyRace,
  realm: RealmType,
  realmStage: RealmStage,
  element: ElementType,
): string {
  const suffixByRace: Record<EnemyRace, string> = {
    人族: '散修',
    妖族: '妖修',
    鬼魂: '幽魂',
    魔族: '魔修',
    古兽: '古兽',
    灵族: '灵使',
  };

  return `${ELEMENT_NAME_PREFIX[element]}${realm}${realmStage}${suffixByRace[race]}`;
}

export function buildBackgroundFallback(
  race: EnemyRace,
  realm: RealmType,
  realmStage: RealmStage,
  primaryElement: ElementType,
  profileTags: string[],
): string {
  return `${race}出身的${realm}${realmStage}敌对单位，以${primaryElement}行灵力为核心，战斗风格偏向${profileTags.join('、')}。`;
}

export function buildDescriptionFallback(
  race: EnemyRace,
  realm: RealmType,
  realmStage: RealmStage,
  primaryElement: ElementType,
): string {
  return `一名${realm}${realmStage}的${race}强敌，周身缠绕着${primaryElement}行气息。`;
}

export function buildVariantKey(input: {
  race: EnemyRace;
  realm: RealmType;
  realmStage: RealmStage;
  difficulty: number;
  isBoss: boolean;
}): string {
  return [
    input.race,
    input.realm,
    input.realmStage,
    String(input.difficulty),
    input.isBoss ? 'boss' : 'normal',
  ].join(':');
}

export function buildStableProductId(
  variantKey: string,
  productType: 'gongfa' | 'skill' | 'artifact',
  role: EnemyProductRole,
  index: number,
  slot?: 'weapon' | 'armor' | 'accessory',
): string {
  if (productType === 'artifact') {
    return `enemy:${variantKey}:artifact:${slot ?? role}:${index}`;
  }
  return `enemy:${variantKey}:${productType}:${index}`;
}

export function buildStableSlugSeed(
  variantKey: string,
  productType: 'gongfa' | 'skill' | 'artifact',
  role: EnemyProductRole,
  index: number,
): string {
  return `${variantKey}:${productType}:${role}:${index}`;
}

export function resolveEnergyBudget(
  difficulty: number,
  productType: 'skill' | 'gongfa' | 'artifact',
  bias: number = 0,
  isBoss: boolean = false,
): number {
  const baseByType = {
    skill: 14,
    gongfa: 12,
    artifact: 12,
  } as const;
  const scaleByType = {
    skill: 0.48,
    gongfa: 0.42,
    artifact: 0.46,
  } as const;

  const minByType = CREATION_RESERVED_ENERGY[productType] + 10;

  return Math.max(
    minByType,
    Math.round(
      baseByType[productType] +
        difficulty * scaleByType[productType] +
        bias +
        (isBoss ? 8 : 0),
    ),
  );
}

export function resolveUnlockScore(
  difficulty: number,
  bias: number = 0,
  isBoss: boolean = false,
): number {
  return Math.max(
    0,
    Math.round(10 + difficulty * 0.82 + bias + (isBoss ? 12 : 0)),
  );
}

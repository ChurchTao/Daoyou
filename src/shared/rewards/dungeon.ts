import {
  DUNGEON_EXP_BUDGET,
  REALM_DAILY_EXP_BUDGET,
} from '../config/cultivationExpGain';
import { getLevelRealmStage } from '../config/realmProgression';
import { rollDrops, type DropPool } from '../drops';
import { SeededRng } from '../engine/combat-v6/core';
import {
  equipmentRealm,
  OPEN_EQUIPMENT_LEVELS,
} from '../engine/combat-v6/equipment/realm';
import type { ItemGrant } from '../inventory';
import { itemDefinition } from '../inventory';
import { BLUEPRINTS } from '../items/definitions/equipment-blueprints';
import { materialFactsOf } from '../items/material';
import { calculateCultivationExpByDailyBudget } from '../lib/cultivationExpGain';
import {
  getDungeonRewardBonus,
  type DungeonDifficultyTier,
} from '../lib/game/mapSystem';
import type { RealmType } from '../types/constants';
import { REALM_YIELD_RATES } from '../types/constants';
import { DUNGEON_REWARD_PACK } from './dungeon-pack';

export type DungeonRewardSource = 'exploration' | 'battle' | 'completion';
export interface DungeonRewardEntry {
  key: string;
  items: ItemGrant[];
  experience: number;
  spiritStones: number;
  beastExperience?: { beastId: string; amount: number };
}
export const DUNGEON_REWARD_CONFIG = DUNGEON_REWARD_PACK.sources;

export interface DungeonRewardPlan {
  key: string;
  items: ItemGrant[];
  materialCount: number;
  materialRealm: RealmType;
  materialSeed: string;
}

export interface DungeonRewardResourceContext {
  mapRealm: RealmType;
  playerRealm: RealmType;
  dangerScore: number;
  difficultyTier: DungeonDifficultyTier;
}

/** Each step uses the old settlement economy; completion currency comes from the rating settlement. */
export function planDungeonStepResources(
  seed: number,
  key: string,
  source: DungeonRewardSource,
  context: DungeonRewardResourceContext,
  pack = DUNGEON_REWARD_PACK,
): Pick<DungeonRewardEntry, 'experience' | 'spiritStones'> {
  const config = pack.sources[source];
  if (source === 'completion') return { experience: 0, spiritStones: 0 };
  const dangerBonus = Math.min(Math.max(context.dangerScore, 0), 100) / 200;
  const rewardBonus = getDungeonRewardBonus(context.difficultyTier);
  const experience = Math.floor(
    calculateCultivationExpByDailyBudget({
      dailyBudget: REALM_DAILY_EXP_BUDGET[context.playerRealm],
      sourceDailyFraction: config.dailyExpFraction,
      sourceMultiplier: 1 + dangerBonus * DUNGEON_EXP_BUDGET.dangerBonusScale,
      minBaseExp: DUNGEON_EXP_BUDGET.minBaseExp,
    }).baseExp * rewardBonus,
  );
  let stream = seed >>> 0;
  for (const character of `${key}:dungeon.${source}.resources:1`)
    stream = Math.imul(stream ^ character.charCodeAt(0), 16777619) >>> 0;
  const rng = new SeededRng(stream);
  const baseStones = Math.floor(
    REALM_YIELD_RATES[context.mapRealm] *
      config.stoneHours *
      (0.8 + rng.next() * 1.2),
  );
  const spiritStones = Math.floor(
    baseStones * (1 + dangerBonus * 0.35) * rewardBonus,
  );
  return { experience, spiritStones };
}

export function dungeonRewardItemName(item: ItemGrant): string {
  const definition = itemDefinition(item.definitionId);
  return definition.kind === 'material'
    ? materialFactsOf(item.instanceData).name
    : definition.name;
}

/** Caller supplies a persisted seed for this run; neither AI score nor client input affects rewards. */
export function planDungeonReward(
  seed: number,
  key: string,
  source: DungeonRewardSource,
  level: number,
  pack = DUNGEON_REWARD_PACK,
): DungeonRewardPlan {
  if (!Number.isInteger(level) || level < 1 || level > 180)
    throw new Error('Invalid dungeon reward level');
  const config = pack.sources[source];
  // Preserve the original occurrence stream, independently of item pool revisions.
  const random = (identity: string) => {
    let stream = seed >>> 0;
    for (const character of identity)
      stream = Math.imul(stream ^ character.charCodeAt(0), 16777619) >>> 0;
    const rng = new SeededRng(stream);
    return () => rng.next();
  };
  const budget = rollDrops(
    {
      id: `dungeon.${source}.budget`,
      version: 1,
      groups: [
        {
          id: 'budget',
          chance: config.chance,
          entries: [
            {
              rewardId: 'item-slot',
              weight: 1,
              quantity: { min: config.quantity, max: config.quantity },
            },
          ],
        },
      ],
    },
    () => random(key),
  );
  const items: ItemGrant[] = [];
  let materialCount = 0;
  const count = budget.rewards[0]?.quantity ?? 0;
  const levels = OPEN_EQUIPMENT_LEVELS.filter(
    (value) => equipmentRealm(value).requiredLevel <= level,
  );
  const blueprintLevel = levels[levels.length - 1] ?? OPEN_EQUIPMENT_LEVELS[0];
  const blueprints = BLUEPRINTS.filter((item) => item.level === blueprintLevel);
  const weightedEntries = (
    entries: { rewardId: string; weight: number }[],
    categoryWeight: number,
  ) => {
    if (categoryWeight === 0) return [];
    const total = entries.reduce((sum, item) => sum + item.weight, 0);
    return entries.map((item) => ({
      rewardId: item.rewardId,
      weight: (categoryWeight * item.weight) / total,
      quantity: { min: 1, max: 1 },
    }));
  };
  if (count > 0) {
    const pool: DropPool = {
      id: `dungeon.${source}.items`,
      version: pack.poolVersion,
      groups: [
        {
          id: 'item',
          chance: 1,
          entries: [
            ...weightedEntries(
              [{ rewardId: 'dungeon.material', weight: 1 }],
              config.weights.material,
            ),
            ...weightedEntries(
              blueprints.map((item) => ({ rewardId: item.id, weight: 1 })),
              config.weights.blueprint,
            ),
            ...weightedEntries(pack.books, config.weights.book),
          ],
        },
      ],
    };
    for (let slot = 0; slot < count; slot++) {
      const reward = rollDrops(pool, (group) =>
        random(`${key}:${pool.id}:${pool.version}:${slot}:${group}`),
      ).rewards[0];
      if (reward.rewardId === 'dungeon.material') {
        materialCount++;
        continue;
      }
      const existing = items.find(
        (item) => item.definitionId === reward.rewardId,
      );
      if (existing) existing.quantity++;
      else items.push({ definitionId: reward.rewardId, quantity: 1 });
    }
  }
  // One mutually exclusive bonus item, independent of the original reward streams.
  const bonus = config.bonusChances;
  const bonusChance = Object.values(bonus).reduce(
    (sum, value) => sum + value,
    0,
  );
  if (bonusChance > 0) {
    const pool: DropPool = {
      id: `dungeon.${source}.bonus`,
      version: pack.bonusPoolVersion,
      groups: [
        {
          id: 'bonus',
          chance: bonusChance,
          entries: [
            ...weightedEntries(
              [{ rewardId: 'beast.refinement.origin-dew', weight: 1 }],
              bonus.originDew,
            ),
            ...weightedEntries(
              [{ rewardId: 'beast.refinement.superior-origin-dew', weight: 1 }],
              bonus.superiorOriginDew,
            ),
            ...weightedEntries(
              pack.superiorBooks.map((rewardId) => ({ rewardId, weight: 1 })),
              bonus.superiorBook,
            ),
            ...weightedEntries(
              blueprints.map((item) => ({ rewardId: item.id, weight: 1 })),
              bonus.blueprint,
            ),
          ],
        },
      ],
    };
    for (const reward of rollDrops(pool, (group) =>
      random(`${key}:${pool.id}:${pool.version}:${group}`),
    ).rewards) {
      const existing = items.find(
        (item) => item.definitionId === reward.rewardId,
      );
      if (existing) existing.quantity++;
      else items.push({ definitionId: reward.rewardId, quantity: 1 });
    }
  }
  return {
    key,
    items,
    materialCount,
    materialRealm: getLevelRealmStage(level).realm,
    materialSeed: `${seed}:${key}:dungeon.${source}:${pack.poolVersion}:material`,
  };
}
export function appendDungeonReward(
  entries: DungeonRewardEntry[],
  entry: DungeonRewardEntry,
) {
  return entries.some((existing) => existing.key === entry.key)
    ? entries
    : [...entries, entry];
}

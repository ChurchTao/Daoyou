import {
  BEAST_CARRIED_CAPACITY,
  createBeastAllocationSchema,
  type BeastLineup,
  type SummonedBeast,
} from '@daoyou/game-domain/beasts';
import { z } from 'zod';
export const BeastAllocationSchema = createBeastAllocationSchema(
  BEAST_PROGRESSION.pointsPerLevel,
);

import type { BattleEvent } from '@daoyou/combat-core/types';

import { SkillTag, TargetMode, TargetSide } from '@daoyou/combat-core/enums';

import { type BattleState, type SkillDef } from '@daoyou/combat-core/types';

import { isStanding } from '@daoyou/combat-core/units';

import { BEAST_PROGRESSION, BEAST_SPECIES } from '@daoyou/game-content/beasts';

import { beastPointBudget } from './identity.js';

import { BeastSchema } from './schema.js';

export { generateCapturedBeast } from './generator.js';

export const BEAST_BAG_CAPACITY = BEAST_CARRIED_CAPACITY;

export const BEAST_WAREHOUSE_CAPACITY = 50;

export const BEAST_BAG_FULL_CAPTURE_MESSAGE =
  '灵兽袋已满，请先空出空间，再继续捕捉。';

export const CAPTURE_SKILL_ID = 'beast.capture';

export function carriedBeastIds(
  beasts: readonly { id: string }[],
  lineup: Pick<BeastLineup, 'carriedBeastIds'>,
) {
  const owned = new Set(beasts.map((beast) => beast.id));
  return lineup.carriedBeastIds.filter((id) => owned.has(id));
}

export function warehouseBeastCount(
  beasts: readonly { id: string }[],
  lineup: Pick<BeastLineup, 'carriedBeastIds'>,
) {
  return beasts.length - carriedBeastIds(beasts, lineup).length;
}

/**
 * Settlement keeps every capture. Remaining bag slots join the lineup;
 * the rest stay out of it so a full bag cannot roll the battle back.
 */
export function splitCapturedBeasts(
  carriedCount: number,
  capturedIds: readonly string[],
) {
  const room = Math.max(0, BEAST_BAG_CAPACITY - carriedCount);
  return {
    bagIds: capturedIds.slice(0, room),
    warehouseIds: capturedIds.slice(room),
  };
}

/** Newly received beasts prefer the bag. Fusion frees the removed parents first. */
export function receivedBeastPlacement(
  beasts: readonly { id: string }[],
  lineup: Pick<BeastLineup, 'carriedBeastIds'>,
  removedIds: readonly string[] = [],
): 'bag' | 'warehouse' | null {
  const removed = new Set(removedIds);
  const remaining = beasts.filter((beast) => !removed.has(beast.id));
  const carried = carriedBeastIds(remaining, {
    carriedBeastIds: lineup.carriedBeastIds.filter((id) => !removed.has(id)),
  });
  if (carried.length < BEAST_BAG_CAPACITY) return 'bag';
  if (remaining.length - carried.length < BEAST_WAREHOUSE_CAPACITY)
    return 'warehouse';
  return null;
}

export const BEAST_ATTRIBUTE_NAMES = {
  constitution: '体质',
  strength: '力量',
  magic: '魔力',
  endurance: '耐力',
  agility: '敏捷',
} as const;

export function captureMp(carryLevel: number) {
  return (
    BEAST_PROGRESSION.capture.mpBase +
    carryLevel * BEAST_PROGRESSION.capture.mpPerCarryLevel
  );
}

export function nextBeastExp(level: number) {
  return (
    BEAST_PROGRESSION.experience.base +
    BEAST_PROGRESSION.experience.perLevel * level +
    Math.floor(BEAST_PROGRESSION.experience.perLevelSquared * level ** 2)
  );
}

export function beastRestCost(beast: SummonedBeast) {
  return Math.ceil(
    (beast.maxLifespan - beast.currentLifespan) /
      BEAST_PROGRESSION.lifespan.restRecoveryPerStone,
  );
}

export function gainBeastExp(
  beast: SummonedBeast,
  amount: number,
  ownerLevel: number,
): SummonedBeast {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !Number.isInteger(ownerLevel) ||
    ownerLevel < 0
  )
    throw new Error('灵兽修为输入无效');
  const cap = Math.min(180, ownerLevel);
  if (!amount || beast.level >= cap) return beast;
  let level = beast.level;
  let exp = beast.exp + amount;
  while (level < cap && exp >= nextBeastExp(level)) {
    exp -= nextBeastExp(level);
    level++;
  }
  return BeastSchema.parse({
    ...beast,
    level,
    exp: level === cap ? 0 : exp,
    unallocatedPoints:
      beast.unallocatedPoints +
      beastPointBudget({ ...beast, level }) -
      beastPointBudget(beast),
    revision: beast.revision + 1,
  });
}

export function allocateBeast(
  beast: SummonedBeast,
  input: z.infer<typeof BeastAllocationSchema>,
  ownerLevel: number,
): SummonedBeast {
  const points = BeastAllocationSchema.parse(input);
  const total = Object.values(points).reduce((a, b) => a + b, 0);
  if (beast.level > ownerLevel || total <= 0 || total > beast.unallocatedPoints)
    throw new Error('等级或可分配点数不足');
  return BeastSchema.parse({
    ...beast,
    allocatedAttributes: Object.fromEntries(
      Object.entries(points).map(([k, v]) => [
        k,
        beast.allocatedAttributes[k as keyof typeof points] + v,
      ]),
    ),
    unallocatedPoints: beast.unallocatedPoints - total,
    revision: beast.revision + 1,
  });
}

export function captureSkill(
  targets: Array<{ unitId: string; speciesId: string }>,
  ownerLevel: number,
  bagCount: number,
): SkillDef {
  const chance = BEAST_PROGRESSION.capture;
  return {
    id: CAPTURE_SKILL_ID,
    name: '捕捉',
    tags: [SkillTag.Spell],
    targeting: { side: TargetSide.Enemy, mode: TargetMode.Fill, count: 1 },
    effects: [],
    capture: {
      capacity: Math.max(0, BEAST_BAG_CAPACITY - bagCount),
      targetMpCosts: Object.fromEntries(
        targets.flatMap((target) => {
          const species = BEAST_SPECIES.find((s) => s.id === target.speciesId);
          return species && species.carryLevel <= ownerLevel
            ? [[target.unitId, captureMp(species.carryLevel)]]
            : [];
        }),
      ),
      chance: `min(${chance.maxChance}, max(${chance.minChance}, ${chance.baseChance} + ${chance.missingHpFactor} * (1 - target.hp / target.maxHp) + ${chance.levelDifferenceFactor} * (source.level - target.level)))`,
    },
  };
}

export function beastVictoryExperience(
  state: BattleState,
  ownerId: string,
): { beastId: string; amount: number } | undefined {
  const owner = state.units.find((u) => u.id === ownerId);
  if (!owner || state.result?.winner !== owner.side) return;
  const pet = state.units.find(
    (u) => u.ownerId === ownerId && u.kind === 'pet' && isStanding(u),
  );
  if (!pet?.id.startsWith('beast:')) return;
  const amount = state.units
    .filter((u) => u.side !== owner.side && u.kind === 'npc' && u.flags.dead)
    .reduce(
      (sum, u) =>
        sum + BEAST_PROGRESSION.experience.victoryPerEnemyLevel * u.level,
      0,
    );
  return amount ? { beastId: pet.id.slice(6), amount } : undefined;
}

export function beastDeathIds(events: readonly BattleEvent[]): string[] {
  return [
    ...new Set(
      events.flatMap((event) =>
        event.type === 'unitDead' && event.unitId.startsWith('beast:')
          ? [event.unitId.slice(6)]
          : [],
      ),
    ),
  ];
}

export function loseBeastLifespan(beast: SummonedBeast): SummonedBeast {
  return {
    ...beast,
    currentLifespan: Math.max(
      0,
      beast.currentLifespan - BEAST_PROGRESSION.lifespan.deathLoss,
    ),
    revision: beast.revision + 1,
  };
}

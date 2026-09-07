import { z } from 'zod';
import {
  SeededRng,
  SkillTag,
  TargetMode,
  TargetSide,
  type BattleState,
  type SkillDef,
} from '../core';
import { isStanding } from '../core/units';
import {
  BEAST_SPECIES,
  BeastSchema,
  generateStarterBeast,
  type SummonedBeast,
} from './index';

export const BEAST_CAPACITY = 24;
export const CAPTURE_SKILL_ID = 'beast.capture';
export const BEAST_ATTRIBUTE_NAMES = {
  constitution: '体质',
  strength: '力量',
  magic: '法力',
  endurance: '耐力',
  agility: '敏捷',
} as const;
export const BeastAllocationSchema = z
  .object({
    constitution: z.number().int().min(0).max(900),
    strength: z.number().int().min(0).max(900),
    magic: z.number().int().min(0).max(900),
    endurance: z.number().int().min(0).max(900),
    agility: z.number().int().min(0).max(900),
  })
  .strict();
export function captureMp(carryLevel: number) {
  return 10 + carryLevel;
}
export function nextBeastExp(level: number) {
  return 100 + 20 * level;
}
export function beastRestCost(beast: SummonedBeast) {
  return Math.ceil((beast.maxLifespan - beast.currentLifespan) / 10);
}

export function generateCapturedBeast(
  id: string,
  ownerId: string,
  speciesId: string,
  level: number,
  seed: number,
): SummonedBeast {
  const base = generateStarterBeast(id, ownerId, speciesId, seed);
  const species = BEAST_SPECIES.find((s) => s.id === speciesId)!;
  const skills: string[] = [species.skill];
  if (new SeededRng(seed ^ 0x5bd1e995).chance(0.2)) skills.push('beast.combo');
  return BeastSchema.parse({
    ...base,
    level,
    allocatedAttributes: {
      ...base.allocatedAttributes,
      [species.allocation]: level * 5,
    },
    skills,
    skillSlotCapacity: skills.length,
    generationVersion: 'summoned_beast_capture_v1',
  });
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
    throw new Error('灵兽经验输入无效');
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
    unallocatedPoints: beast.unallocatedPoints + (level - beast.level) * 5,
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
  ownedCount: number,
): SkillDef {
  return {
    id: CAPTURE_SKILL_ID,
    name: '捕捉',
    tags: [SkillTag.Spell],
    targeting: { side: TargetSide.Enemy, mode: TargetMode.Fill, count: 1 },
    effects: [],
    capture: {
      capacity: Math.max(0, BEAST_CAPACITY - ownedCount),
      targetMpCosts: Object.fromEntries(
        targets.flatMap((target) => {
          const species = BEAST_SPECIES.find((s) => s.id === target.speciesId);
          return species && species.carryLevel <= ownerLevel
            ? [[target.unitId, captureMp(species.carryLevel)]]
            : [];
        }),
      ),
      chance:
        'min(0.85, max(0.1, 0.35 + 0.4 * (1 - target.hp / target.maxHp) + 0.01 * (source.level - target.level)))',
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
    .reduce((sum, u) => sum + 10 * u.level, 0);
  return amount ? { beastId: pet.id.slice(6), amount } : undefined;
}

import { z } from 'zod';
import {
  DamageKind,
  EffectType,
  FormulaFamily,
  HookAim,
  HookName,
  SeededRng,
  SkillTag,
  TargetSide,
  UnitKind,
  type BattleEvent,
  type LineupUnit,
  type Side,
  type SkillDef,
} from '../core';
import { DEFAULT_ATTRS } from '../core/units';

export const BEAST_VERSION = 'summoned_beast_v1';
const points = z.number().int().min(0).max(100000);
export const BeastSchema = z
  .object({
    id: z.uuid(),
    ownerCultivatorId: z.uuid(),
    speciesId: z.string(),
    name: z.string().min(1).max(40),
    level: z.number().int().min(0).max(180),
    exp: points,
    growth: z.number().min(0.1).max(3),
    aptitudes: z
      .object({
        attack: points,
        defense: points,
        health: points,
        mana: points,
        speed: points,
      })
      .strict(),
    allocatedAttributes: z
      .object({
        constitution: points,
        strength: points,
        magic: points,
        endurance: points,
        agility: points,
      })
      .strict(),
    unallocatedPoints: points,
    skillSlotCapacity: z.number().int().min(0).max(8),
    skills: z.array(z.string()).max(8),
    currentLifespan: points,
    maxLifespan: points,
    generationVersion: z.literal(BEAST_VERSION),
    generationSeed: z.number().int(),
    revision: points,
  })
  .strict()
  .superRefine((beast, ctx) => {
    if (
      !BEAST_SPECIES.some((s) => s.id === beast.speciesId) ||
      beast.skills.length !== beast.skillSlotCapacity ||
      new Set(beast.skills).size !== beast.skills.length ||
      beast.skills.some((id) => !BEAST_SKILLS.some((s) => s.id === id)) ||
      beast.currentLifespan > beast.maxLifespan ||
      Object.values(beast.allocatedAttributes).reduce((a, b) => a + b, 0) +
        beast.unallocatedPoints !==
        beast.level * 5
    )
      ctx.addIssue({ code: 'custom', message: '召唤兽个体事实不完整' });
  });
export type SummonedBeast = z.infer<typeof BeastSchema>;
export const BeastLineupSchema = z
  .object({
    carriedBeastIds: z.array(z.uuid()).max(6),
    leadBeastId: z.uuid().optional(),
    revision: points,
  })
  .strict()
  .superRefine((lineup, ctx) => {
    if (
      new Set(lineup.carriedBeastIds).size !== lineup.carriedBeastIds.length ||
      (lineup.leadBeastId &&
        !lineup.carriedBeastIds.includes(lineup.leadBeastId))
    )
      ctx.addIssue({ code: 'custom', message: '携带编组或首发无效' });
  });
export type BeastLineup = z.infer<typeof BeastLineupSchema>;
export type BeastRoster = { beasts: SummonedBeast[]; lineup: BeastLineup };

export const BEAST_SPECIES = [
  {
    id: 'combat.wild.species.spirit-fox',
    name: '青灵狐',
    role: '法术',
    allocation: 'magic',
    skill: 'beast.spirit-flame',
    aptitude: 'mana',
  },
  {
    id: 'combat.wild.species.rock-boar',
    name: '岩甲猪',
    role: '防护',
    allocation: 'constitution',
    skill: 'beast.stone-guard',
    aptitude: 'health',
  },
  {
    id: 'combat.wild.species.wind-wolf',
    name: '疾风狼',
    role: '物理',
    allocation: 'strength',
    skill: 'beast.wind-strike',
    aptitude: 'attack',
  },
] as const;
export const BEAST_SKILLS: SkillDef[] = [
  {
    id: 'beast.spirit-flame',
    name: '灵火',
    costMp: 10,
    tags: [SkillTag.Spell],
    formula: FormulaFamily.Spell,
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [
      { type: EffectType.SpellHit, coeff: 1, power: '10 + skillLevel' },
    ],
  },
  {
    id: 'beast.stone-guard',
    name: '岩甲护身',
    costMp: 10,
    tags: [SkillTag.Spell],
    targeting: { side: TargetSide.Self, count: 1 },
    effects: [
      {
        type: EffectType.ApplyBarrier,
        id: 'beast.stone-guard',
        kind: 'beast-guard',
        name: '岩甲',
        power: '20 + skillLevel * 3',
        duration: 2,
      },
    ],
  },
  {
    id: 'beast.wind-strike',
    name: '疾风爪',
    costMp: 8,
    tags: [SkillTag.Physical],
    formula: FormulaFamily.Physical,
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [{ type: EffectType.PhysicalHit, coeff: 1.1 }],
  },
  ...(
    [
      { id: 'beast.combo', name: '连击', chance: 0.25 },
      { id: 'beast.advanced-combo', name: '高级连击', chance: 0.4 },
    ] as const
  ).map(
    (skill) =>
      ({
        id: skill.id,
        name: skill.name,
        tags: [SkillTag.Passive],
        targeting: { side: TargetSide.Enemy },
        effects: [],
        hooks: [
          {
            on: HookName.AfterHit,
            sourceIsSelf: true,
            requireKind: DamageKind.Physical,
            chance: skill.chance,
            aim: HookAim.HookTarget,
            effects: [{ type: EffectType.PhysicalHit, coeff: 0.75 }],
          },
        ],
      }) satisfies SkillDef,
  ),
];

const BEAST_SKILL_FAMILIES = [
  { normal: 'beast.combo', advanced: 'beast.advanced-combo' },
] as const;
export function activeBeastSkills(beast: SummonedBeast) {
  return beast.skills.filter(
    (id) =>
      !BEAST_SKILL_FAMILIES.some(
        (family) =>
          id === family.normal && beast.skills.includes(family.advanced),
      ),
  );
}

export function generateStarterBeast(
  id: string,
  ownerCultivatorId: string,
  speciesId: string,
  seed: number,
): SummonedBeast {
  const species = BEAST_SPECIES.find((s) => s.id === speciesId);
  if (!species) throw new Error('未知召唤兽物种');
  const rng = new SeededRng(seed);
  const aptitudes = { attack: 0, defense: 0, health: 0, mana: 0, speed: 0 };
  for (const key of Object.keys(aptitudes) as (keyof typeof aptitudes)[])
    aptitudes[key] =
      900 + Math.floor(rng.next() * 201) + (key === species.aptitude ? 100 : 0);
  const allocatedAttributes = {
    constitution: 0,
    strength: 0,
    magic: 0,
    endurance: 0,
    agility: 0,
  };
  allocatedAttributes[species.allocation] = 50;
  return BeastSchema.parse({
    id,
    ownerCultivatorId,
    speciesId,
    name: species.name,
    level: 10,
    exp: 0,
    growth: (950 + Math.floor(rng.next() * 101)) / 1000,
    aptitudes,
    allocatedAttributes,
    unallocatedPoints: 0,
    skillSlotCapacity: 1,
    skills: [species.skill],
    currentLifespan: 1000,
    maxLifespan: 1000,
    generationVersion: BEAST_VERSION,
    generationSeed: seed,
    revision: 0,
  });
}

export function beastRealm(level: number) {
  if (!Number.isInteger(level) || level < 0 || level > 180)
    throw new Error('召唤兽等级无效');
  return [
    '启灵',
    '通慧',
    '化妖',
    '凝丹',
    '妖婴',
    '化形',
    '妖王',
    '妖皇',
    '妖圣',
  ][Math.min(8, Math.floor(level / 20))]!;
}

export function beastPanel(input: SummonedBeast) {
  const b = BeastSchema.parse(input);
  const natural = 10 + b.level;
  const a = Object.fromEntries(
    Object.entries(b.allocatedAttributes).map(([key, value]) => [
      key,
      natural + value,
    ]),
  );
  const contribution = (
    value: number,
    aptitude: keyof SummonedBeast['aptitudes'],
    coeff: number,
  ) => Math.floor(((value * b.growth * b.aptitudes[aptitude]) / 1000) * coeff);
  const hp = 100 + contribution(a.constitution, 'health', 8);
  const mp = 30 + contribution(a.magic, 'mana', 3);
  return {
    ...DEFAULT_ATTRS,
    hp,
    maxHp: hp,
    mp,
    maxMp: mp,
    physicalAtk: 15 + contribution(a.strength, 'attack', 2),
    physicalDef: 10 + contribution(a.endurance, 'defense', 1.5),
    magicAtk: 15 + contribution(a.magic, 'mana', 2),
    magicDef: 10 + contribution(a.endurance + a.magic / 2, 'defense', 1),
    speed: 10 + contribution(a.agility, 'speed', 1.5),
  };
}

export function projectBeastRoster(
  roster: BeastRoster | undefined,
  ownerId: string,
  side: Side,
  slot: number,
): LineupUnit[] {
  if (!roster) return [];
  const lineup = BeastLineupSchema.parse(roster.lineup);
  return lineup.carriedBeastIds
    .map((id) => {
      const beast = BeastSchema.parse(roster.beasts.find((b) => b.id === id));
      if (beast.ownerCultivatorId !== ownerId)
        throw new Error('召唤兽归属不符');
      // Low lifespan reserves never enter the runtime, so they cannot be summoned.
      return beast.currentLifespan < 50
        ? []
        : [
            {
              id: `beast:${beast.id}`,
              name: beast.name,
              ownerId,
              kind: UnitKind.Pet,
              side,
              slot,
              benched: id !== lineup.leadBeastId,
              level: beast.level,
              attrs: beastPanel(beast),
              skills: activeBeastSkills(beast).filter(
                (id) =>
                  !BEAST_SKILLS.find((s) => s.id === id)!.tags.includes(
                    SkillTag.Passive,
                  ),
              ),
              passives: activeBeastSkills(beast).filter((id) =>
                BEAST_SKILLS.find((s) => s.id === id)!.tags.includes(
                  SkillTag.Passive,
                ),
              ),
              skillLevels: Object.fromEntries(
                beast.skills.map((skill) => [skill, beast.level]),
              ),
            },
          ];
    })
    .flat();
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
    currentLifespan: Math.max(0, beast.currentLifespan - 50),
    revision: beast.revision + 1,
  };
}

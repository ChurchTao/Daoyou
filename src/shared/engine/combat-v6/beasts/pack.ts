import { z } from 'zod';

const identity = {
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
};
const name = z.string().trim().min(1).max(40);
const skillId = z.string().regex(/^beast\.[a-z][a-z0-9-]*$/);
const integer = z.number().int().min(0).max(100000);
const number = z.number().min(0).max(100000).multipleOf(0.000001);
const probability = number.max(1);
const range = z.strictObject({ min: integer, max: integer });

export const BeastSpeciesPackShape = z.strictObject({
  ...identity,
  species: z
    .array(
      z.strictObject({
        id: z.string().regex(/^combat\.wild\.species\.[a-z][a-z0-9-]*$/),
        name,
        carryLevel: z.number().int().min(0).max(180),
        role: name,
        allocation: z.enum([
          'constitution',
          'strength',
          'magic',
          'endurance',
          'agility',
        ]),
        skill: skillId,
        aptitude: z.enum(['attack', 'defense', 'health', 'mana', 'speed']),
      }),
    )
    .min(1),
  generation: z.strictObject({
    starterLevel: z.number().int().min(0).max(180),
    lifespan: integer,
    aptitude: range.extend({ favoredBonus: integer }),
    growthMilli: z.strictObject({
      min: integer.min(100).max(3000),
      max: integer.min(100).max(3000),
    }),
    captureBonus: z.strictObject({ skillId, chance: probability }),
  }),
});

export const BeastSkillsPackShape = z.strictObject({
  ...identity,
  skills: z
    .array(
      z.strictObject({
        id: skillId,
        name,
        book: z.boolean(),
        effect: z.discriminatedUnion('type', [
          z.strictObject({
            type: z.literal('spellHit'),
            costMp: integer,
            coefficient: number.positive(),
            powerBase: integer,
            powerPerLevel: number,
          }),
          z.strictObject({
            type: z.literal('barrier'),
            costMp: integer,
            barrierId: skillId,
            kind: name,
            name,
            powerBase: integer,
            powerPerLevel: number,
            duration: integer.min(1).max(99),
          }),
          z.strictObject({
            type: z.literal('physicalHit'),
            costMp: integer,
            coefficient: number.positive(),
          }),
          z.strictObject({
            type: z.literal('combo'),
            chance: probability,
            coefficient: number.positive(),
          }),
        ]),
      }),
    )
    .min(1),
  families: z.array(z.strictObject({ normal: skillId, advanced: skillId })),
});

const panelTerm = z.strictObject({ base: number, coefficient: number });
export const BeastProgressionPackShape = z.strictObject({
  ...identity,
  pointsPerLevel: integer.min(1).max(100),
  experience: z.strictObject({
    base: integer.min(1),
    perLevel: integer,
    victoryPerEnemyLevel: integer,
  }),
  lifespan: z.strictObject({
    deathLoss: integer,
    deployMinimum: integer,
    restRecoveryPerStone: integer.min(1),
  }),
  capture: z.strictObject({
    mpBase: integer,
    mpPerCarryLevel: number,
    minChance: probability,
    maxChance: probability,
    baseChance: probability,
    missingHpFactor: probability,
    levelDifferenceFactor: probability,
  }),
  realms: z.array(z.strictObject({ name, minLevel: integer.max(180) })).min(1),
  panel: z.strictObject({
    naturalBase: number,
    naturalPerLevel: number,
    health: panelTerm.extend({ base: number.min(1) }),
    mana: panelTerm,
    physicalAtk: panelTerm,
    physicalDef: panelTerm,
    magicAtk: panelTerm,
    magicDef: panelTerm.extend({ magicWeight: number }),
    speed: panelTerm,
  }),
});

export type BeastSkillContent = z.infer<
  typeof BeastSkillsPackShape
>['skills'][number];

function parse<T>(shape: z.ZodType<T>, data: unknown, filename: string): T {
  const result = shape.safeParse(data);
  if (result.success) return result.data;
  throw new Error(
    result.error.issues
      .map((issue) => {
        let entry: unknown = data;
        for (const key of issue.path.slice(0, 2))
          entry =
            entry && typeof entry === 'object'
              ? Reflect.get(entry, key)
              : undefined;
        const id =
          entry && typeof entry === 'object' && 'id' in entry
            ? ` [${String(entry.id)}]`
            : '';
        return `${filename}${id} ${issue.path.join('.')}: ${issue.message}`;
      })
      .join('\n'),
  );
}

export function loadBeastPacks(
  speciesData: unknown,
  skillsData: unknown,
  progressionData: unknown,
  wildSpeciesIds: readonly string[],
) {
  const species = parse(BeastSpeciesPackShape, speciesData, 'species.json');
  const skills = parse(BeastSkillsPackShape, skillsData, 'skills.json');
  const progression = parse(
    BeastProgressionPackShape,
    progressionData,
    'progression.json',
  );
  const errors: string[] = [];
  const issue = (file: string, path: string, message: string) =>
    errors.push(`${file} ${path}: ${message}`);
  for (const [filename, entries] of [
    ['species.json', species.species],
    ['skills.json', skills.skills],
  ] as const) {
    const seen = new Set<string>();
    entries.forEach((entry, i) => {
      if (seen.has(entry.id))
        issue(filename, `[${entry.id}].${i}.id`, 'ID 重复');
      seen.add(entry.id);
    });
  }
  const ids = new Set(skills.skills.map((s) => s.id));
  const bonus = species.generation.captureBonus;
  species.species.forEach((s) => {
    if (!wildSpeciesIds.includes(s.id))
      issue('species.json', `[${s.id}].id`, '野外物种引用不存在');
    if (!ids.has(s.skill))
      issue('species.json', `[${s.id}].skill`, `初始技能不存在：${s.skill}`);
    if (bonus.chance > 0 && s.skill === bonus.skillId)
      issue('species.json', `[${s.id}].skill`, '初始技能与捕捉附带技能重复');
  });
  if (!ids.has(bonus.skillId))
    issue(
      'species.json',
      'generation.captureBonus.skillId',
      `技能不存在：${bonus.skillId}`,
    );
  for (const key of ['aptitude', 'growthMilli'] as const) {
    const r = species.generation[key];
    if (r.min > r.max)
      issue('species.json', `generation.${key}`, '下界不得超过上界');
  }
  if (
    species.generation.aptitude.max + species.generation.aptitude.favoredBonus >
    100000
  )
    issue(
      'species.json',
      'generation.aptitude',
      '偏好加成后超出个体资质合法范围',
    );
  const familyIds = new Set<string>();
  skills.families.forEach((f, i) => {
    for (const key of ['normal', 'advanced'] as const) {
      if (!ids.has(f[key]))
        issue('skills.json', `families.${i}.${key}`, `技能不存在：${f[key]}`);
      if (familyIds.has(f[key]))
        issue(
          'skills.json',
          `families.${i}.${key}`,
          `同系技能不得重复或交叉：${f[key]}`,
        );
      familyIds.add(f[key]);
    }
  });
  if (progression.capture.minChance > progression.capture.maxChance)
    issue('progression.json', 'capture.minChance', '捕捉下限不得超过上限');
  if (
    progression.experience.base + 179 * progression.experience.perLevel >
    100000
  )
    issue('progression.json', 'experience', '升级所需经验超出个体经验存储上限');
  progression.realms.forEach((r, i) => {
    if (
      (i === 0 && r.minLevel !== 0) ||
      (i > 0 && r.minLevel <= progression.realms[i - 1].minLevel)
    )
      issue(
        'progression.json',
        `realms.${i}.minLevel`,
        '境界阈值必须从 0 起严格递增',
      );
  });
  const maxAttribute =
    progression.panel.naturalBase +
    180 * (progression.panel.naturalPerLevel + progression.pointsPerLevel);
  for (const key of [
    'health',
    'mana',
    'physicalAtk',
    'physicalDef',
    'magicAtk',
    'magicDef',
    'speed',
  ] as const) {
    const term = progression.panel[key];
    const combined =
      maxAttribute *
      (key === 'magicDef' ? 1 + progression.panel.magicDef.magicWeight : 1);
    if (
      !Number.isSafeInteger(
        Math.floor(term.base + combined * 3 * 100 * term.coefficient),
      )
    )
      issue(
        'progression.json',
        `panel.${key}`,
        '合法个体的投影可能超出安全整数范围',
      );
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { species, skills, progression };
}

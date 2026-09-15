import { z } from 'zod';
import { getRealmStageLevel } from '../../../config/realmProgression';
import { REALM_VALUES } from '../../../types/constants';

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
  formatVersion: z.literal(2),
  species: z
    .array(
      z.strictObject({
        id: z.string().regex(/^combat\.wild\.species\.[a-z][a-z0-9-]*$/),
        name,
        carryLevel: z.number().int().min(0).max(180),
        realm: z.enum(REALM_VALUES),
        icon: z.string().min(1).max(32),
        description: z.string().min(1).max(300),
        starter: z.boolean(),
        birthSkills: z.strictObject({
          core: z.array(skillId).min(1).max(8),
          candidates: z.array(skillId).max(8),
          extraCountWeights: z
            .array(
              z.strictObject({
                count: z.number().int().min(0).max(8),
                weight: z.number().int().positive().max(100),
              }),
            )
            .min(1)
            .max(9),
        }),
        aptitudes: z.strictObject({
          attack: range,
          defense: range,
          health: range,
          mana: range,
          speed: range,
        }),
        growthMilli: z.strictObject({
          min: integer.min(100).max(3000),
          max: integer.min(100).max(3000),
        }),
      }),
    )
    .min(1),
  generation: z.strictObject({
    starterLevel: z.number().int().min(0).max(180),
    lifespan: integer,
    minBirthSkills: z.number().int().min(1).max(8),
    maxBirthSkills: z.number().int().min(1).max(8),
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
        flavorText: z.string().trim().min(1).max(200),
        icon: z.string().trim().min(1).max(32),
        effect: z.discriminatedUnion('type', [
          z.strictObject({
            type: z.literal('groupSpell'),
            costMp: integer,
            coefficient: number.positive(),
            powerBase: integer,
            powerPerLevel: number,
            levelsPerTarget: integer.min(1),
            maxTargets: integer.min(1).max(10),
          }),
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
            physicalFactor: probability.positive(),
          }),
          z.strictObject({
            type: z.literal('counter'),
            chance: probability,
            coefficient: number.positive(),
          }),
          z.strictObject({
            type: z.literal('regeneration'),
            resource: z.enum(['hp', 'mp']),
            levelDivisor: integer.min(1),
          }),
          z.strictObject({
            type: z.literal('critical'),
            kind: z.enum(['physical', 'spell']),
            chance: probability,
          }),
          z.strictObject({
            type: z.literal('spellBoost'),
            factor: number.positive(),
          }),
          z.strictObject({
            type: z.literal('speed'),
            factor: number.positive(),
          }),
          z.strictObject({
            type: z.literal('ghost'),
            delay: integer.min(1).max(99),
          }),
          z.strictObject({
            type: z.literal('exorcism'),
            factor: number.min(1),
          }),
          z.strictObject({
            type: z.literal('denial'),
            ghostDamageFactor: number.min(1),
            spellFactor: probability.positive(),
          }),
          z.strictObject({
            type: z.literal('poison'),
            chance: probability,
            duration: integer.min(1).max(99),
            hpRatio: probability,
            mpRatio: probability,
            immune: z.boolean(),
          }),
          z.strictObject({ type: z.literal('miracle'), immune: z.boolean() }),
          z.strictObject({
            type: z.literal('concentration'),
            physicalFactor: probability.positive(),
            dodgeBonus: integer,
          }),
          z.strictObject({
            type: z.literal('eternity'),
            factor: number.min(1),
            maxExtra: integer.max(99),
          }),
          z.strictObject({
            type: z.literal('stealth'),
            minDuration: integer.min(1).max(99),
            maxDuration: integer.min(1).max(99),
            physicalFactor: probability.positive(),
          }),
          z.strictObject({
            type: z.literal('perception'),
            dodgeBonus: integer,
          }),
          z.strictObject({
            type: z.literal('spellRepeat'),
            chance: probability,
            factor: probability.positive(),
          }),
          z.strictObject({
            type: z.literal('spellFluctuation'),
            min: number.positive(),
            max: number.positive(),
            suppressReflection: z.boolean(),
          }),
          z.strictObject({
            type: z.literal('parry'),
            factor: probability.positive(),
          }),
          z.strictObject({
            type: z.literal('defenseTraining'),
            perLevel: number,
            spellFactor: probability.positive(),
          }),
          z.strictObject({
            type: z.literal('strengthTraining'),
            perLevel: number,
            versusDefenseFactor: probability.positive(),
          }),
          z.strictObject({
            type: z.literal('wisdom'),
            factor: probability.positive(),
          }),
          z.strictObject({
            type: z.literal('sneakAttack'),
            factor: number.min(1),
          }),
          z.strictObject({
            type: z.literal('spellResistance'),
            takenFactor: probability.positive(),
            physicalFactor: probability.positive(),
          }),
          z.strictObject({
            type: z.literal('lifesteal'),
            ratio: probability.positive(),
          }),
          z.strictObject({
            type: z.literal('reflection'),
            kind: z.enum(['physical', 'spell']),
            chance: probability,
            ratio: probability.positive(),
          }),
          z.strictObject({
            type: z.literal('divineRevival'),
            chance: probability,
            hpRatio: probability.positive(),
          }),
        ]),
      }),
    )
    .min(1),
  families: z.array(z.strictObject({ normal: skillId, advanced: skillId })),
});

const panelTerm = z.strictObject({
  aptitudeCoefficient: number,
  attributeCoefficient: number,
});
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
    health: panelTerm,
    mana: panelTerm,
    physicalAtk: panelTerm,
    physicalDef: panelTerm,
    magicAtk: panelTerm,
    magicDef: z.strictObject({
      aptitudeCoefficient: number,
      attributeCoefficients: z.strictObject({
        constitution: number,
        magic: number,
        strength: number,
        endurance: number,
      }),
    }),
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
  for (const skill of skills.skills) {
    if (
      skill.effect.type === 'stealth' &&
      skill.effect.minDuration > skill.effect.maxDuration
    )
      issue('skills.json', `[${skill.id}].effect`, '持续时间下界不得超过上界');
    if (
      skill.effect.type === 'spellFluctuation' &&
      skill.effect.min > skill.effect.max
    )
      issue('skills.json', `[${skill.id}].effect`, '波动下界不得超过上界');
  }
  const ids = new Set(skills.skills.map((s) => s.id));
  if (species.generation.minBirthSkills > species.generation.maxBirthSkills)
    issue('species.json', 'generation', '技能格下界不得超过上界');
  species.species.forEach((s) => {
    if (s.carryLevel !== getRealmStageLevel(s.realm, '初期'))
      issue(
        'species.json',
        `[${s.id}].carryLevel`,
        '携带等级须对应开放境界初期',
      );
    const { core, candidates, extraCountWeights } = s.birthSkills;
    const pool = [...core, ...candidates];
    if (new Set(pool).size !== pool.length)
      issue('species.json', `[${s.id}].birthSkills`, '技能池重复');
    for (const id of pool)
      if (!ids.has(id))
        issue('species.json', `[${s.id}].birthSkills`, `初始技能不存在：${id}`);
    for (const family of skills.families)
      if (pool.includes(family.normal) && pool.includes(family.advanced))
        issue(
          'species.json',
          `[${s.id}].birthSkills`,
          '技能池不得同时包含同族普通与高级技能',
        );
    if (extraCountWeights.reduce((sum, row) => sum + row.weight, 0) !== 100)
      issue(
        'species.json',
        `[${s.id}].birthSkills.extraCountWeights`,
        '权重合计必须为100',
      );
    if (
      new Set(extraCountWeights.map((row) => row.count)).size !==
      extraCountWeights.length
    )
      issue(
        'species.json',
        `[${s.id}].birthSkills.extraCountWeights`,
        '额外数量重复',
      );
    for (const row of extraCountWeights)
      if (
        row.count > candidates.length ||
        core.length + row.count < species.generation.minBirthSkills ||
        core.length + row.count > species.generation.maxBirthSkills
      )
        issue(
          'species.json',
          `[${s.id}].birthSkills.extraCountWeights`,
          '技能数量超出候选池或出生格数范围',
        );
    if (s.starter && s.carryLevel > species.generation.starterLevel)
      issue(
        'species.json',
        `[${s.id}].starter`,
        '初始伙伴携带等级高于出生等级',
      );
  });
  species.species.forEach((entry) => {
    for (const [key, bounds] of Object.entries(entry.aptitudes)) {
      if (bounds.min > bounds.max)
        issue(
          'species.json',
          `[${entry.id}].aptitudes.${key}`,
          '下界不得超过上界',
        );
    }
    if (entry.growthMilli.min > entry.growthMilli.max)
      issue('species.json', `[${entry.id}].growthMilli`, '下界不得超过上界');
  });
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
  if (
    Math.floor(
      progression.panel.naturalBase *
        0.1 *
        progression.panel.health.attributeCoefficient,
    ) < 1
  )
    issue(
      'progression.json',
      'panel.health',
      '零级最低成长个体的气血必须至少为 1',
    );
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
    const attributeCoefficient =
      key === 'magicDef'
        ? Object.values(
            progression.panel.magicDef.attributeCoefficients,
          ).reduce((sum, coefficient) => sum + coefficient, 0)
        : progression.panel[key].attributeCoefficient;
    if (
      !Number.isSafeInteger(
        Math.floor(
          180 * 100000 * term.aptitudeCoefficient +
            maxAttribute * 3 * attributeCoefficient,
        ),
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

export type BeastSpeciesDefinition = z.infer<
  typeof BeastSpeciesPackShape
>['species'][number];

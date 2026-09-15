import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BOOKS } from '../../../items/definitions/beast-books';
import { BEAST_SPECIES } from './content';
import progression from './data/progression.json';
import progressionSchema from './data/progression.schema.json';
import skills from './data/skills.json';
import skillsSchema from './data/skills.schema.json';
import species from './data/species.json';
import speciesSchema from './data/species.schema.json';
import { generateStarterBeast } from './generator';
import {
  BeastProgressionPackShape,
  BeastSkillsPackShape,
  BeastSpeciesPackShape,
  loadBeastPacks,
} from './pack';

function input() {
  return structuredClone({ species, skills, progression });
}
function load(p: ReturnType<typeof input>) {
  return loadBeastPacks(p.species, p.skills, p.progression);
}

describe('beast content packs', () => {
  it('registers the initial species, books and matching schemas', () => {
    expect(BEAST_SPECIES).toHaveLength(15);
    for (const realm of ['炼气', '筑基', '金丹', '元婴', '化神'])
      expect(BEAST_SPECIES.filter((s) => s.realm === realm)).toHaveLength(3);
    expect(BEAST_SPECIES.filter((s) => s.starter).map((s) => s.name)).toEqual([
      '青灵狐',
      '岩甲猪',
      '疾风狼',
    ]);
    expect(BOOKS.map((b) => b.skillId)).toEqual(
      skills.skills.filter((s) => s.book).map((s) => s.id),
    );
    expect(speciesSchema).toEqual(z.toJSONSchema(BeastSpeciesPackShape));
    expect(skillsSchema).toEqual(z.toJSONSchema(BeastSkillsPackShape));
    expect(progressionSchema).toEqual(
      z.toJSONSchema(BeastProgressionPackShape),
    );
  });

  it.each<[string, (p: ReturnType<typeof input>) => void, string]>([
    [
      'duplicate species',
      (p) => {
        p.species.species[1].id = p.species.species[0].id;
      },
      'ID 重复',
    ],
    [
      'unknown initial skill',
      (p) => {
        p.species.species[0].birthSkills.core[0] = 'beast.missing';
      },
      '初始技能不存在',
    ],
    [
      'reversed aptitude',
      (p) => {
        p.species.species[0].aptitudes.attack.min = 1200;
      },
      '下界',
    ],
    [
      'aptitude overflow',
      (p) => {
        p.species.species[0].aptitudes.attack.max = 100001;
      },
      'aptitudes.attack.max',
    ],
    [
      'growth overflow',
      (p) => {
        p.species.species[0].growthMilli.max = 3001;
      },
      'growthMilli.max',
    ],
    [
      'duplicate birth skill',
      (p) => {
        p.species.species[0].birthSkills.core[1] =
          p.species.species[0].birthSkills.core[0];
      },
      '重复',
    ],
    [
      'unknown pool skill',
      (p) => {
        p.species.species[0].birthSkills.core[1] = 'beast.missing';
      },
      '技能不存在',
    ],
    [
      'unknown mechanism',
      (p) => {
        p.skills.skills[0].effect.type = 'script';
      },
      'effect',
    ],
    [
      'free expression',
      (p) => {
        Object.assign(p.skills.skills[0].effect, { power: 'custom()' });
      },
      'effect',
    ],
    [
      'invalid probability',
      (p) => {
        p.skills.skills[1].effect.chance = 2;
      },
      'chance',
    ],
    [
      'duplicate skill',
      (p) => {
        p.skills.skills[1].id = p.skills.skills[0].id;
      },
      'ID 重复',
    ],
    [
      'unknown family reference',
      (p) => {
        p.skills.families[0].normal = 'beast.missing';
      },
      '技能不存在',
    ],
    [
      'cyclic family',
      (p) => {
        p.skills.families.push({
          normal: 'beast.advanced-combo',
          advanced: 'beast.combo',
        });
      },
      '交叉',
    ],
    [
      'capture bounds',
      (p) => {
        p.progression.capture.minChance = 0.9;
      },
      '捕捉下限',
    ],
    [
      'zero rest recovery',
      (p) => {
        p.progression.lifespan.restRecoveryPerStone = 0;
      },
      'restRecoveryPerStone',
    ],
    [
      'missing first realm',
      (p) => {
        p.progression.realms[0].minLevel = 1;
      },
      '从 0 起',
    ],
    [
      'out-of-order realm',
      (p) => {
        p.progression.realms[1].minLevel = 0;
      },
      '递增',
    ],
    [
      'experience overflow',
      (p) => {
        p.progression.experience.perLevel = 100000;
      },
      '经验存储上限',
    ],
    [
      'reversed species growth',
      (p) => {
        p.species.species[0].growthMilli.min = 1100;
      },
      '下界',
    ],
    [
      'zero health at birth',
      (p) => {
        p.progression.panel.health.attributeCoefficient = 0;
      },
      'panel.health',
    ],
    [
      'negative panel coefficient',
      (p) => {
        p.progression.panel.magicDef.attributeCoefficients.magic = -1;
      },
      'attributeCoefficients.magic',
    ],
    [
      'expression precision',
      (p) => {
        p.skills.skills[0].effect.powerPerLevel = 1e-8;
      },
      'powerPerLevel',
    ],
  ])('rejects %s with pack diagnostics', (_, change, field) => {
    const p = input();
    change(p);
    expect(() => load(p)).toThrow('.json');
    expect(() => load(p)).toThrow(field);
  });
});

afterEach(() => {
  for (const file of [
    './data/species.json',
    './data/skills.json',
    './data/progression.json',
  ])
    vi.doUnmock(file);
  vi.resetModules();
});

it('uses edited generation ranges without invalidating existing individual rolls', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const existing = {
    ...generateStarterBeast(id, id, species.species[0].id, 42),
    aptitudes: {
      attack: 1000,
      defense: 1000,
      health: 1000,
      mana: 1100,
      speed: 1000,
    },
    growth: 1.05,
  };
  const copy = structuredClone(species);
  copy.species[0].aptitudes = {
    attack: { min: 1500, max: 1500 },
    defense: { min: 1600, max: 1600 },
    health: { min: 4000, max: 4000 },
    mana: { min: 2400, max: 2400 },
    speed: { min: 1300, max: 1300 },
  };
  copy.species[0].growthMilli = { min: 1200, max: 1200 };
  copy.species[0].birthSkills.extraCountWeights = [{ count: 1, weight: 100 }];
  vi.resetModules();
  vi.doMock('./data/species.json', () => ({ default: copy }));
  const { generateStarterBeast: generate, generateCapturedBeast } =
    await import('./generator');
  const { BeastSchema } = await import('./schema');
  expect(BeastSchema.parse(existing)).toEqual(existing);
  const born = generate(id, id, species.species[0].id, 42);
  expect(Object.values(born.aptitudes)).toEqual([1500, 1600, 4000, 2400, 1300]);
  expect(born.growth).toBe(1.2);
  expect(generate(id, id, species.species[1].id, 42)).toEqual(
    generateStarterBeast(id, id, species.species[1].id, 42),
  );
  const captured = generateCapturedBeast(id, id, species.species[0].id, 10, 42);
  expect(captured.skills).toHaveLength(3);
  expect(captured.skills[0]).toBe(born.skills[0]);
  expect(new Set(captured.skills).size).toBe(3);
  expect(
    captured.skills.every((id) =>
      [
        ...species.species[0].birthSkills.core,
        ...species.species[0].birthSkills.candidates,
      ].includes(id),
    ),
  ).toBe(true);
});

it('uses edited points, experience, lifespan and panel parameters consistently', async () => {
  const copy = structuredClone(progression);
  copy.pointsPerLevel = 6;
  copy.experience = { base: 50, perLevel: 10, victoryPerEnemyLevel: 10 };
  copy.lifespan = {
    deathLoss: 20,
    deployMinimum: 30,
    restRecoveryPerStone: 20,
  };
  copy.panel.health = { aptitudeCoefficient: 0, attributeCoefficient: 7 };
  vi.resetModules();
  vi.doMock('./data/progression.json', () => ({ default: copy }));
  const { generateStarterBeast: generate } = await import('./generator');
  const { beastPanel, canDeployBeast } = await import('./projection');
  const { gainBeastExp, nextBeastExp, beastRestCost, loseBeastLifespan } =
    await import('./progression');
  const id = '00000000-0000-4000-8000-000000000001';
  const born = generate(id, id, species.species[0].id, 42);
  expect(born.allocatedAttributes.magic).toBe(0);
  expect(born.unallocatedPoints).toBe(60);
  expect(nextBeastExp(10)).toBe(150);
  expect(gainBeastExp(born, 150, 180).unallocatedPoints).toBe(66);
  expect(beastPanel(born).maxHp).toBe(Math.floor(20 * born.growth * 7));
  expect(canDeployBeast({ ...born, currentLifespan: 30 }, 180)).toBe(true);
  expect(canDeployBeast({ ...born, currentLifespan: 29 }, 180)).toBe(false);
  expect(loseBeastLifespan(born).currentLifespan).toBe(980);
  expect(beastRestCost({ ...born, currentLifespan: 961 })).toBe(2);
});

it('derives book availability from the skill pack', async () => {
  const copy = structuredClone(skills);
  copy.skills[0].book = false;
  vi.resetModules();
  vi.doMock('./data/skills.json', () => ({ default: copy }));
  const { BOOKS: books } =
    await import('../../../items/definitions/beast-books');
  expect(books.map((b) => b.skillId)).toEqual(
    copy.skills.filter((s) => s.book).map((s) => s.id),
  );
});

it.each([
  [
    'weight total',
    (p: ReturnType<typeof input>) => {
      p.species.species[0].birthSkills.extraCountWeights[0].weight = 50;
    },
  ],
  [
    'duplicate count',
    (p: ReturnType<typeof input>) => {
      p.species.species[0].birthSkills.extraCountWeights[1].count = 0;
    },
  ],
  [
    'too many extras',
    (p: ReturnType<typeof input>) => {
      p.species.species[0].birthSkills.extraCountWeights = [
        { count: 4, weight: 100 },
      ];
    },
  ],
  [
    'overlapping skills',
    (p: ReturnType<typeof input>) => {
      p.species.species[0].birthSkills.candidates[0] =
        p.species.species[0].birthSkills.core[0];
    },
  ],
  [
    'unknown candidate',
    (p: ReturnType<typeof input>) => {
      p.species.species[0].birthSkills.candidates[0] = 'beast.missing';
    },
  ],
  [
    'mixed family',
    (p: ReturnType<typeof input>) => {
      p.species.species[0].birthSkills.candidates[0] = 'beast.advanced-wisdom';
    },
  ],
  [
    'realm mismatch',
    (p: ReturnType<typeof input>) => {
      p.species.species[0].carryLevel = 25;
    },
  ],
  [
    'high level starter',
    (p: ReturnType<typeof input>) => {
      p.species.species[3].starter = true;
    },
  ],
] as const)('rejects invalid generation config: %s', (_, edit) => {
  const p = input();
  edit(p);
  expect(() => load(p)).toThrow('species.json');
});

it.each(['summoned_beast_v1', 'summoned_beast_capture_v1'] as const)(
  '旧 %s 个体不重抽技能、资质、成长或加点',
  async (version) => {
    const { BeastSchema } = await import('./schema');
    const id = '00000000-0000-4000-8000-000000000001';
    const current = generateStarterBeast(id, id, species.species[0].id, 42);
    const { generationContentRevision: _revision, ...base } = current;
    const old = {
      ...base,
      generationVersion: version,
      growth: 1.001,
      aptitudes: {
        attack: 700,
        defense: 900,
        health: 3000,
        mana: 1600,
        speed: 900,
      },
      skills: ['beast.spirit-flame'],
      skillSlotCapacity: 1,
      allocatedAttributes: {
        constitution: 0,
        strength: 0,
        magic: 50,
        endurance: 0,
        agility: 0,
      },
      unallocatedPoints: 0,
    };
    expect(BeastSchema.parse(old)).toEqual(old);
  },
);

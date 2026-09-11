import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BOOKS } from '../../../items/definitions/beast-books';
import { WILD_SPECIES } from '../wild/content';
import { BEAST_SKILLS, BEAST_SPECIES } from './content';
import progression from './data/progression.json';
import progressionSchema from './data/progression.schema.json';
import skills from './data/skills.json';
import skillsSchema from './data/skills.schema.json';
import species from './data/species.json';
import speciesSchema from './data/species.schema.json';
import before from './fixtures/before-g3.json';
import { generateStarterBeast } from './generator';
import {
  BeastProgressionPackShape,
  BeastSkillsPackShape,
  BeastSpeciesPackShape,
  loadBeastPacks,
} from './pack';

const wildIds = WILD_SPECIES.map((s) => s.id);
function input() {
  return structuredClone({ species, skills, progression });
}
function load(p: ReturnType<typeof input>) {
  return loadBeastPacks(p.species, p.skills, p.progression, wildIds);
}

describe('beast content packs', () => {
  it('preserves all species, skills and book registrations', () => {
    expect(BEAST_SPECIES.map((entry) => ({
      id: entry.id, name: entry.name, carryLevel: entry.carryLevel,
      role: entry.role, allocation: entry.allocation, skill: entry.skill,
      aptitude: before.species.find((s) => s.id === entry.id)!.aptitude,
    }))).toEqual(before.species);
    expect(BEAST_SKILLS).toEqual(before.skills);
    expect(BOOKS).toEqual(
      before.skills.map((s) => ({
        id: `book.${s.id}`,
        name: `${s.name}兽诀`,
        kind: 'beast_book',
        skillId: s.id,
        stackLimit: 99,
      })),
    );
    expect(speciesSchema).toEqual(z.toJSONSchema(BeastSpeciesPackShape));
    expect(skillsSchema).toEqual(z.toJSONSchema(BeastSkillsPackShape));
    expect(progressionSchema).toEqual(
      z.toJSONSchema(BeastProgressionPackShape),
    );
  });

  it.each<[string, (p: ReturnType<typeof input>) => void, string]>([
    [
      'unknown wild identity',
      (p) => {
        p.species.species[0].id = 'combat.wild.species.missing';
      },
      '引用不存在',
    ],
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
        p.species.species[0].skill = 'beast.missing';
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
        p.species.generation.captureBonus.skillId = p.species.species[0].skill;
      },
      '重复',
    ],
    [
      'unknown bonus',
      (p) => {
        p.species.generation.captureBonus.skillId = 'beast.missing';
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
        p.skills.skills[3].effect.chance = 2;
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
    aptitudes: { attack: 1000, defense: 1000, health: 1000, mana: 1100, speed: 1000 },
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
  copy.generation.captureBonus.chance = 1;
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
  expect(
    generateCapturedBeast(id, id, species.species[0].id, 10, 42).skills,
  ).toEqual([
    species.species[0].skill,
    species.generation.captureBonus.skillId,
  ]);
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
  expect(born.allocatedAttributes.magic).toBe(60);
  expect(nextBeastExp(10)).toBe(150);
  expect(gainBeastExp(born, 150, 180).unallocatedPoints).toBe(6);
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
    before.skills.slice(1).map((s) => s.id),
  );
});

import { expect, it } from 'vitest';
import { learnBeastSkill } from '../../../inventory';
import { BOOKS } from '../../../items/definitions/beast-books';
import { BEAST_SPECIES } from './content';
import { generateCapturedBeast, generateStarterBeast } from './generator';
import { beastPanel } from './projection';
import { refineBeast } from './refinement';
import { BEAST_REFINEMENT } from './refinement-config';
import { BeastSchema } from './schema';
import { rollBeastTraits } from './trait-generator';

const id = '00000000-0000-4000-8000-000000000001';

it.each(BEAST_SPECIES)(
  '$name 变异只提升五项资质与成长，技能抽签不变',
  (species) => {
    for (let seed = 0; seed < 100; seed++) {
      const normal = rollBeastTraits(species, seed);
      const mutant = rollBeastTraits(species, seed, true);
      for (const key of Object.keys(
        normal.aptitudes,
      ) as (keyof typeof normal.aptitudes)[])
        expect(mutant.aptitudes[key]).toBe(
          Math.round((normal.aptitudes[key] * 11) / 10),
        );
      expect(mutant.growth).toBe(
        Math.round((Math.round(normal.growth * 1000) * 11) / 10) / 1000,
      );
      expect(mutant.skills).toEqual(normal.skills);
      expect(rollBeastTraits(species, seed, false)).toEqual(normal);
    }
  },
);

it('旧个体无需变更存档；初始领取不会变异，非法变异标记被拒绝', () => {
  const normal = generateStarterBeast(id, id, BEAST_SPECIES[0].id, 42);
  expect(normal.isMutant ?? false).toBe(false);
  expect(BeastSchema.parse(normal)).toEqual(normal);
  expect(() => BeastSchema.parse({ ...normal, isMutant: 'true' })).toThrow();
});

it.each(BEAST_SPECIES)(
  '$name 变异的基础面板约提高10%，投影不重复强化',
  (species) => {
    for (const level of [0, 60, 180]) {
      const normal = {
        ...generateCapturedBeast(id, id, species.id, level, 42),
        skills: [],
        skillSlotCapacity: 0,
      };
      const mutant = {
        ...generateCapturedBeast(id, id, species.id, level, 42, true),
        skills: [],
        skillSlotCapacity: 0,
      };
      const a = beastPanel(normal),
        b = beastPanel(mutant);
      for (const key of [
        'maxHp',
        'maxMp',
        'physicalAtk',
        'physicalDef',
        'magicAtk',
        'magicDef',
        'speed',
      ] as const)
        // Integer panels (especially level 0) and three-decimal growth round separately.
        expect(Math.abs(b[key] - a[key] * 1.1)).toBeLessThanOrEqual(
          2 + a[key] * 0.001,
        );
      expect(beastPanel({ ...mutant, isMutant: false })).toEqual(b);
    }
  },
);

it('变异多次洗炼保留身份且不累乘；传承不改变变异和数值', () => {
  const species = BEAST_SPECIES.find((s) => s.name === '咪咪')!;
  const base = generateCapturedBeast(id, id, species.id, 10, 42, true);
  const before = structuredClone(base);
  const item = BEAST_REFINEMENT.items[0].id;
  const first = refineBeast(base, item, 180, 9);
  const second = refineBeast(first, item, 180, 9);
  expect(base).toEqual(before);
  expect(first.isMutant).toBe(true);
  expect(first).toMatchObject(rollBeastTraits(species, 9, true));
  expect(second).toEqual({ ...first, revision: first.revision + 1 });
  const zero = { ...first, skills: [], skillSlotCapacity: 0 };
  const learned = learnBeastSkill(zero, BOOKS[0].id, 180, 0);
  expect(learned).toMatchObject({
    isMutant: true,
    aptitudes: first.aptitudes,
    growth: first.growth,
    skillSlotCapacity: 1,
  });
});

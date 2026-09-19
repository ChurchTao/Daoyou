import { expect, it } from 'vitest';
import { learnBeastSkill } from '../../../inventory';
import { BOOKS } from '../../../items/definitions/beast-books';
import { BEAST_SPECIES } from './content';
import { generateCapturedBeast, generateStarterBeast } from './generator';
import { projectBeastRoster } from './projection';
import { refineBeast } from './refinement';
import { BEAST_REFINEMENT } from './refinement-config';

const id = '00000000-0000-4000-8000-000000000001';
it.each(BEAST_SPECIES)(
  '$name 捕捉、初领与洗炼均可满天生技能，且通常不超过两格',
  (species) => {
    const { core, candidates, extraCountWeights } = species.birthSkills;
    const pool = [...core, ...candidates];
    expect(core.length).toBeLessThanOrEqual(2);
    expect(pool.length).toBeGreaterThanOrEqual(3);
    expect(pool.length).toBeLessThanOrEqual(6);
    const fullWeight = extraCountWeights.find(
      (r) => r.count === candidates.length,
    )!.weight;
    expect(fullWeight).toBeGreaterThanOrEqual(3);
    expect(fullWeight).toBeLessThanOrEqual(5);
    expect(
      extraCountWeights
        .filter((r) => r.count + core.length <= 2)
        .reduce((n, r) => n + r.weight, 0),
    ).toBeGreaterThanOrEqual(75);
    const before = generateCapturedBeast(id, id, species.id, 60, 0);
    const fullSeed = Array.from({ length: 2000 }, (_, seed) => seed).find(
      (seed) =>
        generateCapturedBeast(id, id, species.id, 60, seed).skills.length ===
        pool.length,
    );
    expect(fullSeed).toBeDefined();
    for (const beast of [
      generateCapturedBeast(id, id, species.id, 60, fullSeed!),
      generateStarterBeast(id, id, species.id, fullSeed!),
      refineBeast(before, BEAST_REFINEMENT.items[1].id, 180, fullSeed!),
    ]) {
      expect(new Set(beast.skills)).toEqual(new Set(pool));
      expect(beast.skillSlotCapacity).toBe(pool.length);
    }
  },
);

it('无必带物种可生成和洗出零格，投影有效且传承可开启第一格', () => {
  const species = BEAST_SPECIES.find((s) => s.birthSkills.core.length === 0);
  expect(species).toBeDefined();
  const seed = Array.from({ length: 1000 }, (_, n) => n).find(
    (seed) =>
      generateCapturedBeast(id, id, species!.id, 10, seed).skills.length === 0,
  );
  expect(seed).toBeDefined();
  const beast = generateCapturedBeast(id, id, species!.id, 10, seed!);
  expect(beast.skillSlotCapacity).toBe(0);
  expect(
    refineBeast(beast, BEAST_REFINEMENT.items[1].id, 180, seed!).skills,
  ).toEqual([]);
  const [unit] = projectBeastRoster(
    {
      beasts: [beast],
      lineup: { carriedBeastIds: [id], leadBeastId: id, revision: 0 },
    },
    id,
    0,
    0,
    180,
  );
  expect(unit).toBeDefined();
  expect(unit.skills).toEqual([]);
  expect(unit.passives).toEqual([]);
  const learned = learnBeastSkill(beast, BOOKS[0].id, 180, 0);
  expect(learned.skills).toEqual([BOOKS[0].skillId]);
  expect(learned.skillSlotCapacity).toBe(1);
});

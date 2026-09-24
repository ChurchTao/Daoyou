import { expect, it } from 'vitest';
import { BEAST_SPECIES } from './content';
import { generateCapturedBeast, generateStarterBeast } from './generator';
import { canDeployBeast, projectBeastRoster } from './projection';
import { rollBeastTraits } from './trait-generator';
const id = '00000000-0000-4000-8000-000000000001';

it.each([
  ['combat.wild.species.mimi', 5],
  ['combat.wild.species.nether-tiger', 85],
] as const)(
  '%s 幼崽也受物种携带门槛约束，达标后投影完整天赋',
  (speciesId, threshold) => {
    const beast = generateCapturedBeast(id, id, speciesId, 0, 42);
    expect(canDeployBeast(beast, threshold - 1)).toBe(false);
    expect(canDeployBeast(beast, threshold)).toBe(true);
    const roster = {
      beasts: [beast],
      lineup: { carriedBeastIds: [id], leadBeastId: id, revision: 0 },
    };
    expect(projectBeastRoster(roster, id, 0, 0, threshold - 1)).toEqual([]);
    const [unit] = projectBeastRoster(roster, id, 0, 0, threshold);
    expect(new Set([...unit.skills!, ...unit.passives!])).toEqual(
      new Set(beast.skills),
    );
    if (speciesId === 'combat.wild.species.nether-tiger') {
      expect(unit.skills).toContain('beast.spirit-flame');
      expect(unit.passives).toContain('beast.advanced-exorcism');
    } else {
      expect(unit.skills).toEqual([]);
    }
  },
);

it.each(BEAST_SPECIES)(
  '$name 的核心必带、候选不重复、范围合法且两入口一致',
  (species) => {
    const before = structuredClone(species);
    const seen = new Set<string>();
    const counts = new Set<number>();
    for (let seed = 0; seed < 1000; seed++) {
      const born = generateStarterBeast(id, id, species.id, seed);
      const captured = generateCapturedBeast(id, id, species.id, 60, seed);
      const traits = rollBeastTraits(species, seed);
      expect(born).toMatchObject(traits);
      expect(captured).toMatchObject(traits);
      expect(born.skills.slice(0, species.birthSkills.core.length)).toEqual(
        species.birthSkills.core,
      );
      expect(new Set(born.skills).size).toBe(born.skillSlotCapacity);
      expect(born.skillSlotCapacity).toBeGreaterThanOrEqual(
        species.birthSkills.core.length,
      );
      expect(born.skillSlotCapacity).toBeLessThanOrEqual(
        species.birthSkills.core.length + species.birthSkills.candidates.length,
      );
      expect(Object.values(captured.allocatedAttributes)).toEqual([
        0, 0, 0, 0, 0,
      ]);
      expect(captured.unallocatedPoints).toBe(180);
      for (const key of Object.keys(
        traits.aptitudes,
      ) as (keyof typeof traits.aptitudes)[]) {
        expect(traits.aptitudes[key]).toBeGreaterThanOrEqual(
          species.aptitudes[key].min,
        );
        expect(traits.aptitudes[key]).toBeLessThanOrEqual(
          species.aptitudes[key].max,
        );
      }
      expect(traits.growth).toBeGreaterThanOrEqual(
        species.growthMilli.min / 1000,
      );
      expect(traits.growth).toBeLessThanOrEqual(species.growthMilli.max / 1000);
      born.skills.forEach((skill) => seen.add(skill));
      counts.add(born.skills.length);
      expect(rollBeastTraits(species, seed)).toEqual(traits);
    }
    expect(species).toEqual(before);
    expect([...seen].sort()).toEqual(
      [...species.birthSkills.core, ...species.birthSkills.candidates].sort(),
    );
    expect([...counts].sort()).toEqual(
      species.birthSkills.extraCountWeights
        .map((row) => row.count + species.birthSkills.core.length)
        .sort(),
    );
  },
);

it.each(BEAST_SPECIES)(
  '$name 固定种子样本符合配置概率且候选等权',
  (species) => {
    const countHits = new Map<number, number>();
    const skillHits = new Map<string, number>();
    const samples = 10000;
    let extras = 0;
    for (let seed = 0; seed < samples; seed++) {
      const skills = rollBeastTraits(species, seed).skills.slice(
        species.birthSkills.core.length,
      );
      countHits.set(skills.length, (countHits.get(skills.length) ?? 0) + 1);
      extras += skills.length;
      for (const skill of skills)
        skillHits.set(skill, (skillHits.get(skill) ?? 0) + 1);
    }
    for (const row of species.birthSkills.extraCountWeights)
      expect(
        Math.abs((countHits.get(row.count) ?? 0) / samples - row.weight / 100),
      ).toBeLessThan(0.02);
    for (const skill of species.birthSkills.candidates)
      expect(
        Math.abs(
          (skillHits.get(skill) ?? 0) / extras -
            1 / species.birthSkills.candidates.length,
        ),
      ).toBeLessThan(0.02);
  },
);

it('改变技能抽取配置不改变资质与成长，数值配置不改变出生技能', () => {
  const original = BEAST_SPECIES[0];
  const skillsChanged = structuredClone(original);
  skillsChanged.birthSkills.extraCountWeights = [{ count: 1, weight: 100 }];
  const statsChanged = structuredClone(original);
  statsChanged.aptitudes.attack = { min: 1000, max: 1000 };
  statsChanged.growthMilli = { min: 1200, max: 1200 };
  for (let seed = 0; seed < 100; seed++) {
    const base = rollBeastTraits(original, seed);
    const changed = rollBeastTraits(skillsChanged, seed);
    expect(changed.aptitudes).toEqual(base.aptitudes);
    expect(changed.growth).toBe(base.growth);
    expect(rollBeastTraits(statsChanged, seed).skills).toEqual(base.skills);
  }
});

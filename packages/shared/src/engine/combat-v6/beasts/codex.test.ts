import { expect, it } from 'vitest';
import { REALM_ORDER } from '../../../types/constants.js';
import { WILD_REGIONS } from '../wild/content.js';
import { listBeastCodex } from './codex.js';
import { BEAST_SPECIES } from './content.js';

const codex = listBeastCodex();

it('图鉴按物种列出满资质、满成长与全部天生技能', () => {
  expect(codex.map((entry) => entry.id)).toEqual(
    BEAST_SPECIES.map((species) => species.id),
  );
  for (const [entry, species] of codex.map(
    (entry, index) => [entry, BEAST_SPECIES[index]] as const,
  )) {
    expect(entry.aptitudes).toEqual(species.aptitudes);
    expect(entry.growthMilli).toEqual(species.growthMilli);
    for (const range of Object.values(entry.aptitudes))
      expect(range.max).toBeGreaterThanOrEqual(range.min);
    expect(entry.growthMilli.max).toBeGreaterThanOrEqual(entry.growthMilli.min);
    expect(entry.skills).toEqual([
      ...species.birthSkills.core.map((id) => ({ id, innate: 'core' })),
      ...species.birthSkills.candidates.map((id) => ({
        id,
        innate: 'candidate',
      })),
    ]);
    expect(new Set(entry.skills.map((skill) => skill.id)).size).toBe(
      entry.skills.length,
    );
  }
});

it('每种灵兽都标出野外出没地，低境界在前', () => {
  for (const entry of codex) {
    const habitats = WILD_REGIONS.flatMap((region) =>
      region.species
        .filter((row) => row.speciesId === entry.id)
        .map((row) => ({
          nodeId: region.nodeId,
          name: region.name,
          realmRequirement: region.realmRequirement,
          minLevel: row.minLevel,
          maxLevel: row.maxLevel,
        })),
    ).sort(
      (a, b) =>
        REALM_ORDER[a.realmRequirement] - REALM_ORDER[b.realmRequirement] ||
        a.minLevel - b.minLevel ||
        a.name.localeCompare(b.name, 'zh'),
    );
    expect(entry.habitats).toEqual(habitats);
    expect(entry.habitats.length).toBeGreaterThan(0);
  }
  const fox = codex.find((item) => item.name === '烛尾狐');
  expect(fox?.habitats.map((habitat) => habitat.name)).toEqual(['青溪坡']);
  expect(fox?.aptitudes.attack.max).toBe(840);
  expect(fox?.growthMilli.max).toBe(1030);
  expect(fox?.skills[0]).toEqual({ id: 'beast.spirit-flame', innate: 'core' });
  const boar = codex.find((item) => item.name === '钢背猪');
  expect(boar?.habitats.map((habitat) => habitat.realmRequirement)).toEqual([
    '炼气',
    '筑基',
  ]);
});

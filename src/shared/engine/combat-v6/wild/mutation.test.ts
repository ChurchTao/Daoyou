import { expect, it } from 'vitest';
import {
  beastAppearance,
  playerAppearances,
  publicUnitAppearances,
} from '../../../combat-v6/unit-appearance';
import { wildEncounterView } from '../../../contracts/combatV6Wild';
import type { CombatV6TrainingPlayerInput } from '../encounter/types';
import {
  generateWildEncounter,
  generateWildIndividual,
  WildIndividualSchema,
} from './generator';
import { loadWildPack, WILD_PACK } from './pack';

const id = '00000000-0000-4000-8000-000000000001';
const nodeId = WILD_PACK.regions[0].nodeId;

it('变异概率为千分之八，边界可控且不扰动物种和数量，变异均为0级', () => {
  expect(WILD_PACK.encounter.mutantChance).toBe(0.008);
  for (const bad of [-0.1, 1.1])
    expect(() =>
      loadWildPack({
        ...WILD_PACK,
        encounter: { ...WILD_PACK.encounter, mutantChance: bad },
      }),
    ).toThrow();
  for (const cubChance of [0, 1]) {
    const normalPack = {
      ...WILD_PACK,
      encounter: { ...WILD_PACK.encounter, cubChance, mutantChance: 0 },
    };
    const mutantPack = {
      ...normalPack,
      encounter: { ...normalPack.encounter, mutantChance: 1 },
    };
    for (let seed = 0; seed < 100; seed++) {
      const normal = generateWildEncounter(nodeId, seed, normalPack);
      const mutant = generateWildEncounter(nodeId, seed, mutantPack);
      expect(normal.every((c) => !c.isMutant)).toBe(true);
      expect(mutant).toEqual(
        normal.map((c) => ({ ...c, level: 0, isMutant: true })),
      );
      expect(generateWildEncounter(nodeId, seed, mutantPack)).toEqual(mutant);
    }
  }
});

it('变异身份随公开预览、完整个体和外观流转，不泄露资质或隐藏后备', () => {
  const c = {
    unitId: 'enemy',
    speciesId: WILD_PACK.regions[0].species[0].speciesId,
    level: 0,
    isMutant: true,
  };
  const individual = generateWildIndividual(c, id, id, 42);
  expect(individual.beast.isMutant).toBe(true);
  expect(WildIndividualSchema.parse(individual)).toEqual(individual);
  expect(() =>
    WildIndividualSchema.parse({ ...individual, isMutant: false }),
  ).toThrow();
  const view = wildEncounterView({
    id,
    nodeId,
    seed: 42,
    createdAt: '2026-09-19T00:00:00.000Z',
    combatants: [individual],
  });
  expect(view.combatants).toEqual([c]);
  const appearance = beastAppearance(c.speciesId, true);
  expect(appearance.isMutant).toBe(true);
  const player = {
    cultivator: { id },
    beasts: { beasts: [individual.beast] },
  } as CombatV6TrainingPlayerInput;
  expect(playerAppearances(player)[`beast:${id}`]).toEqual(appearance);
  expect(
    publicUnitAppearances(
      { enemy: appearance, hidden: appearance },
      { enemy: '灵兽' },
    ),
  ).toEqual({ enemy: appearance });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import data from './data/equipment-forging.json';
import schema from './data/equipment-forging.schema.json';
import {
  EquipmentForgingPackShape,
  loadEquipmentForgingPack,
} from './forging-pack';
import { daoEquipmentGenerationRulesV2 } from './generator';
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
} from './special-content';

const definitions = {
  arts: DAO_EQUIPMENT_ARTS_V1,
  essences: DAO_EQUIPMENT_ESSENCES_V1,
};
describe('equipment forging pack', () => {
  it('matches editor schema and preserves probability boundaries', () => {
    expect(loadEquipmentForgingPack(data, definitions)).toEqual(data);
    expect(schema).toEqual(z.toJSONSchema(EquipmentForgingPackShape));
    expect(
      [0.819999, 0.82, 0.979999, 0.98].map(
        daoEquipmentGenerationRulesV2.essenceCount,
      ),
    ).toEqual([0, 1, 1, 2]);
    expect(daoEquipmentGenerationRulesV2.artChance).toBe(0.08);
  });
  it.each<[string, (p: typeof data) => void, string]>([
    [
      'probability sum',
      (p) => {
        p.generation.essenceCountProbabilities = [0.9, 0.2, 0];
      },
      'essenceCountProbabilities',
    ],
    [
      'unknown essence',
      (p) => {
        p.generation.essencePool[0] = 'missing';
      },
      'missing',
    ],
    [
      'duplicate art',
      (p) => {
        p.generation.artPool[1] = p.generation.artPool[0];
      },
      'artPool.1',
    ],
    [
      'short pool',
      (p) => {
        p.generation.essencePool = [p.generation.essencePool[0]];
      },
      '可用内容不足',
    ],
    [
      'duplicate level',
      (p) => {
        p.forging.costs[1].level = 10;
      },
      'costs.1.level',
    ],
    [
      'missing level',
      (p) => {
        p.forging.costs.pop();
      },
      'costs',
    ],
    [
      'negative cost',
      (p) => {
        p.forging.costs[0].spiritStones = -1;
      },
      'spiritStones',
    ],
    [
      'too many materials',
      (p) => {
        p.forging.costs[0].quantity = 6;
      },
      'quantity',
    ],
    [
      'invalid quality',
      (p) => {
        p.forging.costs[0].rank = '极品';
      },
      'rank',
    ],
    [
      'invalid reroll probability',
      (p) => {
        p.forging.boostPerMaterial = 0.21;
      },
      'boostPerMaterial',
    ],
  ])('rejects %s', (_, mutate, field) => {
    const copy = structuredClone(data);
    mutate(copy);
    expect(() => loadEquipmentForgingPack(copy, definitions)).toThrow(
      'equipment-forging.json',
    );
    expect(() => loadEquipmentForgingPack(copy, definitions)).toThrow(field);
  });
  it('rejects pools unable to supply a configured slot', () => {
    const essences = definitions.essences.map((entry) => ({
      ...entry,
      allowedSlots: ['weapon'] as const,
    }));
    expect(() =>
      loadEquipmentForgingPack(data, {
        ...definitions,
        essences: essences.map((e) => ({
          ...e,
          allowedSlots: [...e.allowedSlots],
        })),
      }),
    ).toThrow('head');
  });
});

afterEach(() => {
  vi.doUnmock('./data/equipment-forging.json');
  vi.resetModules();
});

it('shares edited generation, pool, cost and material boost configuration', async () => {
  const copy = structuredClone(data);
  copy.generation.essenceCountProbabilities = [0, 0, 1];
  copy.generation.artChance = 1;
  copy.generation.essencePool = copy.generation.essencePool.slice(0, 2);
  copy.generation.artPool = copy.generation.artPool.slice(0, 1);
  copy.forging.boostPerMaterial = 0.2;
  copy.forging.costs[0].spiritStones = 321;
  vi.resetModules();
  vi.doMock('./data/equipment-forging.json', () => ({ default: copy }));
  const { generateDaoEquipmentV2 } = await import('./generator');
  const { generateForgedEquipment, FORGING_BOOST_PER_MATERIAL } =
    await import('./forging');
  const { forgingCost } = await import('../../../forging/rules');
  const input = {
    id: 'edited',
    createdAt: '2026-09-11',
    seed: 13,
    templateId: 'dao_equipment.standard.weapon.v1',
    equipmentLevel: 10,
  };
  for (const result of [
    generateDaoEquipmentV2({
      ...input,
      generatorVersion: 'dao_equipment_generator_v2',
    }),
    generateForgedEquipment({
      ...input,
      boosts: { ore: 0, essence: 5, attributes: 0 },
    }),
  ]) {
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('generation failed');
    expect([...result.instance.essenceIds].sort()).toEqual(
      [...copy.generation.essencePool].sort(),
    );
    expect(result.instance.artId).toBe(copy.generation.artPool[0]);
  }
  expect(FORGING_BOOST_PER_MATERIAL).toBe(0.2);
  expect(forgingCost(10).spiritStones).toBe(321);
});

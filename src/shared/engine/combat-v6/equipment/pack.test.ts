import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import data from './data/equipment-base.json';
import editorSchema from './data/equipment-base.schema.json';
import { EquipmentBasePackShape, loadEquipmentBasePack } from './pack';

describe('equipment base data pack', () => {
  it('loads the shipped pack and keeps editor schema aligned', () => {
    expect(loadEquipmentBasePack(data)).toEqual(data);
    expect(editorSchema).toEqual(z.toJSONSchema(EquipmentBasePackShape));
  });

  it.each<[string, (pack: typeof data) => void, string]>([
    [
      'unknown fields',
      (p) => {
        Object.assign(p.templates[0], { typo: 1 });
      },
      'templates.0',
    ],
    [
      'unsupported version',
      (p) => {
        p.formatVersion = 2;
      },
      'formatVersion',
    ],
    [
      'duplicate IDs',
      (p) => {
        p.inscriptions[1].id = p.inscriptions[0].id;
      },
      'inscriptions.1',
    ],
    [
      'broken template reference',
      (p) => {
        p.templates[0].id = 'dao_equipment.standard.other.v1';
      },
      'templates.0.id',
    ],
    [
      'missing slot',
      (p) => {
        p.templates.pop();
      },
      'templates',
    ],
    [
      'duplicate slots',
      (p) => {
        p.templates[1].slot = p.templates[0].slot;
      },
      'templates.1',
    ],
    [
      'unknown attributes',
      (p) => {
        p.templates[0].baseStats[0].attr = 'attack';
      },
      'templates.0.baseStats.0.attr',
    ],
    [
      'duplicate stats',
      (p) => {
        p.templates[0].baseStats.push(p.templates[0].baseStats[0]);
      },
      'templates.0.baseStats.3',
    ],
    [
      'duplicate preferences',
      (p) => {
        p.templates[0].favoredAttributes.push('strength');
      },
      'favoredAttributes',
    ],
    [
      'reversed range',
      (p) => {
        p.templates[0].baseStats[0].minCoefficient = 2;
      },
      'maxCoefficient',
    ],
    [
      'negative coefficient',
      (p) => {
        p.generation.bonusValue.minCoefficient = -1;
      },
      'minCoefficient',
    ],
    [
      'nonfinite number',
      (p) => {
        p.inscriptions[0].valuePerLevel = Infinity;
      },
      'valuePerLevel',
    ],
    [
      'invalid inscription slot',
      (p) => {
        p.inscriptions[0].allowedSlots = ['ring'];
      },
      'allowedSlots',
    ],
    [
      'duplicate inscription slots',
      (p) => {
        p.inscriptions[0].allowedSlots = ['weapon', 'weapon'];
      },
      'allowedSlots',
    ],
    [
      'bad probability total',
      (p) => {
        p.generation.bonusCountProbabilities = [0.5, 0.5, 0.1];
      },
      'bonusCountProbabilities',
    ],
    [
      'negative probability',
      (p) => {
        p.generation.bonusCountProbabilities = [-0.1, 1, 0.1];
      },
      'bonusCountProbabilities',
    ],
    [
      'zero weight',
      (p) => {
        p.generation.normalWeight = 0;
      },
      'normalWeight',
    ],
    [
      'overflowing weight',
      (p) => {
        p.generation.favoredWeight = Number.MAX_VALUE;
      },
      'favoredWeight',
    ],
    [
      'overflowing range',
      (p) => {
        p.generation.bonusValue.maxCoefficient = Number.MAX_VALUE;
      },
      'maxCoefficient',
    ],
  ])('rejects %s with file and field diagnostics', (_, mutate, field) => {
    const changed = structuredClone(data);
    mutate(changed);
    expect(() => loadEquipmentBasePack(changed)).toThrow('equipment-base.json');
    expect(() => loadEquipmentBasePack(changed)).toThrow(field);
  });

  it('identifies the content ID for structural and semantic errors', () => {
    const changed = structuredClone(data);
    changed.templates[0].baseStats[0].minCoefficient = 99;
    expect(() => loadEquipmentBasePack(changed)).toThrow(
      `[${changed.templates[0].id}]`,
    );
    changed.templates[0].baseStats[0].attr = 'unknown';
    expect(() => loadEquipmentBasePack(changed)).toThrow(
      `[${changed.templates[0].id}]`,
    );
  });
});

afterEach(() => {
  vi.doUnmock('./data/equipment-base.json');
  vi.resetModules();
});

it('feeds changed JSON into generation, forging and instance validation', async () => {
  const changed = structuredClone(data);
  changed.generation.bonusCountProbabilities = [0, 0, 1];
  changed.generation.bonusValue = { minCoefficient: 0.2, maxCoefficient: 0.2 };
  changed.templates[0].baseStats[0] = {
    attr: 'physicalAtk',
    minCoefficient: 1,
    maxCoefficient: 1,
  };
  vi.resetModules();
  vi.doMock('./data/equipment-base.json', () => ({ default: changed }));
  const { generateDaoEquipmentV2, daoEquipmentGenerationRulesV1 } =
    await import('./generator');
  const { generateForgedEquipment } = await import('./forging');
  const { compileDaoEquipmentSpecialLoadoutV1 } = await import('./compiler');
  const input = {
    id: 'config-test',
    createdAt: '2026-09-11T00:00:00.000Z',
    seed: 1,
    templateId: changed.templates[0].id,
    equipmentLevel: 170,
  };
  expect(daoEquipmentGenerationRulesV1.bonusCount(0)).toBe(2);
  for (const result of [
    generateDaoEquipmentV2({
      ...input,
      generatorVersion: 'dao_equipment_generator_v2',
    }),
    generateForgedEquipment({
      ...input,
      boosts: { ore: 2, attributes: 3, essence: 0 },
    }),
  ]) {
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('generation failed');
    expect(result.instance.baseStats[0].value).toBe(170);
    expect(result.instance.attributeBonuses.map((s) => s.value)).toEqual([
      34, 34,
    ]);
    expect(
      compileDaoEquipmentSpecialLoadoutV1({ weapon: result.instance }, 180).ok,
    ).toBe(true);
    result.instance.attributeBonuses[0].value = 25;
    expect(
      compileDaoEquipmentSpecialLoadoutV1({ weapon: result.instance }, 180).ok,
    ).toBe(false);
  }
});

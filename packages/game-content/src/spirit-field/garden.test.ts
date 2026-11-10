import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import data from './data/garden.json' with { type: 'json' };
import editorSchema from './data/garden.schema.json' with { type: 'json' };
import {
  loadSpiritGardenCatalog,
  SpiritGardenCatalogSchema,
  SpiritGardenCatalogShape,
} from './garden-schema.js';

type CatalogData = typeof data;

describe('spirit garden authoring catalog', () => {
  it('uses one catalog with four species at each quality', () => {
    const catalog = loadSpiritGardenCatalog(data);
    expect(catalog.species).toHaveLength(32);
    expect(
      catalog.species.filter((entry) => entry.name === '金雷竹'),
    ).toMatchObject([
      { id: 'gold_thunder_bamboo', quality: '天品' },
    ]);
  });

  it('keeps the editor schema aligned with the runtime authoring shape', () => {
    expect(editorSchema).toEqual(z.toJSONSchema(SpiritGardenCatalogShape));
    expect(() => loadSpiritGardenCatalog(data)).not.toThrow();
  });

  it('accepts designer timing and yield changes without a runtime factory overwriting them', () => {
    const changed = structuredClone(data);
    changed.species[0].matureMs = 300_000;
    changed.species[0].baseOutput.cycleMs = 21_600_000;
    changed.species[0].branches.abundance.output.cycleMs = 21_600_000;
    changed.species[0].branches.abundance.output.quantity = 3;
    const catalog = loadSpiritGardenCatalog(changed);
    expect(catalog.species[0].matureMs).toBe(300_000);
    expect(catalog.species[0].branches.abundance.output).toMatchObject({
      quantity: 3,
      cycleMs: 21_600_000,
    });
    expect(data.species[0].branches.abundance.output.quantity).toBe(2);
  });

  it.each<{
    name: string;
    change: (value: CatalogData) => void;
    path: string;
  }>([
    {
      name: 'reused durable species identity',
      change: (value) => {
        value.species[1].id = value.species[0].id;
      },
      path: 'species.1.id',
    },
    {
      name: 'ambiguous adult species name',
      change: (value) => {
        value.species[1].name = value.species[0].name;
      },
      path: 'species.1.name',
    },
    {
      name: 'incomplete quality coverage',
      change: (value) => {
        value.species.splice(8, 1);
      },
      path: 'species',
    },
    {
      name: 'illustration column outside the atlas',
      change: (value) => {
        value.species[0].portrait.index = 4;
      },
      path: 'species.0.portrait.index',
    },
    {
      name: 'a second illustration atlas for the same quality',
      change: (value) => {
        value.species[1].portrait.atlas = 'botanical-variant';
      },
      path: 'species',
    },
    {
      name: 'duplicated illustration placement',
      change: (value) => {
        value.species[9].portrait = structuredClone(value.species[8].portrait);
      },
      path: 'species.9.portrait',
    },
    {
      name: 'unsafe illustration path',
      change: (value) => {
        value.species[8].portrait.atlas = '../secret';
      },
      path: 'species.8.portrait.atlas',
    },
    {
      name: 'zero production period',
      change: (value) => {
        value.species[0].baseOutput.cycleMs = 0;
      },
      path: 'species.0.baseOutput.cycleMs',
    },
    {
      name: 'period exceeding the storage allowance',
      change: (value) => {
        value.species[31].branches.essence.output.cycleMs = 604_800_000;
      },
      path: 'species.31.branches',
    },
    {
      name: 'production acceleration when changing route',
      change: (value) => {
        value.species[0].branches.essence.output.cycleMs = 3_600_000;
      },
      path: 'species.0.branches.essence.output.cycleMs',
    },
    {
      name: 'inverted growth milestones',
      change: (value) => {
        value.species[0].branchMs = value.species[0].evolveMs + 1;
      },
      path: 'species.0.matureMs',
    },
    {
      name: 'fruit without effect facts',
      change: (value) => {
        delete value.species[8].branches.essence.output.fruitEffects;
      },
      path: 'species.8.branches.essence.output.fruitEffects',
    },
    {
      name: 'composite exceeding the original fruit budget',
      change: (value) => {
        value.species[8].branches.essence.output.fruitEffects![0].share = 1;
      },
      path: 'species.8.branches.essence.output.fruitEffects',
    },
    {
      name: 'repeated composite effect',
      change: (value) => {
        value.species[8].branches.essence.output.fruitEffects![1].family =
          'breakthrough';
      },
      path: 'species.8.branches.essence.output.fruitEffects',
    },
    {
      name: 'nested hybrid effect',
      change: (value) => {
        value.species[8].branches.essence.output.fruitEffects![0].family =
          'hybrid';
      },
      path: 'species.8.branches.essence.output.fruitEffects.0.family',
    },
    {
      name: 'mixed beast and person effects',
      change: (value) => {
        value.species[8].branches.essence.output.fruitEffects![0].family =
          'beast_cultivation';
      },
      path: 'species.8.branches.essence.output.fruitEffects',
    },
    {
      name: 'effect facts attached to a material',
      change: (value) => {
        Object.assign(value.species[15].branches.essence.output, {
          fruitEffects: [{ family: 'cultivation', share: 1 }],
        });
      },
      path: 'species.15.branches.essence.output.fruitEffects',
    },
    {
      name: 'unknown authoring field',
      change: (value) => {
        Object.assign(value.species[8], { powerMultiplier: 100 });
      },
      path: 'species.8',
    },
  ])('rejects $name', ({ change, path }) => {
    const changed = structuredClone(data);
    change(changed);
    const result = SpiritGardenCatalogSchema.safeParse(changed);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.some((issue) => issue.path.join('.') === path),
      ).toBe(true);
  });
});

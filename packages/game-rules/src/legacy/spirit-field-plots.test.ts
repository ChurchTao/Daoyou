import { readSpiritGardenSeedSpec } from '@daoyou/game-domain/spirit-field';
import { describe, expect, it } from 'vitest';
import {
  archiveSpiritGardenPlant,
  buildSpiritGardenSeed,
  createSpiritGarden,
  parseSpiritGardenState,
  plantSpiritGardenSeed,
  restoreSpiritGardenPlant,
  settleSpiritGarden,
} from '../spirit-field/garden.js';
import {
  projectLegacySpiritGarden,
  readPersistedSpiritGarden,
  uprootLegacySpiritGardenPlant,
} from './spirit-field-plots.js';

const now = 1_000_000;
function plots() {
  return Array.from({ length: 6 }, (_, index) => ({
    index,
    plantId: index === 0 ? 'old-plant' : null,
    plant: index === 0 ? { quality: '玄品', seedName: '旧灵种' } : null,
  }));
}

describe('unknown plants in published legacy plots', () => {
  it('projects only identity and quality without growth, harvests or input changes', () => {
    const source = plots();
    const before = structuredClone(source);
    const garden = projectLegacySpiritGarden(source, 'field-1');
    expect(garden.plots[0]).toEqual({
      index: 0,
      plant: null,
      unknownPlant: { id: 'field-1:unknown:0', quality: '玄品' },
    });
    expect(garden.collection).toEqual([]);
    expect(garden.codex).toEqual([]);
    expect(settleSpiritGarden(garden, now + 100 * 86_400_000)).toEqual(garden);
    expect(parseSpiritGardenState(garden)).toEqual(garden);
    expect(projectLegacySpiritGarden(source, 'field-1')).toEqual(garden);
    expect(source).toEqual(before);
  });

  it('keeps orphaned plants visible and refuses to guess a missing or invalid quality', () => {
    for (const plant of [null, {}, { quality: '不存在' }]) {
      const source: unknown[] = plots();
      source[0] = { index: 0, plantId: 'old-plant', plant };
      const garden = projectLegacySpiritGarden(source, 'field-1');
      expect(garden.plots[0]!.unknownPlant?.quality).toBeNull();
      expect(() =>
        uprootLegacySpiritGardenPlant(garden, 0, 'field-1:unknown:0', () => 0),
      ).toThrow('品质');
    }
  });

  it('blocks sowing and restoring over an unknown plant', () => {
    const garden = projectLegacySpiritGarden(plots(), 'field-1');
    const seed = readSpiritGardenSeedSpec(
      buildSpiritGardenSeed('licorice', '凡品').details,
    )!.plant;
    expect(() =>
      plantSpiritGardenSeed(garden, 0, seed, 'new-plant', '渡劫', now),
    ).toThrow('空田');
    expect(() =>
      restoreSpiritGardenPlant(garden, 0, 'stored-plant', '渡劫', now),
    ).toThrow('空田');
    expect(() =>
      plantSpiritGardenSeed(garden, 1, seed, 'field-1:unknown:0', '渡劫', now),
    ).toThrow('身份重复');
  });

  it('rejects overlapping occupants and identity collisions with current or stored plants', () => {
    const seed = readSpiritGardenSeedSpec(
      buildSpiritGardenSeed('licorice', '凡品').details,
    )!.plant;
    const garden = plantSpiritGardenSeed(
      projectLegacySpiritGarden(plots(), 'field-1'),
      1,
      seed,
      'current-plant',
      '渡劫',
      now,
    );
    const overlapping = structuredClone(garden);
    overlapping.plots[0]!.plant = overlapping.plots[1]!.plant;
    overlapping.plots[1]!.plant = null;
    expect(() => parseSpiritGardenState(overlapping)).toThrow('同一田块');

    const duplicatedUnknown = structuredClone(garden);
    duplicatedUnknown.plots[2]!.unknownPlant = {
      ...duplicatedUnknown.plots[0]!.unknownPlant!,
    };
    expect(() => parseSpiritGardenState(duplicatedUnknown)).toThrow('身份重复');

    for (const state of [
      garden,
      archiveSpiritGardenPlant(garden, 1, 'current-plant', now),
    ]) {
      const duplicatedCurrent = structuredClone(state);
      duplicatedCurrent.plots[0]!.unknownPlant!.id = 'current-plant';
      expect(() => parseSpiritGardenState(duplicatedCurrent)).toThrow(
        '身份重复',
      );
      expect(parseSpiritGardenState(state)).toEqual(state);
    }
  });

  it('uproots once and returns exactly one randomly selected seed of the original quality', () => {
    const garden = projectLegacySpiritGarden(plots(), 'field-1');
    const before = structuredClone(garden);
    const first = uprootLegacySpiritGardenPlant(
      garden,
      0,
      'field-1:unknown:0',
      () => 0,
    );
    const last = uprootLegacySpiritGardenPlant(
      garden,
      0,
      'field-1:unknown:0',
      () => 0.999999,
    );
    expect(first.seed).toMatchObject({ quality: '玄品', quantity: 1 });
    expect(last.seed).toMatchObject({ quality: '玄品', quantity: 1 });
    expect(last.seed.speciesId).not.toBe(first.seed.speciesId);
    expect(first.state.plots[0]).toEqual({ index: 0, plant: null });
    expect(first.state.plots.slice(1)).toEqual(garden.plots.slice(1));
    expect(parseSpiritGardenState(first.state)).toEqual(first.state);
    expect(() =>
      uprootLegacySpiritGardenPlant(
        first.state,
        0,
        'field-1:unknown:0',
        () => 0,
      ),
    ).toThrow('变化');
    expect(garden).toEqual(before);
  });

  it('rejects stale identities, empty or current plots and invalid random values', () => {
    const garden = projectLegacySpiritGarden(plots(), 'field-1');
    expect(() =>
      uprootLegacySpiritGardenPlant(garden, 0, 'other', () => 0),
    ).toThrow('变化');
    expect(() =>
      uprootLegacySpiritGardenPlant(createSpiritGarden(), 0, 'new', () => 0),
    ).toThrow('变化');
    for (const roll of [-1, 1, Number.NaN])
      expect(() =>
        uprootLegacySpiritGardenPlant(
          garden,
          0,
          'field-1:unknown:0',
          () => roll,
        ),
      ).toThrow('随机');
    expect(() =>
      projectLegacySpiritGarden([{ index: 0 }], 'field-1'),
    ).toThrow();
    expect(projectLegacySpiritGarden([], 'field-1')).toEqual(
      createSpiritGarden(),
    );
  });
});

describe('early persisted garden plants', () => {
  function earlyGarden() {
    const state = createSpiritGarden();
    return {
      ...state,
      plots: state.plots.map((plot) =>
        plot.index === 2
          ? {
              index: plot.index,
              plant: {
                id: 'old-seed:2',
                speciesId: 'vermilion_fruit',
                seedName: '赤焰核',
                quality: '灵品',
                activeGrowthMs: 7337428,
                settledAt: now,
                productionMs: 7037428,
                storedProductionMs: 7037428,
                firstYieldGranted: true,
                branch: null,
                evolved: false,
                pending: [
                  { speciesId: 'vermilion_fruit', kind: 'herb', quantity: 1 },
                ],
              },
            }
          : plot,
      ),
      codex: [
        {
          speciesId: 'vermilion_fruit',
          matured: true,
          branches: [],
          evolved: false,
        },
      ],
    };
  }

  it('projects the early garden format as unknown without filling clocks or issuing old harvests', () => {
    const raw = earlyGarden();
    const before = structuredClone(raw);
    expect(() => parseSpiritGardenState(raw)).toThrow();
    const state = readPersistedSpiritGarden(raw, 'field-1');
    expect(state.plots[2]).toEqual({
      index: 2,
      plant: null,
      unknownPlant: {
        id: 'field-1:unknown:2',
        quality: '灵品',
        legacyPlant: raw.plots[2]!.plant,
      },
    });
    expect(state.codex).toEqual([]);
    expect(state.plots[0]).toEqual(raw.plots[0]);
    expect(settleSpiritGarden(state, now + 100 * 86400000)).toEqual(state);
    expect(raw).toEqual(before);
    const cleared = uprootLegacySpiritGardenPlant(
      state,
      2,
      'field-1:unknown:2',
      () => 0,
    );
    expect(cleared.seed).toMatchObject({ quality: '灵品', quantity: 1 });
    expect(
      readPersistedSpiritGarden(cleared.state, 'field-1').plots[2],
    ).toEqual({ index: 2, plant: null });
  });

  it('retains original anomalous facts across other commands and persisted-state reads', () => {
    const raw = earlyGarden();
    const legacyPlant = {
      ...raw.plots[2]!.plant!,
      quality: '无法识别的原种品质',
      originalNotes: { source: 'early-garden', seedName: '旧灵种原名' },
    };
    const source = {
      ...raw,
      plots: raw.plots.map((plot) =>
        plot.index === 2 ? { ...plot, plant: legacyPlant } : plot,
      ),
    };
    const state = readPersistedSpiritGarden(source, 'field-1');
    const seed = readSpiritGardenSeedSpec(
      buildSpiritGardenSeed('licorice', '凡品').details,
    )!.plant;
    const planted = plantSpiritGardenSeed(
      state,
      0,
      seed,
      'current-plant',
      '渡劫',
      now,
    );
    const persisted = readPersistedSpiritGarden(
      JSON.parse(JSON.stringify(planted)),
      'field-1',
    );
    const settled = settleSpiritGarden(persisted, now + 100 * 86_400_000);
    expect(settled.plots[2]!.unknownPlant).toEqual({
      id: 'field-1:unknown:2',
      quality: null,
      legacyPlant,
    });
    expect(settled.plots.flatMap((plot) => plot.plant?.pending ?? [])).toEqual(
      [],
    );
    expect(settled.codex).toEqual([]);
    expect(() =>
      uprootLegacySpiritGardenPlant(settled, 2, 'field-1:unknown:2', () => 0),
    ).toThrow('品质');
    expect(source.plots[2]!.plant).toEqual(legacyPlant);
  });

  it('preserves current plants next to old ones and keeps strict current-state validation', () => {
    const seed = readSpiritGardenSeedSpec(
      buildSpiritGardenSeed('licorice', '凡品').details,
    )!.plant;
    const current = plantSpiritGardenSeed(
      createSpiritGarden(),
      0,
      seed,
      'new-plant',
      '渡劫',
      now,
    );
    const raw = earlyGarden();
    raw.plots[0] = current.plots[0]!;
    const state = readPersistedSpiritGarden(raw, 'field-1');
    expect(state.plots[0]!.plant).toEqual(current.plots[0]!.plant);
    expect(readPersistedSpiritGarden(current, 'field-1')).toEqual(current);
    const invalid = structuredClone(current);
    invalid.plots[0]!.plant!.productionClockMs = -1;
    expect(() => readPersistedSpiritGarden(invalid, 'field-1')).toThrow();
    const mixedInvalid = { ...raw, plots: [...raw.plots] };
    mixedInvalid.plots[0] = invalid.plots[0]!;
    expect(() => readPersistedSpiritGarden(mixedInvalid, 'field-1')).toThrow();
  });
});

import type { LegacySpiritFieldPlotState } from '@daoyou/game-domain/legacy/spirit-field';
import { describe, expect, it } from 'vitest';
import {
  parseSpiritGardenState,
  settleSpiritGarden,
} from '../spirit-field/garden.js';
import { legacySeedPlant } from './seed-fixtures.js';
import { migrateLegacySpiritGarden } from './spirit-field-plots.js';

const start = 1_000_000;
const day = 86_400_000;
function emptyPlots(): LegacySpiritFieldPlotState[] {
  return Array.from({ length: 6 }, (_, index) => ({
    index,
    plantId: null,
    plant: null,
    plantedAt: null,
    stageIndex: 0,
    stageStartedAt: null,
    stageEndsAt: null,
    history: [],
  }));
}
function readyPlot(): LegacySpiritFieldPlotState {
  const plant = {
    ...legacySeedPlant,
    id: 'legacy-growing',
    seedName: '旧日灵种',
    baseYieldMin: 4,
    baseYieldMax: 4,
  };
  return {
    index: 0,
    plant,
    plantId: plant.id,
    plantedAt: new Date(start).toISOString(),
    stageIndex: 2,
    stageStartedAt: new Date(start).toISOString(),
    stageEndsAt: new Date(start + 60_000).toISOString(),
    history: [
      {
        stage: 'forming',
        method: 'leaf_medicine',
        affinity: 'excellent',
        score: 100,
        feedback: '灵机顺畅。',
        completedAt: new Date(start).toISOString(),
      },
    ],
  };
}

describe('published short-term plot conversion', () => {
  it('keeps the original ready harvest without backfilling years of recurring production', () => {
    const plots = emptyPlots();
    plots[0] = readyPlot();
    const now = start + 100 * day;
    const before = structuredClone(plots);
    const migrated = migrateLegacySpiritGarden(plots, now, 'field-1');
    const plant = migrated.plots[0]!.plant!;
    expect(plant.firstYieldGranted).toBe(true);
    expect(plant.pending).toEqual([
      expect.objectContaining({ kind: 'herb', quality: '玄品', quantity: 5 }),
    ]);
    expect(plant.productionUsedMs).toBe(0);
    expect(plant.productionClockMs).toBe(0);
    expect(migrated.codex).toContainEqual(
      expect.objectContaining({ speciesId: plant.speciesId, matured: true }),
    );
    expect(
      settleSpiritGarden(migrated, now + 1).plots[0]!.plant!.pending,
    ).toEqual(plant.pending);
    expect(migrateLegacySpiritGarden(plots, now, 'field-1')).toEqual(migrated);
    expect(parseSpiritGardenState(migrated)).toEqual(migrated);
    expect(plots).toEqual(before);
  });
  it('carries incomplete growth forward without granting paid maturity or a first harvest', () => {
    const plots = emptyPlots();
    plots[0] = {
      ...readyPlot(),
      stageIndex: 1,
      stageEndsAt: new Date(start + 120_000).toISOString(),
    };
    const migrated = migrateLegacySpiritGarden(
      plots,
      start + 60_000,
      'field-1',
    );
    const plant = migrated.plots[0]!.plant!;
    expect(plant.activeGrowthMs).toBe(15 * 60_000);
    expect(plant.firstYieldGranted).toBe(false);
    expect(plant.pending).toEqual([]);
    expect(plant.productionUsedMs).toBe(0);
  });
  it('accepts empty archives and rejects broken ownership, stage, time or growing facts', () => {
    expect(
      migrateLegacySpiritGarden([], start).plots.every(
        (plot) => plot.plant === null,
      ),
    ).toBe(true);
    expect(() => migrateLegacySpiritGarden([{ index: 0 }], start)).toThrow();
    for (const change of [
      { plantId: 'orphan' },
      { plant: { ...readyPlot().plant!, quality: '不存在' } },
      { stageIndex: 4 },
      { stageStartedAt: 'bad-time' },
    ]) {
      const plots = emptyPlots();
      plots[0] = { ...readyPlot(), ...change } as LegacySpiritFieldPlotState;
      expect(() => migrateLegacySpiritGarden(plots, start)).toThrow();
    }
    const orphan = emptyPlots();
    orphan[0]!.plantId = 'orphan';
    expect(() => migrateLegacySpiritGarden(orphan, start)).toThrow('无法识别');
  });
});

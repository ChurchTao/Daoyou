import { seedFactsOf } from '@daoyou/game-domain/inventory';
import {
  readSpiritFieldSeedSpec,
  type SpiritFieldPlotState,
} from '@daoyou/game-domain/spirit-field';
import { describe, expect, it } from 'vitest';
import { inventoryStackIdentity } from '../inventory/stack-key.js';
import {
  SPIRIT_GARDEN_COLLECTION_LIMIT,
  SPIRIT_GARDEN_OFFLINE_CAP_MS,
  SPIRIT_GARDEN_SPECIES,
  SpiritGardenStateSchema,
  archiveSpiritGardenPlant,
  buildSpiritGardenSeed,
  chooseSpiritGardenBranch,
  createSpiritGarden,
  evolveSpiritGardenPlant,
  getSpiritGardenMaturedCount,
  getSpiritGardenOutput,
  getSpiritGardenPlantView,
  getSpiritGardenSeedCandidates,
  getSpiritGardenSpecies,
  harvestSpiritGarden,
  migrateLegacySpiritGarden,
  parseSpiritGardenState,
  plantSpiritGardenSeed,
  resolveSpiritGardenSpecies,
  restoreSpiritGardenPlant,
  retireSpiritGardenPlant,
  settleSpiritGarden,
} from './garden.js';
import {
  createDefaultSpiritFieldPlots,
  settleSpiritFieldHarvest,
} from './rules.js';

const start = 1_000_000;
const hour = 3_600_000;
const day = 24 * hour;
const lifetime = 28 * day;
function seed(
  speciesId: Parameters<typeof buildSpiritGardenSeed>[0] = 'licorice',
  quality: Parameters<typeof buildSpiritGardenSeed>[1] = '凡品',
) {
  return readSpiritFieldSeedSpec(
    buildSpiritGardenSeed(speciesId, quality).details,
  )!.plant;
}
function planted() {
  return plantSpiritGardenSeed(
    createSpiritGarden(),
    0,
    seed(),
    'plant-1',
    '炼气',
    start,
  );
}
const at = (offset: number) => start + offset;
const matureMs = getSpiritGardenSpecies('licorice').matureMs;

describe('long-term spirit garden', () => {
  it('grows automatically and grants the first yield exactly once at maturity', () => {
    const initial = planted();
    expect(
      settleSpiritGarden(initial, at(matureMs - 1)).plots[0]!.plant!.pending,
    ).toEqual([]);
    const mature = settleSpiritGarden(initial, at(matureMs));
    expect(mature.plots[0]!.plant!.pending[0]!.quantity).toBe(1);
    expect(mature.plots[0]!.plant!.productionUsedMs).toBe(0);
    expect(
      settleSpiritGarden(mature, at(matureMs)).plots[0]!.plant!.pending[0]!
        .quantity,
    ).toBe(1);
    expect(initial.plots[0]!.plant!.activeGrowthMs).toBe(0);
  });
  it('only produces for time after maturity and keeps a partial cycle across claims', () => {
    const state = settleSpiritGarden(planted(), at(matureMs + 3 * hour));
    expect(state.plots[0]!.plant!.pending[0]!.quantity).toBe(1);
    const claimed = harvestSpiritGarden(state, at(matureMs + 3 * hour));
    expect(claimed.state.plots[0]!.plant!.productionMs).toBe(3 * hour);
    expect(claimed.state.plots[0]!.plant!.activeGrowthMs).toBe(
      matureMs + 3 * hour,
    );
    const later = settleSpiritGarden(claimed.state, at(matureMs + 4 * hour));
    expect(later.plots[0]!.plant!.pending[0]!.quantity).toBe(1);
  });
  it('does not allow claiming the same yield twice or clearing the permanent plant', () => {
    const result = harvestSpiritGarden(planted(), at(matureMs));
    expect(result.products).toHaveLength(1);
    expect(result.state.plots[0]!.plant!.id).toBe('plant-1');
    expect(() => harvestSpiritGarden(result.state, at(matureMs))).toThrow(
      '没有可领取',
    );
    expect(getSpiritGardenMaturedCount(result.state)).toBe(1);
  });
  it('caps total unclaimed production at seven days even when visited repeatedly', () => {
    let state = planted();
    for (let days = 1; days <= 21; days += 1)
      state = settleSpiritGarden(state, at(matureMs + days * day));
    expect(state.plots[0]!.plant!.storedProductionMs).toBe(
      SPIRIT_GARDEN_OFFLINE_CAP_MS,
    );
    expect(state.plots[0]!.plant!.productionUsedMs).toBe(7 * day);
    expect(state.plots[0]!.plant!.pending[0]!.quantity).toBe(43);
    const oneVisit = settleSpiritGarden(planted(), at(matureMs + 21 * day));
    expect(state.plots[0]!.plant!.pending).toEqual(
      oneVisit.plots[0]!.plant!.pending,
    );
    expect(
      getSpiritGardenPlantView(state.plots[0]!.plant!, '炼气').storageFull,
    ).toBe(true);
    const claim = harvestSpiritGarden(state, at(matureMs + 21 * day));
    const resumed = settleSpiritGarden(
      claim.state,
      at(matureMs + 21 * day + 4 * hour),
    ).plots[0]!.plant!;
    expect(resumed.pending[0]!.quantity).toBe(1);
    expect(resumed.productionUsedMs).toBe(7 * day + 4 * hour);
  });
  it('keeps old material yields and carries partial growing time into a new branch', () => {
    const changed = chooseSpiritGardenBranch(
      planted(),
      0,
      'plant-1',
      'essence',
      at(day),
    );
    const plant = changed.plots[0]!.plant!;
    expect(plant.pending.every((product) => product.kind === 'herb')).toBe(
      true,
    );
    expect(plant.productionMs).toBe(4 * hour - matureMs);
    const fruit = settleSpiritGarden(changed, at(day + 12 * hour)).plots[0]!
      .plant!;
    expect(
      fruit.pending.find((product) => product.kind === 'spirit_fruit')
        ?.quantity,
    ).toBe(1);
    const producedFruit = fruit.pending.find(
      (product) => product.kind === 'spirit_fruit',
    );
    expect(
      producedFruit?.fruitEffects?.[0]?.family ?? producedFruit?.fruitFamily,
    ).toBe('detox');
    expect(() =>
      chooseSpiritGardenBranch(changed, 0, 'plant-1', 'abundance', at(day + 1)),
    ).toThrow('已经选定');
  });
  it('preserves an almost completed cycle when selecting a branch', () => {
    const decisionAt = at(matureMs + 7 * 4 * hour - 60_000);
    const before = settleSpiritGarden(planted(), decisionAt);
    const changed = chooseSpiritGardenBranch(
      before,
      0,
      'plant-1',
      'abundance',
      decisionAt,
    );
    expect(changed.plots[0]!.plant!.productionMs).toBe(4 * hour - 60_000);
    expect(changed.plots[0]!.plant!.pending).toEqual(
      before.plots[0]!.plant!.pending,
    );
    expect(
      getSpiritGardenPlantView(changed.plots[0]!.plant!, '炼气').nextYieldMs,
    ).toBe(60_000);
    const after = settleSpiritGarden(changed, decisionAt + 60_000);
    expect(after.plots[0]!.plant!.pending[0]!.quantity).toBe(
      before.plots[0]!.plant!.pending[0]!.quantity + 2,
    );
  });
  it('preserves an almost completed cycle through evolution without upgrading completed yields', () => {
    const branched = chooseSpiritGardenBranch(
      planted(),
      0,
      'plant-1',
      'essence',
      at(day),
    );
    const grown = settleSpiritGarden(branched, at(3 * day));
    const decisionAt =
      at(3 * day) + 12 * hour - grown.plots[0]!.plant!.productionMs - 60_000;
    const before = settleSpiritGarden(grown, decisionAt);
    const evolved = evolveSpiritGardenPlant(
      before,
      0,
      'plant-1',
      '筑基',
      decisionAt,
    );
    expect(evolved.plots[0]!.plant!.productionMs).toBe(12 * hour - 60_000);
    expect(evolved.plots[0]!.plant!.productionUsedMs).toBe(
      decisionAt - start - matureMs,
    );
    expect(evolved.plots[0]!.plant!.pending).toEqual(
      before.plots[0]!.plant!.pending,
    );
    expect(
      getSpiritGardenPlantView(evolved.plots[0]!.plant!, '筑基').nextYieldMs,
    ).toBe(60_000);
    const after = settleSpiritGarden(evolved, decisionAt + 60_000);
    expect(
      after.plots[0]!.plant!.pending.filter(
        (product) => product.quality === '凡品',
      ),
    ).toEqual(before.plots[0]!.plant!.pending);
    expect(
      after.plots[0]!.plant!.pending.find(
        (product) => product.quality === '灵品',
      )?.quantity,
    ).toBe(1);
  });
  it('keeps cultivation transitions compatible with existing partial-cycle progress for every species and quality', () => {
    const original = planted().plots[0]!.plant!;
    for (const species of SPIRIT_GARDEN_SPECIES) {
      const plant = {
        ...original,
        speciesId: species.id,
        quality: species.quality,
      };
      const base = getSpiritGardenOutput(plant).cycleMs;
      for (const branch of ['abundance', 'essence'] as const) {
        const output = getSpiritGardenOutput({ ...plant, branch });
        const evolved = { ...plant, branch, evolved: true };
        expect(output.cycleMs).toBeGreaterThanOrEqual(base);
        expect(getSpiritGardenOutput(evolved).cycleMs).toBe(output.cycleMs);
      }
    }
  });
  it('rejects early branch choices but keeps production running while a choice waits', () => {
    expect(() =>
      chooseSpiritGardenBranch(planted(), 0, 'plant-1', 'essence', at(day - 1)),
    ).toThrow('尚未蕴灵');
    const later = settleSpiritGarden(planted(), at(2 * day));
    expect(later.plots[0]!.plant!.pending[0]!.quantity).toBeGreaterThan(1);
    expect(
      getSpiritGardenPlantView(later.plots[0]!.plant!, '炼气').canBranch,
    ).toBe(true);
  });
  it('evolves once with realm and growth requirements, without upgrading old pending products', () => {
    const branched = chooseSpiritGardenBranch(
      planted(),
      0,
      'plant-1',
      'abundance',
      at(day),
    );
    expect(() =>
      evolveSpiritGardenPlant(branched, 0, 'plant-1', '筑基', at(3 * day - 1)),
    ).toThrow('积累尚不足');
    expect(() =>
      evolveSpiritGardenPlant(branched, 0, 'plant-1', '炼气', at(3 * day)),
    ).toThrow('筑基');
    const evolved = evolveSpiritGardenPlant(
      branched,
      0,
      'plant-1',
      '筑基',
      at(3 * day),
    );
    expect(
      evolved.plots[0]!.plant!.pending.every(
        (product) => product.quality === '凡品',
      ),
    ).toBe(true);
    const later = settleSpiritGarden(evolved, at(3 * day + 4 * hour));
    expect(
      later.plots[0]!.plant!.pending.find(
        (product) => product.quality === '灵品',
      )?.quantity,
    ).toBe(2);
    expect(() =>
      evolveSpiritGardenPlant(evolved, 0, 'plant-1', '渡劫', at(4 * day)),
    ).toThrow('已经完成');
    expect(evolved.codex[0]!.evolved).toBe(true);
  });
  it('preserves a transplanted plant and pauses all growth and production in collection', () => {
    const archived = archiveSpiritGardenPlant(
      planted(),
      0,
      'plant-1',
      at(matureMs + hour),
    );
    const original = archived.collection[0]!;
    expect(original.productionUsedMs).toBe(hour);
    const waiting = settleSpiritGarden(archived, at(30 * day));
    expect(waiting.collection[0]).toEqual(original);
    const restored = restoreSpiritGardenPlant(
      waiting,
      1,
      'plant-1',
      '炼气',
      at(30 * day),
    );
    expect(restored.plots[1]!.plant!.activeGrowthMs).toBe(
      original.activeGrowthMs,
    );
    const later = settleSpiritGarden(restored, at(30 * day + 3 * hour));
    expect(later.plots[1]!.plant!.pending[0]!.quantity).toBe(2);
    expect(later.plots[1]!.plant!.productionUsedMs).toBe(4 * hour);
    expect(restored.collection).toHaveLength(0);
  });
  it('claims frozen collection yields without resuming collection growth', () => {
    const archived = archiveSpiritGardenPlant(
      planted(),
      0,
      'plant-1',
      at(matureMs),
    );
    const result = harvestSpiritGarden(archived, at(10 * day));
    expect(result.products[0]!.quantity).toBe(1);
    expect(result.state.collection[0]!.activeGrowthMs).toBe(matureMs);
    expect(result.state.collection[0]!.pending).toEqual([]);
  });
  it('requires collecting pending assets before retiring a dormant plant', () => {
    const archived = archiveSpiritGardenPlant(
      planted(),
      0,
      'plant-1',
      at(matureMs),
    );
    expect(() => retireSpiritGardenPlant(archived, 'plant-1', at(day))).toThrow(
      '先领取',
    );
    expect(archived.collection[0]!.pending[0]!.quantity).toBe(1);
    const claimed = harvestSpiritGarden(archived, at(day)).state;
    const retired = retireSpiritGardenPlant(claimed, 'plant-1', at(day));
    expect(retired.collection).toEqual([]);
    expect(retired.codex).toEqual(claimed.codex);
    expect(getSpiritGardenMaturedCount(retired)).toBe(1);
    expect(claimed.collection).toHaveLength(1);
  });
  it('refuses to retire an active plant or an unknown identity', () => {
    const state = planted();
    expect(() => retireSpiritGardenPlant(state, 'plant-1', at(day))).toThrow(
      '收藏中没有找到',
    );
    expect(() => retireSpiritGardenPlant(state, 'unknown', at(day))).toThrow(
      '收藏中没有找到',
    );
    expect(state.plots[0]!.plant!.id).toBe('plant-1');
  });
  it('delivers the final completed round exactly once and only clears it after harvest', () => {
    let state = planted();
    for (const days of [7, 14, 21]) {
      state = harvestSpiritGarden(state, at(matureMs + days * day)).state;
    }
    const terminalAt = at(matureMs + lifetime);
    const nearlySpent = settleSpiritGarden(state, terminalAt - hour);
    const growing = nearlySpent.plots[0]!.plant!;
    expect(getSpiritGardenPlantView(growing, '炼气')).toMatchObject({
      remainingProductionMs: hour,
      remainingHarvestCycles: 1,
      exhausted: false,
    });
    expect(() =>
      retireSpiritGardenPlant(nearlySpent, 'plant-1', terminalAt - hour, 0),
    ).toThrow('尚未采尽');

    const spent = settleSpiritGarden(nearlySpent, terminalAt + day);
    expect(
      getSpiritGardenPlantView(spent.plots[0]!.plant!, '筑基'),
    ).toMatchObject({
      remainingProductionMs: 0,
      remainingHarvestCycles: 0,
      exhausted: true,
      canBranch: false,
      canEvolve: false,
    });
    expect(() =>
      chooseSpiritGardenBranch(
        spent,
        0,
        'plant-1',
        'essence',
        terminalAt + day,
      ),
    ).toThrow('已经采尽');
    expect(() =>
      archiveSpiritGardenPlant(spent, 0, 'plant-1', terminalAt + day),
    ).toThrow('已经采尽');
    expect(() =>
      retireSpiritGardenPlant(spent, 'plant-1', terminalAt + day, 0),
    ).toThrow('先领取');
    const harvested = harvestSpiritGarden(spent, terminalAt + day);
    expect(harvested.products[0]!.quantity).toBe(42);
    expect(() =>
      harvestSpiritGarden(harvested.state, terminalAt + 2 * day),
    ).toThrow('没有可领取');
    expect(() =>
      retireSpiritGardenPlant(harvested.state, 'other', terminalAt + day, 0),
    ).toThrow('已经变化');
    const cleared = retireSpiritGardenPlant(
      harvested.state,
      'plant-1',
      terminalAt + day,
      0,
    );
    expect(cleared.plots[0]!.plant).toBeNull();
    expect(getSpiritGardenMaturedCount(cleared)).toBe(1);
    const resown = plantSpiritGardenSeed(
      cleared,
      0,
      seed(),
      'plant-2',
      '炼气',
      terminalAt + day,
    );
    expect(resown.plots[0]!.plant!.productionUsedMs).toBe(0);
  });
  it('discards only the unfinished final cycle when the budget runs out', () => {
    const branched = chooseSpiritGardenBranch(
      planted(),
      0,
      'plant-1',
      'essence',
      at(day),
    );
    let state = branched;
    for (const days of [6, 12, 18, 24]) {
      state = harvestSpiritGarden(state, at(matureMs + days * day)).state;
    }
    const terminalAt = at(matureMs + lifetime);
    const spent = settleSpiritGarden(state, terminalAt + day);
    expect(spent.plots[0]!.plant).toMatchObject({
      productionUsedMs: lifetime,
      productionMs: 0,
      pending: [{ kind: 'spirit_fruit', quantity: 8 }],
    });
    expect(() =>
      evolveSpiritGardenPlant(spent, 0, 'plant-1', '筑基', terminalAt + day),
    ).toThrow('已经采尽');
  });
  it('accepts saves without lifetime history and starts counting from saved settlement', () => {
    const before = settleSpiritGarden(planted(), at(matureMs + 5 * hour));
    const plot = before.plots[0]!;
    const { productionUsedMs, ...legacy } = plot.plant!;
    expect(productionUsedMs).toBe(5 * hour);
    const upgraded = parseSpiritGardenState({
      ...before,
      plots: [{ ...plot, plant: legacy }, ...before.plots.slice(1)],
    });
    expect(upgraded.plots[0]!.plant).toEqual({
      ...legacy,
      productionUsedMs: 0,
    });
    const later = settleSpiritGarden(upgraded, at(matureMs + 8 * hour));
    expect(later.plots[0]!.plant!.productionUsedMs).toBe(3 * hour);
    expect(later.plots[0]!.plant!.pending[0]!.quantity).toBe(3);
  });
  it('checks empty slots, plant identity, realm and collection capacity', () => {
    expect(() =>
      plantSpiritGardenSeed(planted(), 0, seed(), 'other', '炼气', start),
    ).toThrow('空田');
    expect(() =>
      plantSpiritGardenSeed(
        createSpiritGarden(),
        0,
        seed('spirit_rice', '灵品'),
        'other',
        '炼气',
        start,
      ),
    ).toThrow('境界不足');
    expect(() =>
      archiveSpiritGardenPlant(planted(), 0, 'stale-id', at(day)),
    ).toThrow('已经变化');
    const full = {
      ...planted(),
      collection: Array.from(
        { length: SPIRIT_GARDEN_COLLECTION_LIMIT },
        (_, index) => ({
          ...planted().plots[0]!.plant!,
          id: `stored-${index}`,
        }),
      ),
    };
    expect(() => archiveSpiritGardenPlant(full, 0, 'plant-1', at(day))).toThrow(
      '收藏已满',
    );
  });
  it('records each mature species once without changing the permanent plants', () => {
    let state = createSpiritGarden();
    for (const [index, speciesId] of (
      ['licorice', 'wild_chrysanthemum', 'mountain_jujube'] as const
    ).entries())
      state = plantSpiritGardenSeed(
        state,
        index,
        seed(speciesId),
        `plant-${index}`,
        '炼气',
        start,
      );
    state = settleSpiritGarden(state, at(matureMs));
    expect(getSpiritGardenMaturedCount(state)).toBe(3);
    state = settleSpiritGarden(state, at(2 * day));
    expect(getSpiritGardenMaturedCount(state)).toBe(3);
  });
  it('keeps fixed same-species seeds stackable', () => {
    const first = buildSpiritGardenSeed('licorice', '凡品');
    const again = buildSpiritGardenSeed('licorice', '凡品', 4);
    expect(readSpiritFieldSeedSpec(first.details)!.plant.seedName).toBe(
      '甘草的种子',
    );
    expect(inventoryStackIdentity('seed.v1', seedFactsOf(first))).toBe(
      inventoryStackIdentity('seed.v1', seedFactsOf(again)),
    );
    expect(inventoryStackIdentity('seed.v1', seedFactsOf(first))).not.toBe(
      inventoryStackIdentity(
        'seed.v1',
        seedFactsOf(buildSpiritGardenSeed('wild_chrysanthemum', '凡品')),
      ),
    );
  });
  it('honors stored garden seed identities before name and element hints', () => {
    expect(
      resolveSpiritGardenSpecies({
        ...seed('licorice'),
        seedName: '野菊的种子',
        element: '风',
      }),
    ).toBe('licorice');
    expect(() => buildSpiritGardenSeed('gold_thunder_bamboo', '玄品')).toThrow(
      '品质不符',
    );
  });
  it('selects only catalog species of the requested grade and element', () => {
    expect(getSpiritGardenSeedCandidates('凡品')).toHaveLength(4);
    expect(
      getSpiritGardenSeedCandidates('天品', '雷').map((species) => species.id),
    ).toEqual(['gold_thunder_bamboo']);
    expect(getSpiritGardenSeedCandidates('凡品', '雷')).toEqual([]);
  });
  it('finds a current species for seeds issued before the catalog', () => {
    expect(
      resolveSpiritGardenSpecies({
        ...seed('licorice'),
        id: 'pre-garden-seed',
        seedName: '旧日风灵种',
        element: '风',
      }),
    ).toBe('wild_chrysanthemum');
  });
  it('rejects unknown species, mismatched quality and forged compound-effect budgets in durable state', () => {
    const original = planted().plots[0]!.plant!;
    const valid = planted();
    const invalidSpecies = {
      ...valid,
      plots: [
        { index: 0, plant: { ...original, speciesId: 'made-up-species' } },
        ...valid.plots.slice(1),
      ],
    };
    expect(SpiritGardenStateSchema.safeParse(invalidSpecies).success).toBe(
      false,
    );
    const high = getSpiritGardenSpecies('spirit_rice');
    expect(
      SpiritGardenStateSchema.safeParse({
        ...valid,
        plots: [
          { index: 0, plant: { ...original, speciesId: high.id } },
          ...valid.plots.slice(1),
        ],
      }).success,
    ).toBe(false);
    expect(
      SpiritGardenStateSchema.safeParse({
        ...valid,
        plots: [
          {
            index: 0,
            plant: {
              ...original,
              pending: [
                {
                  speciesId: original.speciesId,
                  name: '虚构复合果',
                  description: '',
                  element: '木',
                  kind: 'spirit_fruit',
                  quality: '凡品',
                  quantity: 1,
                  fruitEffects: [
                    { family: 'healing', share: 1 },
                    { family: 'mana', share: 1 },
                  ],
                },
              ],
            },
          },
          ...valid.plots.slice(1),
        ],
      }).success,
    ).toBe(false);
  });
  it('does not advance when the wall clock moves backwards', () => {
    const settled = settleSpiritGarden(planted(), at(matureMs));
    expect(settleSpiritGarden(settled, start).plots[0]!.plant).toEqual(
      settled.plots[0]!.plant,
    );
  });
  it('validates durable state and refuses duplicate identities or invalid production', () => {
    expect(parseSpiritGardenState(planted())).toEqual(planted());
    expect(() =>
      parseSpiritGardenState({
        ...planted(),
        collection: [planted().plots[0]!.plant!],
      }),
    ).toThrow();
    const plant = {
      ...planted().plots[0]!.plant!,
      productionMs: 4 * hour,
      storedProductionMs: 4 * hour,
    };
    expect(() =>
      parseSpiritGardenState({
        ...planted(),
        plots: [{ index: 0, plant }, ...planted().plots.slice(1)],
      }),
    ).toThrow();
  });
});

describe('legacy garden migration', () => {
  function readyPlot(): SpiritFieldPlotState {
    const plant = { ...seed(), id: 'pre-garden-growing', seedName: '旧日灵种' };
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
  it('retains the original deterministic ready harvest and does not grant another first yield', () => {
    const plots = createDefaultSpiritFieldPlots();
    plots[0] = readyPlot();
    const expected = settleSpiritFieldHarvest(
      plots[0],
      `field-1:0:${plots[0]!.plantedAt}:${plots[0]!.plant!.id}`,
    );
    const migrated = migrateLegacySpiritGarden(plots, at(100 * day), 'field-1');
    const plant = migrated.plots[0]!.plant!;
    expect(plant.pending[0]!.quantity).toBe(expected.quantity);
    expect(plant.pending[0]!.quality).toBe(expected.quality);
    expect(plant.pending[0]!.kind).toBe(expected.outcomeKind);
    expect(plant.firstYieldGranted).toBe(true);
    expect(
      settleSpiritGarden(migrated, at(100 * day + 1)).plots[0]!.plant!.pending,
    ).toEqual(plant.pending);
    expect(parseSpiritGardenState(migrated)).toEqual(migrated);
  });
  it('rejects corrupted assets instead of replacing them with empty plots', () => {
    expect(() => migrateLegacySpiritGarden([{ index: 0 }], start)).toThrow();
    const plots = createDefaultSpiritFieldPlots();
    plots[0] = {
      ...readyPlot(),
      plant: { ...seed(), quality: '不存在' as never },
    };
    expect(() => migrateLegacySpiritGarden(plots, start)).toThrow();
    const orphan = createDefaultSpiritFieldPlots();
    orphan[0] = { ...orphan[0]!, plantId: 'orphan' };
    expect(() => migrateLegacySpiritGarden(orphan, start)).toThrow('无法识别');
    const mismatched = createDefaultSpiritFieldPlots();
    mismatched[0] = { ...readyPlot(), plantId: 'other' };
    expect(() => migrateLegacySpiritGarden(mismatched, start)).toThrow(
      '身份不一致',
    );
  });
});

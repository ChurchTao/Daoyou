import { seedFactsOf } from '@daoyou/game-domain/inventory';
import {
  readSpiritGardenSeedSpec,
  type SpiritGardenSpeciesId,
} from '@daoyou/game-domain/spirit-field';
import { describe, expect, it } from 'vitest';
import { inventoryStackIdentity } from '../inventory/stack-key.js';
import {
  SPIRIT_GARDEN_COLLECTION_LIMIT,
  SpiritGardenStateSchema,
  archiveSpiritGardenPlant,
  buildSpiritGardenSeed,
  chooseSpiritGardenBranch,
  clearSpiritGardenPlot,
  createSpiritGarden,
  evolveSpiritGardenPlant,
  getSpiritGardenBranchPreview,
  getSpiritGardenMaturedCount,
  getSpiritGardenPlantView,
  getSpiritGardenSeedCandidates,
  getSpiritGardenSpecies,
  harvestSpiritGarden,
  isSpiritGardenSeed,
  matureSpiritGardenPlant,
  parseSpiritGardenState,
  plantSpiritGardenSeed,
  resolveSpiritGardenSpecies,
  restoreSpiritGardenPlant,
  retireSpiritGardenPlant,
  settleSpiritGarden,
} from './garden.js';

const start = 1_000_000;
const hour = 3_600_000;
const day = 24 * hour;
const lifetime = 28 * day;
// This identity has no incidents, isolating the baseline cultivation rules.
const plantId = 'quiet-plant-2';
function seed(
  speciesId: Parameters<typeof buildSpiritGardenSeed>[0] = 'licorice',
  quality: Parameters<typeof buildSpiritGardenSeed>[1] = '凡品',
) {
  return readSpiritGardenSeedSpec(
    buildSpiritGardenSeed(speciesId, quality).details,
  )!.plant;
}
function seedling(speciesId: SpiritGardenSpeciesId = 'licorice') {
  const species = getSpiritGardenSpecies(speciesId);
  return plantSpiritGardenSeed(
    createSpiritGarden(),
    0,
    seed(speciesId, species.quality),
    plantId,
    '渡劫',
    start,
  );
}
function planted(speciesId: SpiritGardenSpeciesId = 'licorice') {
  const initial = seedling(speciesId);
  const readyAt =
    start + getSpiritGardenPlantView(initial.plots[0]!.plant!, '渡劫').matureMs;
  return matureSpiritGardenPlant(initial, 0, plantId, readyAt);
}
const matureMs = 5 * 60_000;
const at = (offset: number) => start + matureMs + offset;
const herbCycleMs = 8 * hour;
function branched() {
  return chooseSpiritGardenBranch(planted(), 0, plantId, 'abundance', at(day));
}
function evolutionReady() {
  return settleSpiritGarden(branched(), at(4 * day));
}

describe('long-term spirit garden', () => {
  it('waits for paid maturity without producing, aging past the gate or consuming lifetime', () => {
    const initial = seedling();
    expect(() =>
      matureSpiritGardenPlant(initial, 0, plantId, start + matureMs - 1),
    ).toThrow();
    const waiting = settleSpiritGarden(initial, start + 30 * day);
    expect(waiting.plots[0]!.plant).toMatchObject({
      activeGrowthMs: matureMs,
      firstYieldGranted: false,
      productionUsedMs: 0,
      productionClockMs: 0,
      branch: null,
      pending: [],
    });
    expect(
      getSpiritGardenPlantView(waiting.plots[0]!.plant!, '渡劫').stage,
    ).toBe('seedling');
    expect(getSpiritGardenMaturedCount(waiting)).toBe(0);
    expect(
      getSpiritGardenPlantView(waiting.plots[0]!.plant!, '渡劫').canMature,
    ).toBe(true);
    expect(() => harvestSpiritGarden(waiting, start + 30 * day)).toThrow();
    expect(() =>
      chooseSpiritGardenBranch(
        waiting,
        0,
        plantId,
        'abundance',
        start + 30 * day,
      ),
    ).toThrow();
    expect(initial.plots[0]!.plant!.activeGrowthMs).toBe(0);
  });
  it('grants exactly one first yield on paid maturity and cannot jump to later stages with stockpiled seedling time', () => {
    const paidAt = start + 30 * day;
    const mature = matureSpiritGardenPlant(seedling(), 0, plantId, paidAt);
    expect(mature.plots[0]!.plant).toMatchObject({
      firstYieldGranted: true,
      productionUsedMs: 0,
      productionClockMs: 0,
      pending: [{ quantity: 1 }],
    });
    expect(() => matureSpiritGardenPlant(mature, 0, plantId, paidAt)).toThrow();
    expect(() =>
      chooseSpiritGardenBranch(
        mature,
        0,
        plantId,
        'abundance',
        paidAt + day - 1,
      ),
    ).toThrow();
    const branch = chooseSpiritGardenBranch(
      mature,
      0,
      plantId,
      'abundance',
      paidAt + day,
    );
    expect(branch.plots[0]!.plant!.branchAtProductionMs).toBe(day);
    expect(() =>
      evolveSpiritGardenPlant(branch, 0, plantId, '渡劫', paidAt + 3 * day, 0),
    ).toThrow();
    const evolved = evolveSpiritGardenPlant(
      branch,
      0,
      plantId,
      '渡劫',
      paidAt + 4 * day,
      0,
    );
    expect(evolved.plots[0]!.plant!.evolved).toBe(true);
  });
  it('does not change the displayed stage merely because a paid mature plant can branch', () => {
    const ready = settleSpiritGarden(planted(), at(2 * day));
    expect(
      getSpiritGardenPlantView(ready.plots[0]!.plant!, '渡劫'),
    ).toMatchObject({ stage: 'mature', canBranch: true });
    expect(ready.plots[0]!.plant!.branch).toBeNull();
    const branch = chooseSpiritGardenBranch(
      ready,
      0,
      plantId,
      'abundance',
      at(2 * day),
    );
    expect(
      getSpiritGardenPlantView(branch.plots[0]!.plant!, '渡劫').stage,
    ).toBe('nurtured');
  });
  it('keeps a partial production cycle across claims without granting it twice', () => {
    const claimed = harvestSpiritGarden(planted(), at(3 * hour));
    expect(claimed.products[0]!.quantity).toBe(1);
    expect(claimed.state.plots[0]!.plant!.productionMs).toBe(3 * hour);
    expect(() => harvestSpiritGarden(claimed.state, at(3 * hour))).toThrow();
    const later = settleSpiritGarden(claimed.state, at(herbCycleMs));
    expect(later.plots[0]!.plant!.pending[0]!.quantity).toBe(1);
    expect(later.plots[0]!.plant!.productionUsedMs).toBe(herbCycleMs);
  });
  it('caps unclaimed production at seven days across repeated visits and resumes after claiming', () => {
    let state = planted();
    for (let days = 1; days <= 21; days += 1)
      state = settleSpiritGarden(state, at(days * day));
    expect(state.plots[0]!.plant).toMatchObject({
      storedProductionMs: 7 * day,
      productionUsedMs: 7 * day,
      productionClockMs: 7 * day,
      pending: [{ quantity: 22 }],
    });
    expect(state).toEqual(settleSpiritGarden(planted(), at(21 * day)));
    expect(
      getSpiritGardenPlantView(state.plots[0]!.plant!, '渡劫').storageFull,
    ).toBe(true);
    const claim = harvestSpiritGarden(state, at(21 * day));
    const resumed = settleSpiritGarden(claim.state, at(21 * day + herbCycleMs));
    expect(resumed.plots[0]!.plant).toMatchObject({
      productionUsedMs: 7 * day + herbCycleMs,
      pending: [{ quantity: 1 }],
    });
  });
  it('keeps half completion when a late branch shortens the divine herb cycle, without granting extra fruit', () => {
    const initial = planted('qilin_elixir');
    const paidAt = initial.plots[0]!.plant!.settledAt;
    const claimed = harvestSpiritGarden(initial, paidAt + 94 * hour).state;
    const decisionAt = paidAt + 141 * hour;
    const before = settleSpiritGarden(claimed, decisionAt);
    expect(before.plots[0]!.plant!.productionMs).toBe(47 * hour);
    const changed = chooseSpiritGardenBranch(
      before,
      0,
      plantId,
      'essence',
      decisionAt,
    );
    expect(changed.plots[0]!.plant).toMatchObject({
      pending: [],
      productionMs: 6 * hour,
      storedProductionMs: 6 * hour,
      productionUsedMs: 141 * hour,
    });
    expect(
      settleSpiritGarden(changed, decisionAt + 6 * hour - 1).plots[0]!.plant!
        .pending,
    ).toEqual([]);
    expect(
      settleSpiritGarden(changed, decisionAt + 6 * hour).plots[0]!.plant!
        .pending,
    ).toMatchObject([{ kind: 'spirit_fruit', quantity: 1 }]);
    expect(parseSpiritGardenState(changed)).toEqual(changed);
  });
  it.each([
    { speciesId: 'licorice', decisionHours: 28, waitHours: 12 },
    { speciesId: 'qilin_elixir', decisionHours: 141, waitHours: 6 },
  ] as const)(
    'previews the first $speciesId fruit at its actual harvest boundary without choosing a branch',
    ({ speciesId, decisionHours, waitHours }) => {
      const initial = planted(speciesId);
      const decisionAt =
        initial.plots[0]!.plant!.settledAt + decisionHours * hour;
      const before = settleSpiritGarden(initial, decisionAt);
      const saved = structuredClone(before);
      const preview = getSpiritGardenBranchPreview(
        before.plots[0]!.plant!,
        'essence',
        '渡劫',
      );
      expect(before).toEqual(saved);
      expect(preview.nextYieldMs).toBe(waitHours * hour);
      const chosen = chooseSpiritGardenBranch(
        before,
        0,
        plantId,
        'essence',
        decisionAt,
      );
      const fruitAt = (time: number) =>
        settleSpiritGarden(chosen, time).plots[0]!.plant!.pending.filter(
          (product) => product.kind === 'spirit_fruit',
        );
      expect(fruitAt(decisionAt + preview.nextYieldMs - 1)).toEqual([]);
      expect(fruitAt(decisionAt + preview.nextYieldMs)).toMatchObject([
        { quantity: 1 },
      ]);
    },
  );
  it('preserves old products and partial work through a longer output cycle', () => {
    const branch = chooseSpiritGardenBranch(
      planted(),
      0,
      plantId,
      'essence',
      at(day),
    );
    const before = settleSpiritGarden(branch, at(4 * day));
    const evolved = evolveSpiritGardenPlant(
      before,
      0,
      plantId,
      '渡劫',
      at(4 * day),
      0,
    );
    expect(evolved.plots[0]!.plant!.pending).toEqual(
      before.plots[0]!.plant!.pending,
    );
    expect(evolved.plots[0]!.plant!.productionMs).toBe(
      before.plots[0]!.plant!.productionMs,
    );
    expect(evolved.plots[0]!.plant!.productionUsedMs).toBe(4 * day);
    const wait = getSpiritGardenPlantView(
      evolved.plots[0]!.plant!,
      '渡劫',
    ).nextYieldMs;
    const after = settleSpiritGarden(evolved, at(4 * day) + wait);
    expect(
      after.plots[0]!.plant!.pending.filter(
        (product) => product.quality === '凡品',
      ),
    ).toEqual(before.plots[0]!.plant!.pending);
    expect(
      after.plots[0]!.plant!.pending.find(
        (product) => product.quality === '灵品',
      ),
    ).toMatchObject({ kind: 'spirit_fruit', quantity: 1 });
  });
  it('keeps the remaining lifetime when evolving late rather than granting a fresh crop', () => {
    const initial = planted('enlightenment_tea_tree');
    const view = getSpiritGardenPlantView(initial.plots[0]!.plant!, '渡劫');
    const paidAt = initial.plots[0]!.plant!.settledAt;
    let state = chooseSpiritGardenBranch(
      initial,
      0,
      plantId,
      'abundance',
      paidAt + view.branchMs,
    );
    for (const days of [6, 12, 18, 24])
      state = harvestSpiritGarden(state, paidAt + days * day).state;
    const decisionAt = paidAt + 26 * day;
    const before = settleSpiritGarden(state, decisionAt);
    const evolved = evolveSpiritGardenPlant(
      before,
      0,
      plantId,
      '渡劫',
      decisionAt,
      0,
    );
    expect(evolved.plots[0]!.plant).toMatchObject({
      pending: [],
      productionMs: 2 * day,
      productionUsedMs: 26 * day,
    });
    expect(
      getSpiritGardenPlantView(evolved.plots[0]!.plant!, '渡劫')
        .remainingProductionMs,
    ).toBe(2 * day);
    const spent = settleSpiritGarden(evolved, decisionAt + 2 * day);
    expect(spent.plots[0]!.plant).toMatchObject({
      pending: [{ quality: '神品', quantity: 2 }],
      productionUsedMs: lifetime,
      productionMs: 0,
    });
  });
  it.each([
    ['licorice', 0.9],
    ['spirit_rice', 0.85],
    ['purple_monkey_flower', 0.8],
    ['nine_bend_spirit_ginseng', 0.75],
    ['thousand_year_snow_lotus', 0.7],
    ['gold_thunder_bamboo', 0.6],
    ['enlightenment_tea_tree', 0.5],
  ] as const)('uses the exact success boundary for %s', (speciesId, chance) => {
    const initial = planted(speciesId);
    const view = getSpiritGardenPlantView(initial.plots[0]!.plant!, '渡劫');
    const paidAt = initial.plots[0]!.plant!.settledAt;
    let branch = chooseSpiritGardenBranch(
      initial,
      0,
      plantId,
      'abundance',
      paidAt + view.branchMs,
    );
    const readyAt = paidAt + view.branchMs + view.evolveMs;
    for (let now = paidAt + view.branchMs + day; now < readyAt; now += day)
      if (settleSpiritGarden(branch, now).plots[0]!.plant!.pending.length)
        branch = harvestSpiritGarden(branch, now).state;
    const before = settleSpiritGarden(branch, readyAt);
    const success = evolveSpiritGardenPlant(
      before,
      0,
      plantId,
      '渡劫',
      readyAt,
      chance - Number.EPSILON,
    );
    const failure = evolveSpiritGardenPlant(
      before,
      0,
      plantId,
      '渡劫',
      readyAt,
      chance,
    );
    expect(success.plots[0]!.plant).toMatchObject({
      evolved: true,
      evolutionAttempts: [{ succeeded: true }],
    });
    expect(failure.plots[0]!.plant).toMatchObject({
      evolved: false,
      evolutionAttempts: [{ succeeded: false }],
    });
    expect(failure.plots[0]!.plant!.pending).toEqual(
      before.plots[0]!.plant!.pending,
    );
    expect(failure.plots[0]!.plant!.productionUsedMs).toBe(
      before.plots[0]!.plant!.productionUsedMs,
    );
    expect({
      ...failure.plots[0]!.plant!,
      evolutionAttempts: before.plots[0]!.plant!.evolutionAttempts,
    }).toEqual(before.plots[0]!.plant);
    expect(
      getSpiritGardenPlantView(success.plots[0]!.plant!, '渡劫').canEvolve,
    ).toBe(false);
  });
  it('limits failed evolution to three paid attempts separated by a full effective day', () => {
    const first = evolveSpiritGardenPlant(
      evolutionReady(),
      0,
      plantId,
      '渡劫',
      at(4 * day),
      0.99,
    );
    expect(() =>
      evolveSpiritGardenPlant(first, 0, plantId, '渡劫', at(5 * day - 1), 0.99),
    ).toThrow();
    const second = evolveSpiritGardenPlant(
      first,
      0,
      plantId,
      '渡劫',
      at(5 * day),
      0.99,
    );
    const third = evolveSpiritGardenPlant(
      second,
      0,
      plantId,
      '渡劫',
      at(6 * day),
      0.99,
    );
    expect(third.plots[0]!.plant!.evolutionAttempts).toHaveLength(3);
    expect(third.plots[0]!.plant!.evolved).toBe(false);
    expect(
      getSpiritGardenPlantView(third.plots[0]!.plant!, '渡劫').canEvolve,
    ).toBe(false);
    expect(() =>
      evolveSpiritGardenPlant(third, 0, plantId, '渡劫', at(7 * day), 0),
    ).toThrow();
  });
  it('pauses evolution cooldown while storage is full and while the plant is in collection', () => {
    const fullFailure = evolveSpiritGardenPlant(
      branched(),
      0,
      plantId,
      '渡劫',
      at(7 * day),
      0.99,
    );
    expect(() =>
      evolveSpiritGardenPlant(
        fullFailure,
        0,
        plantId,
        '渡劫',
        at(100 * day),
        0,
      ),
    ).toThrow();
    const claimed = harvestSpiritGarden(fullFailure, at(100 * day)).state;
    expect(() =>
      evolveSpiritGardenPlant(
        claimed,
        0,
        plantId,
        '渡劫',
        at(101 * day - 1),
        0,
      ),
    ).toThrow();
    expect(
      evolveSpiritGardenPlant(claimed, 0, plantId, '渡劫', at(101 * day), 0)
        .plots[0]!.plant!.evolved,
    ).toBe(true);
    const failed = evolveSpiritGardenPlant(
      evolutionReady(),
      0,
      plantId,
      '渡劫',
      at(4 * day),
      0.99,
    );
    const stored = archiveSpiritGardenPlant(failed, 0, plantId, at(4 * day));
    const restored = restoreSpiritGardenPlant(
      stored,
      0,
      plantId,
      '渡劫',
      at(100 * day),
    );
    expect(() =>
      evolveSpiritGardenPlant(
        restored,
        0,
        plantId,
        '渡劫',
        at(101 * day - 1),
        0,
      ),
    ).toThrow();
    expect(
      evolveSpiritGardenPlant(restored, 0, plantId, '渡劫', at(101 * day), 0)
        .plots[0]!.plant!.evolved,
    ).toBe(true);
  });
  it.each([-1, 1, Number.NaN, Infinity])(
    'rejects an invalid host evolution roll %s',
    (roll) => {
      expect(() =>
        evolveSpiritGardenPlant(
          evolutionReady(),
          0,
          plantId,
          '渡劫',
          at(4 * day),
          roll,
        ),
      ).toThrow();
    },
  );
  it('requires the next realm for evolution and never evolves a divine plant', () => {
    expect(() =>
      evolveSpiritGardenPlant(
        evolutionReady(),
        0,
        plantId,
        '炼气',
        at(4 * day),
        0,
      ),
    ).toThrow();
    const divine = planted('qilin_elixir');
    expect(
      getSpiritGardenPlantView(divine.plots[0]!.plant!, '渡劫').canEvolve,
    ).toBe(false);
  });
  it('rejects stage and attempt records inconsistent with committed lifetime', () => {
    const ready = settleSpiritGarden(evolutionReady(), at(7 * day));
    const original = ready.plots[0]!.plant!;
    for (const changes of [
      { branchAtProductionMs: null },
      { branchAtProductionMs: 0 },
      { evolved: true, evolutionAttempts: [] },
      { productionClockMs: original.productionUsedMs + 1 },
      {
        evolutionAttempts: [{ atProductionMs: 4 * day - 1, succeeded: false }],
      },
      {
        evolutionAttempts: [
          { atProductionMs: 4 * day, succeeded: false },
          { atProductionMs: 5 * day - 1, succeeded: false },
        ],
      },
      {
        evolutionAttempts: [
          { atProductionMs: 4 * day, succeeded: true },
          { atProductionMs: 5 * day, succeeded: false },
        ],
      },
      {
        evolutionAttempts: [{ atProductionMs: 8 * day, succeeded: false }],
      },
      {
        evolutionAttempts: [4, 5, 6, 7].map((days) => ({
          atProductionMs: days * day,
          succeeded: false,
        })),
      },
    ]) {
      expect(() =>
        parseSpiritGardenState({
          ...ready,
          plots: [
            { index: 0, plant: { ...original, ...changes } },
            ...ready.plots.slice(1),
          ],
        }),
      ).toThrow();
    }
    expect(parseSpiritGardenState(ready)).toEqual(ready);
  });
  it('freezes growth, production and cooldown in collection and resumes from the same work', () => {
    const stored = archiveSpiritGardenPlant(planted(), 0, plantId, at(hour));
    const original = structuredClone(stored.collection[0]!);
    expect(settleSpiritGarden(stored, at(30 * day)).collection[0]).toEqual(
      original,
    );
    const restored = restoreSpiritGardenPlant(
      stored,
      1,
      plantId,
      '渡劫',
      at(30 * day),
    );
    const later = settleSpiritGarden(restored, at(30 * day + 7 * hour));
    expect(later.plots[1]!.plant).toMatchObject({
      productionUsedMs: herbCycleMs,
      pending: [{ quantity: 2 }],
    });
    expect(restored.collection).toEqual([]);
  });
  it('claims dormant yields once and requires claiming before retirement', () => {
    const stored = archiveSpiritGardenPlant(planted(), 0, plantId, at(0));
    expect(() => retireSpiritGardenPlant(stored, plantId, at(day))).toThrow();
    const claim = harvestSpiritGarden(stored, at(10 * day));
    expect(claim.products[0]!.quantity).toBe(1);
    expect(() => harvestSpiritGarden(claim.state, at(10 * day))).toThrow();
    const retired = retireSpiritGardenPlant(claim.state, plantId, at(10 * day));
    expect(retired.collection).toEqual([]);
    expect(getSpiritGardenMaturedCount(retired)).toBe(1);
  });
  it('delivers the final completed round once and retires only after claiming it', () => {
    let state = planted();
    for (const days of [7, 14, 21])
      state = harvestSpiritGarden(state, at(days * day)).state;
    const near = settleSpiritGarden(state, at(lifetime - 1));
    expect(
      getSpiritGardenPlantView(near.plots[0]!.plant!, '渡劫'),
    ).toMatchObject({
      remainingProductionMs: 1,
      remainingHarvestCycles: 1,
      exhausted: false,
    });
    expect(() =>
      retireSpiritGardenPlant(near, plantId, at(lifetime - 1), 0),
    ).toThrow();
    const spent = settleSpiritGarden(near, at(lifetime));
    expect(
      getSpiritGardenPlantView(spent.plots[0]!.plant!, '渡劫'),
    ).toMatchObject({ exhausted: true, canBranch: false, canEvolve: false });
    expect(() =>
      archiveSpiritGardenPlant(spent, 0, plantId, at(lifetime)),
    ).toThrow();
    const claim = harvestSpiritGarden(spent, at(lifetime));
    expect(claim.products[0]!.quantity).toBe(21);
    expect(() =>
      harvestSpiritGarden(claim.state, at(lifetime + day)),
    ).toThrow();
    expect(
      retireSpiritGardenPlant(claim.state, plantId, at(lifetime), 0).plots[0]!
        .plant,
    ).toBeNull();
  });
  it('returns a same-species original-quality seed on exactly the lowest 25% of exhausted-plot clearing draws', () => {
    const evolved = evolveSpiritGardenPlant(
      evolutionReady(),
      0,
      plantId,
      '渡劫',
      at(4 * day),
      0,
    );
    const spent = {
      ...evolved,
      plots: evolved.plots.map((plot) => ({
        ...plot,
        plant: plot.plant
          ? {
              ...plot.plant,
              activeGrowthMs: matureMs + lifetime,
              productionUsedMs: lifetime,
              productionClockMs: lifetime,
              settledAt: at(lifetime),
              productionMs: 0,
              storedProductionMs: 0,
              pending: [],
            }
          : null,
      })),
    };
    expect(parseSpiritGardenState(spent)).toEqual(spent);
    const original = structuredClone(spent);
    for (const roll of [0, 0.25 - Number.EPSILON, 0.25, 1 - Number.EPSILON]) {
      const result = clearSpiritGardenPlot(
        spent,
        0,
        plantId,
        at(lifetime),
        roll,
      );
      expect(result.state.plots[0]!.plant).toBeNull();
      expect(result.state.codex).toEqual(spent.codex);
      expect(result.seed).toEqual(
        roll < 0.25
          ? {
              speciesId: 'licorice',
              quality: '凡品',
              quantity: 1,
            }
          : null,
      );
      expect(() =>
        clearSpiritGardenPlot(result.state, 0, plantId, at(lifetime), 0),
      ).toThrow();
    }
    expect(spent).toEqual(original);
  });
  it('requires exhaustion and all pending rewards claimed before clearing can grant a seed', () => {
    expect(() =>
      clearSpiritGardenPlot(planted(), 0, plantId, at(day), 0),
    ).toThrow('尚未停止产出');
    let state = planted();
    for (const days of [7, 14, 21])
      state = harvestSpiritGarden(state, at(days * day)).state;
    const spent = settleSpiritGarden(state, at(lifetime));
    expect(() =>
      clearSpiritGardenPlot(spent, 0, plantId, at(lifetime), 0),
    ).toThrow('先领取');
    const claimed = harvestSpiritGarden(spent, at(lifetime)).state;
    for (const roll of [-1, 1, NaN, Infinity])
      expect(() =>
        clearSpiritGardenPlot(claimed, 0, plantId, at(lifetime), roll),
      ).toThrow('判定无效');
    const archived = archiveSpiritGardenPlant(planted(), 0, plantId, at(0));
    expect(() =>
      clearSpiritGardenPlot(archived, 0, plantId, at(0), 0),
    ).toThrow();
    expect(
      retireSpiritGardenPlant(
        harvestSpiritGarden(archived, at(0)).state,
        plantId,
        at(0),
      ).collection,
    ).toEqual([]);
  });
  it('checks occupied slots, stale identities, realm and collection capacity', () => {
    expect(() =>
      plantSpiritGardenSeed(planted(), 0, seed(), 'other', '炼气', start),
    ).toThrow();
    expect(() =>
      plantSpiritGardenSeed(
        createSpiritGarden(),
        0,
        seed('spirit_rice', '灵品'),
        'other',
        '炼气',
        start,
      ),
    ).toThrow();
    expect(() =>
      archiveSpiritGardenPlant(planted(), 0, 'stale', at(day)),
    ).toThrow();
    const full = {
      ...planted(),
      collection: Array.from(
        { length: SPIRIT_GARDEN_COLLECTION_LIMIT },
        (_, i) => ({ ...planted().plots[0]!.plant!, id: `stored-${i}` }),
      ),
    };
    expect(() => archiveSpiritGardenPlant(full, 0, plantId, at(day))).toThrow();
  });
  it('allows the sixth stored plant and rejects a seventh without removing any plant', () => {
    const growing = planted();
    const state = {
      ...growing,
      collection: Array.from({ length: 5 }, (_, i) => ({
        ...growing.plots[0]!.plant!,
        id: `stored-${i}`,
      })),
    };
    const full = archiveSpiritGardenPlant(state, 0, plantId, at(0));
    expect(full.collection).toHaveLength(6);
    const next = plantSpiritGardenSeed(
      full,
      0,
      seed(),
      'next-plant',
      '炼气',
      at(0),
    );
    const saved = structuredClone(next);
    expect(() =>
      archiveSpiritGardenPlant(next, 0, 'next-plant', at(0)),
    ).toThrow('暂存区已满');
    expect(next).toEqual(saved);
  });
  it('keeps older over-capacity collections readable and lets players move plants back', () => {
    const growing = planted();
    const state = {
      ...createSpiritGarden(),
      collection: Array.from({ length: 24 }, (_, i) => ({
        ...growing.plots[0]!.plant!,
        id: `stored-${i}`,
      })),
    };
    expect(parseSpiritGardenState(state).collection).toHaveLength(24);
    const restored = restoreSpiritGardenPlant(
      state,
      0,
      'stored-0',
      '炼气',
      at(0),
    );
    expect(restored.collection).toHaveLength(23);
    expect(restored.plots[0]!.plant?.id).toBe('stored-0');
    expect(() =>
      archiveSpiritGardenPlant(restored, 0, 'stored-0', at(0)),
    ).toThrow('暂存区已满');
    expect(parseSpiritGardenState(restored).collection).toHaveLength(23);
  });
  it('records paid mature species once while keeping unaccepted seedlings out of the codex', () => {
    let state = createSpiritGarden();
    for (const [index, speciesId] of (
      ['licorice', 'wild_chrysanthemum', 'mountain_jujube'] as const
    ).entries()) {
      state = plantSpiritGardenSeed(
        state,
        index,
        seed(speciesId),
        `plant-${index}`,
        '炼气',
        start,
      );
      state = matureSpiritGardenPlant(
        state,
        index,
        `plant-${index}`,
        start + matureMs,
      );
    }
    expect(getSpiritGardenMaturedCount(state)).toBe(3);
    expect(
      getSpiritGardenMaturedCount(settleSpiritGarden(state, at(2 * day))),
    ).toBe(3);
  });
  it('keeps fixed same-species seeds stackable', () => {
    const first = buildSpiritGardenSeed('licorice', '凡品');
    const again = buildSpiritGardenSeed('licorice', '凡品', 4);
    expect(readSpiritGardenSeedSpec(first.details)!.plant.seedName).toBe(
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
  it('rejects legacy and removed-catalog seeds even when their name or element matches a new species', () => {
    for (const legacy of [
      { ...seed('licorice'), id: 'pre-garden-seed', seedName: '甘草的种子' },
      { ...seed('licorice'), id: 'garden-seed:removed-species:凡品' },
      { ...seed('licorice'), id: 'garden-seed:licorice:灵品' },
    ]) {
      expect(isSpiritGardenSeed(legacy)).toBe(false);
      expect(() => resolveSpiritGardenSpecies(legacy)).toThrow(
        '旧版灵种无法播种',
      );
      expect(() =>
        plantSpiritGardenSeed(
          createSpiritGarden(),
          0,
          legacy,
          plantId,
          '渡劫',
          start,
        ),
      ).toThrow('材料转化');
    }
    expect(isSpiritGardenSeed(seed())).toBe(true);
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
      productionMs: herbCycleMs,
      storedProductionMs: herbCycleMs,
    };
    expect(() =>
      parseSpiritGardenState({
        ...planted(),
        plots: [{ index: 0, plant }, ...planted().plots.slice(1)],
      }),
    ).toThrow();
  });
});

import {
  SPIRIT_GARDEN_BEAST_RECOVERY_MS,
  SPIRIT_GARDEN_INCIDENT_CHANCE,
  SPIRIT_GARDEN_INCIDENT_INTERVAL_MS,
  SPIRIT_GARDEN_PEST_RECOVERY_MS,
} from '@daoyou/game-content/spirit-field/config';
import {
  readSpiritGardenSeedSpec,
  type SpiritGardenPlant,
  type SpiritGardenSpeciesId,
  type SpiritGardenState,
} from '@daoyou/game-domain/spirit-field';
import { describe, expect, it } from 'vitest';
import {
  SPIRIT_GARDEN_OFFLINE_CAP_MS,
  SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS,
  SPIRIT_GARDEN_SPECIES,
  archiveSpiritGardenPlant,
  buildSpiritGardenSeed,
  chooseSpiritGardenBranch,
  createSpiritGarden,
  evolveSpiritGardenPlant,
  getSpiritGardenOutput,
  getSpiritGardenPlantView,
  getSpiritGardenSpecies,
  harvestSpiritGarden,
  matureSpiritGardenPlant,
  parseSpiritGardenState,
  plantSpiritGardenSeed,
  restoreSpiritGardenPlant,
  retireSpiritGardenPlant,
  settleSpiritGarden,
} from './garden.js';

const start = 1_000_000;
const hour = 3_600_000;
const day = 24 * hour;

function plantOf(state: SpiritGardenState): SpiritGardenPlant {
  return state.plots[0]!.plant!;
}

function planted(id: string, speciesId: SpiritGardenSpeciesId = 'licorice') {
  const species = getSpiritGardenSpecies(speciesId);
  const initial = plantSpiritGardenSeed(
    createSpiritGarden(),
    0,
    readSpiritGardenSeedSpec(
      buildSpiritGardenSeed(speciesId, species.quality).details,
    )!.plant,
    id,
    '渡劫',
    start,
  );
  return matureSpiritGardenPlant(
    initial,
    0,
    id,
    start + getSpiritGardenPlantView(plantOf(initial), '渡劫').matureMs,
  );
}

function matureAt(state: SpiritGardenState): number {
  return start + getSpiritGardenPlantView(plantOf(state), '渡劫').matureMs;
}

function withPlant(state: SpiritGardenState, changes: Record<string, unknown>) {
  return {
    ...state,
    plots: [
      { index: 0, plant: { ...plantOf(state), ...changes } },
      ...state.plots.slice(1),
    ],
  };
}

function finishLifetime(initial: SpiritGardenState) {
  let state = initial;
  let quantity = 0;
  const seeds = [];
  for (const days of [6, 12, 18, 24, 30]) {
    const now = matureAt(initial) + days * day;
    if (now <= plantOf(state).settledAt) continue;
    const harvested = harvestSpiritGarden(state, now);
    quantity += harvested.products.reduce(
      (sum, product) => sum + product.quantity,
      0,
    );
    seeds.push(...harvested.seeds);
    state = harvested.state;
  }
  return { state, quantity, seeds };
}

describe('deterministic spirit garden incidents', () => {
  it.each([
    ['seed-quality-141', 'wild_chrysanthemum'],
    ['seed-quality-2335', 'rainbow_skirt_grass'],
    ['seed-quality-1075', 'jade_marrow_lingzhi'],
    ['seed-quality-4907', 'nine_bend_spirit_ginseng'],
    ['seed-quality-2444', 'stone_flower'],
    ['seed-quality-2498', 'gold_thunder_bamboo'],
    ['seed-quality-2201', 'ginseng_fruit'],
    ['seed-quality-6136', 'nine_wonder_elixir'],
  ] as const)(
    'can leave any quality seed from an ordinary plant: %s',
    (id, speciesId) => {
      const initial = planted(id);
      const eventAt = matureAt(initial) + day;
      const result = harvestSpiritGarden(initial, eventAt);
      expect(result.seeds).toEqual([
        {
          speciesId,
          quality: getSpiritGardenSpecies(speciesId).quality,
          quantity: 1,
        },
      ]);
      expect(parseSpiritGardenState(result.state)).toEqual(result.state);
      expect(
        harvestSpiritGarden(result.state, eventAt + 10 * hour).seeds,
      ).toEqual([]);
    },
  );
  it('supports pests, beasts and mutation for all 32 species and every cultivation branch', () => {
    expect(SPIRIT_GARDEN_SPECIES).toHaveLength(32);
    const cases = [
      { id: 'incident-13', kind: 'pests', recoveryMs: 6 * hour },
      { id: 'incident-28', kind: 'beast', recoveryMs: 2 * hour },
      { id: 'incident-65', kind: 'mutation', recoveryMs: 0 },
    ] as const;
    for (const species of SPIRIT_GARDEN_SPECIES) {
      for (const branch of [null, 'abundance', 'essence'] as const) {
        for (const incident of cases) {
          const initial = planted(incident.id, species.id);
          let state = initial;
          const original = structuredClone(state);
          const view = getSpiritGardenPlantView(plantOf(state), '渡劫');
          if (branch)
            state = chooseSpiritGardenBranch(
              state,
              0,
              incident.id,
              branch,
              matureAt(initial) + view.branchMs,
            );
          const eventAt = start + view.matureMs + day;
          const settled = settleSpiritGarden(
            state,
            Math.max(
              matureAt(initial) + view.branchMs,
              eventAt + incident.recoveryMs,
            ) + hour,
          );
          const plant = plantOf(settled);
          expect(plant.branch).toBe(branch);
          expect(plant.incidents[0]).toMatchObject({
            kind: incident.kind,
            productionDay: 1,
            occurredAt: eventAt,
          });
          if (incident.kind === 'beast') {
            const reward = harvestSpiritGarden(settled, plant.settledAt).seeds;
            expect(reward).toEqual([
              {
                speciesId: 'qilin_elixir',
                quality: '神品',
                quantity: 1,
              },
            ]);
          }
          expect(parseSpiritGardenState(settled)).toEqual(settled);
          expect(initial).toEqual(original);
        }
      }
    }
  });

  it('settles one offline visit exactly like irregular reads, including event timestamps and counters', () => {
    const initial = planted('incident-448');
    const original = structuredClone(initial);
    const end = matureAt(initial) + 10 * day + 47;
    const offline = settleSpiritGarden(initial, end);
    let incremental = initial;
    for (let now = start + 1; now < end; now += 73 * 60_000 + 17)
      incremental = settleSpiritGarden(incremental, now);
    incremental = settleSpiritGarden(incremental, end);

    expect(incremental).toEqual(offline);
    expect(plantOf(offline).incidents).toEqual([
      {
        kind: 'beast',
        productionDay: 2,
        occurredAt: matureAt(initial) + 2 * day,
        seedSpeciesId: null,
      },
      {
        kind: 'mutation',
        productionDay: 6,
        occurredAt: matureAt(initial) + 6 * day + 2 * hour,
        seedSpeciesId: null,
      },
      {
        kind: 'pests',
        productionDay: 7,
        occurredAt: matureAt(initial) + 7 * day + 2 * hour,
        seedSpeciesId: null,
      },
    ]);
    expect(plantOf(offline).productionUsedMs).toBe(7 * day + 2 * hour);
    expect(plantOf(offline).productionClockMs).toBe(7 * day);
    expect(plantOf(offline).storedProductionMs).toBe(
      SPIRIT_GARDEN_OFFLINE_CAP_MS,
    );
    expect(initial).toEqual(original);
  });

  it('draws once at each productive day with the fixed 8% threshold and never rerolls a read', () => {
    expect(SPIRIT_GARDEN_INCIDENT_INTERVAL_MS).toBe(day);
    expect(SPIRIT_GARDEN_INCIDENT_CHANCE).toBe(0.08);
    // Fixed identity draws straddle 8%: 0.0799715177 and 0.0800034204.
    for (const [id, expectedCount] of [
      ['incident-46682', 1],
      ['incident-70597', 0],
    ] as const) {
      const initial = planted(id);
      const boundary = matureAt(initial) + day;
      const before = settleSpiritGarden(initial, boundary - 1);
      expect(plantOf(before).incidents).toEqual([]);
      let state = settleSpiritGarden(before, boundary);
      expect(plantOf(state).incidents).toHaveLength(expectedCount);
      const history = structuredClone(plantOf(state).incidents);
      for (const offset of [0, 1, 2, 15, 100, hour, 6 * hour]) {
        state = settleSpiritGarden(state, boundary + offset);
        expect(plantOf(state).incidents).toEqual(history);
      }
      expect(settleSpiritGarden(initial, boundary + 6 * hour)).toEqual(state);
    }
  });

  it.each([
    ['incident-13', 'pests', SPIRIT_GARDEN_PEST_RECOVERY_MS, 6 * hour],
    ['incident-3', 'beast', SPIRIT_GARDEN_BEAST_RECOVERY_MS, 2 * hour],
  ] as const)(
    'consumes lifetime while pausing production and the event clock during %s recovery',
    (id, kind, recoveryMs, expectedMs) => {
      expect(recoveryMs).toBe(expectedMs);
      const initial = planted(id);
      const eventAt = matureAt(initial) + day;
      const happened = settleSpiritGarden(initial, eventAt);
      const original = structuredClone(happened);
      const plant = plantOf(happened);
      expect(plant.incidents).toEqual([
        { kind, productionDay: 1, occurredAt: eventAt, seedSpeciesId: null },
      ]);
      expect(plant.recoveryRemainingMs).toBe(recoveryMs);
      const during = plantOf(
        settleSpiritGarden(happened, eventAt + recoveryMs - 1),
      );
      expect(during.recoveryRemainingMs).toBe(1);
      expect(during.productionUsedMs).toBe(day + recoveryMs - 1);
      expect(during.productionClockMs).toBe(day);
      expect(during.storedProductionMs).toBe(day);
      expect(during.productionMs).toBe(plant.productionMs);
      expect(during.pending).toEqual(plant.pending);
      expect(getSpiritGardenPlantView(during, '渡劫').nextYieldMs).toBe(
        1 + getSpiritGardenOutput(plant).cycleMs - plant.productionMs,
      );
      const after = plantOf(
        settleSpiritGarden(happened, eventAt + recoveryMs + hour),
      );
      expect(after.recoveryRemainingMs).toBe(0);
      expect(after.productionUsedMs).toBe(day + recoveryMs + hour);
      expect(after.productionClockMs).toBe(day + hour);
      expect(after.storedProductionMs).toBe(day + hour);
      expect(after.productionMs).toBe(hour);
      expect(happened).toEqual(original);
    },
  );

  it('freezes recovery and incidents in collection, then resumes their remaining productive time', () => {
    const initial = planted('incident-13');
    const eventAt = matureAt(initial) + day;
    const archived = archiveSpiritGardenPlant(
      initial,
      0,
      'incident-13',
      eventAt,
    );
    const frozen = structuredClone(archived.collection[0]!);
    const restoredAt = matureAt(initial) + 100 * day;
    const waiting = settleSpiritGarden(archived, restoredAt);
    expect(waiting.collection[0]).toEqual(frozen);
    const restored = restoreSpiritGardenPlant(
      waiting,
      0,
      'incident-13',
      '渡劫',
      restoredAt,
    );
    const during = plantOf(
      settleSpiritGarden(restored, restoredAt + 6 * hour - 1),
    );
    expect(during.recoveryRemainingMs).toBe(1);
    expect(during.productionUsedMs).toBe(day + 6 * hour - 1);
    expect(during.productionClockMs).toBe(day);
    expect(during.incidents).toEqual(frozen.incidents);
    const after = plantOf(
      settleSpiritGarden(restored, restoredAt + 6 * hour + day),
    );
    expect(after.productionUsedMs).toBe(2 * day + 6 * hour);
    expect(after.productionClockMs).toBe(2 * day);
    expect(after.incidents).toEqual(frozen.incidents);
    expect(archived.collection[0]).toEqual(frozen);
  });

  it('freezes a day-seven incident and its recovery while unclaimed storage is full', () => {
    const initial = planted('incident-5');
    const eventAt = matureAt(initial) + 7 * day;
    const full = settleSpiritGarden(initial, eventAt);
    const laterAt = matureAt(initial) + 100 * day;
    const waiting = settleSpiritGarden(full, laterAt);
    expect(plantOf(waiting)).toMatchObject({
      productionUsedMs: 7 * day,
      storedProductionMs: SPIRIT_GARDEN_OFFLINE_CAP_MS,
      recoveryRemainingMs: 6 * hour,
      incidents: [{ kind: 'pests', productionDay: 7, occurredAt: eventAt }],
    });
    const claimed = harvestSpiritGarden(waiting, laterAt).state;
    const during = plantOf(settleSpiritGarden(claimed, laterAt + 6 * hour - 1));
    expect(during.recoveryRemainingMs).toBe(1);
    expect(during.productionUsedMs).toBe(7 * day + 6 * hour - 1);
    expect(during.productionClockMs).toBe(7 * day);
    expect(during.storedProductionMs).toBe(0);
    const resumed = plantOf(
      settleSpiritGarden(claimed, laterAt + 6 * hour + day),
    );
    expect(resumed.productionUsedMs).toBe(8 * day + 6 * hour);
    expect(resumed.productionClockMs).toBe(8 * day);
    expect(resumed.incidents).toEqual(plantOf(waiting).incidents);
  });

  it('adds 10% production after mutation while consuming lifetime at the normal rate', () => {
    const initial = planted('incident-65');
    const mutationAt = matureAt(initial) + day;
    const mutated = harvestSpiritGarden(initial, mutationAt).state;
    const quiet = harvestSpiritGarden(planted('incident-18'), mutationAt).state;
    const fast = plantOf(settleSpiritGarden(mutated, mutationAt + hour));
    const normal = plantOf(settleSpiritGarden(quiet, mutationAt + hour));
    expect(fast.productionMs).toBe((hour * 11) / 10);
    expect(normal.productionMs).toBe(hour);
    expect(fast.productionUsedMs).toBe(day + hour);
    expect(fast.storedProductionMs).toBe(hour);
    expect(fast.productionUsedMs).toBe(normal.productionUsedMs);
    expect(getSpiritGardenPlantView(fast, '渡劫')).toMatchObject({
      mutated: true,
      remainingProductionMs: SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS - day - hour,
    });

    const result = finishLifetime(initial);
    const cycleMs = getSpiritGardenOutput(plantOf(initial)).cycleMs;
    expect(result.quantity).toBe(
      1 +
        Math.floor(
          (day * 10 + (SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS - day) * 11) /
            (cycleMs * 10),
        ),
    );
    expect(plantOf(result.state)).toMatchObject({
      productionUsedMs: SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS,
      productionMs: 0,
      productionBonusRemainder: 0,
      incidents: [{ kind: 'mutation', productionDay: 1 }],
    });
  });

  it('retains mutation tenths through millisecond reads and partial-cycle harvests', () => {
    const initial = planted('incident-65');
    const mutationAt = matureAt(initial) + day;
    const mutated = harvestSpiritGarden(initial, mutationAt).state;
    const original = structuredClone(mutated);
    const first = settleSpiritGarden(mutated, mutationAt + 1);
    expect(plantOf(first)).toMatchObject({
      productionMs: 1,
      productionBonusRemainder: 1,
    });
    let split = mutated;
    for (let elapsed = 1; elapsed <= 11; elapsed += 1)
      split = settleSpiritGarden(split, mutationAt + elapsed);
    const once = settleSpiritGarden(mutated, mutationAt + 11);
    expect(split).toEqual(once);
    expect(plantOf(once)).toMatchObject({
      productionMs: 12,
      productionBonusRemainder: 1,
    });

    const cycleMs = getSpiritGardenOutput(plantOf(mutated)).cycleMs;
    const nextYieldMs = Math.ceil((cycleMs * 10 - 121) / 11);
    expect(getSpiritGardenPlantView(plantOf(once), '渡劫').nextYieldMs).toBe(
      nextYieldMs,
    );
    expect(
      plantOf(settleSpiritGarden(once, mutationAt + 11 + nextYieldMs - 1))
        .pending,
    ).toEqual([]);
    const readyAt = mutationAt + Math.ceil((cycleMs * 10) / 11) + 1;
    const ready = settleSpiritGarden(once, readyAt);
    const readyPlant = plantOf(ready);
    const harvested = harvestSpiritGarden(ready, readyAt);
    expect(harvested.products).toHaveLength(1);
    expect(plantOf(harvested.state)).toMatchObject({
      productionMs: readyPlant.productionMs,
      productionBonusRemainder: readyPlant.productionBonusRemainder,
      storedProductionMs: Math.ceil(
        (readyPlant.productionMs * 10 + readyPlant.productionBonusRemainder) /
          11,
      ),
    });
    expect(parseSpiritGardenState(harvested.state)).toEqual(harvested.state);
    expect(mutated).toEqual(original);
  });

  it('preserves mutation fractions when a long herb cycle becomes a shorter fruit cycle', () => {
    const initial = planted('incident-65', 'qilin_elixir');
    const mutationAt = matureAt(initial) + day;
    const mutated = harvestSpiritGarden(initial, mutationAt).state;
    const decisionAt = mutationAt + 60 * hour + 1;
    const before = settleSpiritGarden(mutated, decisionAt);
    expect(plantOf(before)).toMatchObject({
      productionMs: 90 * hour + 1,
      productionBonusRemainder: 1,
      pending: [],
    });
    const changed = chooseSpiritGardenBranch(
      before,
      0,
      'incident-65',
      'essence',
      decisionAt,
    );
    expect(plantOf(changed)).toMatchObject({
      productionMs: 41_361_702,
      productionBonusRemainder: 2,
      storedProductionMs: 37_601_548,
      productionUsedMs: day + 60 * hour + 1,
      pending: [],
    });
    expect(parseSpiritGardenState(changed)).toEqual(changed);
    expect(plantOf(changed).incidents).toEqual(plantOf(before).incidents);
    expect(
      plantOf(settleSpiritGarden(changed, decisionAt + 1)).pending,
    ).toEqual([]);
    const untilFruit = getSpiritGardenPlantView(
      plantOf(changed),
      '渡劫',
    ).nextYieldMs;
    expect(
      plantOf(settleSpiritGarden(changed, decisionAt + untilFruit - 1)).pending,
    ).toEqual([]);
    const ready = settleSpiritGarden(changed, decisionAt + untilFruit);
    expect(plantOf(ready).pending).toMatchObject([
      { kind: 'spirit_fruit', quality: '神品', quantity: 1 },
    ]);
    expect(parseSpiritGardenState(ready)).toEqual(ready);
  });

  it.each([
    [
      'incident-448',
      [
        { kind: 'beast', productionDay: 2 },
        { kind: 'mutation', productionDay: 6 },
        { kind: 'pests', productionDay: 7 },
      ],
    ],
    [
      'incident-26',
      [
        { kind: 'pests', productionDay: 4 },
        { kind: 'pests', productionDay: 5 },
        { kind: 'mutation', productionDay: 20 },
      ],
    ],
  ] as const)(
    'caps negative incidents independently of the one mutation for %s',
    (id, history) => {
      const result = finishLifetime(planted(id));
      expect(
        plantOf(result.state).incidents.map(({ kind, productionDay }) => ({
          kind,
          productionDay,
        })),
      ).toEqual(history);
      expect(parseSpiritGardenState(result.state)).toEqual(result.state);
    },
  );

  it('only grants one carried seed even after harvesting before a second seed-bearing beast', () => {
    const initial = planted('incident-386');
    const firstAt = matureAt(initial) + 6 * day;
    const first = harvestSpiritGarden(initial, firstAt);
    expect(first.seeds).toEqual([
      { speciesId: 'ginseng_fruit', quality: '仙品', quantity: 1 },
    ]);
    const secondAt = matureAt(initial) + 7 * day + 2 * hour;
    const second = harvestSpiritGarden(first.state, secondAt);
    expect(second.seeds).toEqual([]);
    expect(plantOf(second.state).incidents).toEqual([
      {
        kind: 'beast',
        productionDay: 6,
        occurredAt: firstAt,
        seedSpeciesId: 'ginseng_fruit',
      },
      {
        kind: 'beast',
        productionDay: 7,
        occurredAt: secondAt,
        seedSpeciesId: null,
      },
    ]);
    expect(finishLifetime(second.state).seeds).toEqual([]);
  });

  it('keeps a random carried seed at its species quality independently of evolution and the source plant', () => {
    const initial = planted('incident-386');
    const branched = chooseSpiritGardenBranch(
      initial,
      0,
      'incident-386',
      'abundance',
      matureAt(initial) + day,
    );
    const evolved = evolveSpiritGardenPlant(
      branched,
      0,
      'incident-386',
      '渡劫',
      matureAt(initial) + 4 * day,
      0,
    );
    const claimed = harvestSpiritGarden(
      evolved,
      matureAt(initial) + 4 * day,
    ).state;
    const eventAt = matureAt(initial) + 6 * day;
    const result = harvestSpiritGarden(claimed, eventAt);
    expect(result.products.every((product) => product.quality === '灵品')).toBe(
      true,
    );
    expect(result.seeds).toEqual([
      { speciesId: 'ginseng_fruit', quality: '仙品', quantity: 1 },
    ]);
    expect(
      readSpiritGardenSeedSpec(
        buildSpiritGardenSeed(
          result.seeds[0]!.speciesId,
          result.seeds[0]!.quality,
        ).details,
      )!.plant.quality,
    ).toBe('仙品');
  });

  it('harvests a seed-only collection asset exactly once and blocks retirement until it is claimed', () => {
    const initial = planted('incident-28');
    const eventAt = matureAt(initial) + day;
    const happened = settleSpiritGarden(initial, eventAt);
    const seedOnly = parseSpiritGardenState(
      withPlant(happened, { pending: [] }),
    );
    const archived = archiveSpiritGardenPlant(
      seedOnly,
      0,
      'incident-28',
      eventAt,
    );
    const original = structuredClone(archived);
    expect(() =>
      retireSpiritGardenPlant(archived, 'incident-28', eventAt),
    ).toThrow('先领取');
    const result = harvestSpiritGarden(archived, eventAt + 100 * day);
    expect(result.products).toEqual([]);
    expect(result.seeds).toEqual([
      { speciesId: 'qilin_elixir', quality: '神品', quantity: 1 },
    ]);
    expect(result.state.collection[0]!.pendingSeedSpeciesId).toBeNull();
    expect(() =>
      harvestSpiritGarden(result.state, eventAt + 100 * day),
    ).toThrow('没有可领取');
    expect(
      retireSpiritGardenPlant(result.state, 'incident-28', eventAt + 100 * day)
        .collection,
    ).toEqual([]);
    expect(archived).toEqual(original);
  });

  it('rejects impossible durable incident histories, recovery states and seed ownership', () => {
    const initial = planted('incident-448');
    const valid = settleSpiritGarden(initial, matureAt(initial) + 10 * day);
    const plant = plantOf(valid);
    const incident = (
      kind: string,
      productionDay: number,
      seedSpeciesId: string | null = null,
      occurredAt = start + productionDay * day,
    ) => ({ kind, productionDay, occurredAt, seedSpeciesId });
    const invalid: { name: string; changes: Record<string, unknown> }[] = [
      {
        name: 'three negative incidents',
        changes: {
          incidents: [
            incident('pests', 1),
            incident('beast', 2),
            incident('pests', 3),
          ],
          recoveryRemainingMs: 0,
        },
      },
      {
        name: 'two mutations',
        changes: {
          incidents: [incident('mutation', 1), incident('mutation', 2)],
          recoveryRemainingMs: 0,
        },
      },
      {
        name: 'two carried seeds',
        changes: {
          incidents: [
            incident('beast', 1, 'licorice'),
            incident('beast', 2, 'poria'),
          ],
          recoveryRemainingMs: 0,
        },
      },
      {
        name: 'future production day',
        changes: { incidents: [incident('pests', 8)] },
      },
      {
        name: 'future wall time',
        changes: {
          incidents: [incident('pests', 1, null, plant.settledAt + 1)],
        },
      },
      {
        name: 'duplicate day',
        changes: { incidents: [incident('beast', 1), incident('pests', 1)] },
      },
      {
        name: 'decreasing day',
        changes: { incidents: [incident('beast', 2), incident('pests', 1)] },
      },
      {
        name: 'decreasing wall time',
        changes: {
          incidents: [
            incident('beast', 1, null, start + 3 * day),
            incident('pests', 2),
          ],
        },
      },
      {
        name: 'pest seed',
        changes: {
          incidents: [incident('pests', 1, 'licorice')],
          pendingSeedSpeciesId: 'licorice',
        },
      },
      {
        name: 'unrecorded pending seed',
        changes: { pendingSeedSpeciesId: 'licorice' },
      },
      {
        name: 'excess pest recovery',
        changes: { recoveryRemainingMs: 6 * hour + 1 },
      },
      {
        name: 'excess beast recovery',
        changes: {
          incidents: [incident('beast', 1)],
          recoveryRemainingMs: 2 * hour + 1,
        },
      },
      {
        name: 'mutation recovery',
        changes: {
          incidents: [incident('mutation', 1)],
          recoveryRemainingMs: 1,
        },
      },
      {
        name: 'recovery without incident',
        changes: { incidents: [], recoveryRemainingMs: 1 },
      },
      {
        name: 'fraction without mutation',
        changes: {
          incidents: [incident('pests', 1)],
          productionBonusRemainder: 1,
        },
      },
      { name: 'invalid fraction', changes: { productionBonusRemainder: 10 } },
      {
        name: 'zero production day',
        changes: { incidents: [incident('pests', 0)] },
      },
      {
        name: 'terminal production day',
        changes: { incidents: [incident('pests', 28)] },
      },
      {
        name: 'fractional production day',
        changes: { incidents: [incident('pests', 1.5)] },
      },
      { name: 'unknown kind', changes: { incidents: [incident('rain', 1)] } },
      {
        name: 'unknown seed',
        changes: { incidents: [incident('beast', 1, 'made-up-species')] },
      },
      {
        name: 'extra incident field',
        changes: { incidents: [{ ...incident('pests', 1), quantity: 100 }] },
      },
    ];
    expect(parseSpiritGardenState(valid)).toEqual(valid);
    for (const invalidState of invalid)
      expect(
        () => parseSpiritGardenState(withPlant(valid, invalidState.changes)),
        invalidState.name,
      ).toThrow();
  });
});

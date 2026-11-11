import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import { BASE_PRICES } from '@daoyou/game-content/materials';
import { SPIRIT_GARDEN_EVOLUTION_QI_COSTS } from '@daoyou/game-content/spirit-field/config';
import {
  readSpiritFieldSeedSpec,
  type SpiritGardenBranch,
  type SpiritGardenProduct,
  type SpiritGardenSpecies,
} from '@daoyou/game-domain/spirit-field';
import { describe, expect, it } from 'vitest';
import { calculateSpiritFruitRecycleUnitPrice } from '../alchemy/pillRecyclePrice.js';
import {
  SPIRIT_GARDEN_SPECIES,
  buildSpiritGardenSeed,
  chooseSpiritGardenBranch,
  createSpiritGarden,
  evolveSpiritGardenPlant,
  getSpiritGardenOutput,
  getSpiritGardenPlantView,
  harvestSpiritGarden,
  matureSpiritGardenPlant,
  plantSpiritGardenSeed,
  settleSpiritGarden,
} from './garden.js';

const hour = 3_600_000;
const day = 24 * hour;
const start = 1_000_000;
const plantId = 'quiet-plant-2';
// Ordinary, keyword-free herb appraisal quotes; no garden-specific price treatment.
const normalHerbPrices: Record<Quality, number> = {
  凡品: 13,
  灵品: 99,
  玄品: 420,
  真品: 1_140,
  地品: 4_752,
  天品: 28_750,
  仙品: 120_000,
  神品: 600_000,
};
function normalPrice(product: Pick<SpiritGardenProduct, 'quality' | 'kind'>) {
  if (product.kind === 'spirit_fruit')
    return calculateSpiritFruitRecycleUnitPrice(product.quality);
  return (
    normalHerbPrices[product.quality] * (product.kind === 'tcdb' ? 2.5 : 1)
  );
}

/** A full crop, including the first yield, pre-branch output and evolution inputs. */
function fullCropReturn(
  species: SpiritGardenSpecies,
  branch: SpiritGardenBranch,
  evolve = false,
  seedPriceRatio = 1,
  mutation = false,
) {
  const id = mutation ? 'incident-65' : plantId;
  let state = plantSpiritGardenSeed(
    createSpiritGarden(),
    0,
    readSpiritFieldSeedSpec(
      buildSpiritGardenSeed(species.id, species.quality).details,
    )!.plant,
    id,
    '渡劫',
    start,
  );
  const view = getSpiritGardenPlantView(state.plots[0]!.plant!, '渡劫');
  const paidAt = start + view.matureMs;
  const branchAt = paidAt + view.branchMs;
  const actions = [
    { at: paidAt, kind: 'mature' },
    { at: branchAt, kind: 'branch' },
    ...Array.from({ length: 32 }, (_, index) => ({
      at: paidAt + (index + 1) * day,
      kind: 'harvest',
    })),
    ...(evolve ? [{ at: branchAt + view.evolveMs, kind: 'evolve' }] : []),
  ].sort((a, b) => a.at - b.at);
  let revenue = 0;
  let investment = BASE_PRICES[species.quality] * seedPriceRatio;
  const products: SpiritGardenProduct[] = [];
  let qi = 0;
  for (const action of actions) {
    if (action.kind === 'mature') {
      qi += view.matureQiCost;
      state = matureSpiritGardenPlant(state, 0, id, action.at);
      continue;
    }
    if (action.kind === 'branch') {
      qi += view.branchQiCost;
      state = chooseSpiritGardenBranch(state, 0, id, branch, action.at);
      continue;
    }
    state = settleSpiritGarden(state, action.at);
    if (state.plots[0]!.plant!.pending.length > 0) {
      const harvested = harvestSpiritGarden(state, action.at);
      products.push(...harvested.products);
      revenue += harvested.products.reduce(
        (sum, product) => sum + product.quantity * normalPrice(product),
        0,
      );
      state = harvested.state;
    }
    if (action.kind === 'evolve') {
      investment +=
        view.evolveCost.spiritStones + normalHerbPrices[species.quality];
      qi += view.evolveCost.qi;
      state = evolveSpiritGardenPlant(state, 0, id, '渡劫', action.at, 0);
    }
  }
  if (mutation)
    expect(state.plots[0]!.plant!.incidents).toContainEqual(
      expect.objectContaining({ kind: 'mutation', productionDay: 1 }),
    );
  else expect(state.plots[0]!.plant!.incidents).toEqual([]);
  expect(
    getSpiritGardenPlantView(state.plots[0]!.plant!, '渡劫').exhausted,
  ).toBe(true);
  return {
    revenue,
    investment,
    net: revenue - investment,
    products,
    qi,
    calendarDays: 28 + view.matureMs / day,
  };
}

describe('spirit garden crop economics at ordinary prices', () => {
  it('keeps both directions profitable after the highest regular seed purchase price', () => {
    for (const species of SPIRIT_GARDEN_SPECIES)
      for (const branch of ['abundance', 'essence'] as const)
        expect(fullCropReturn(species, branch, false, 1.2).net).toBeGreaterThan(
          0,
        );
  });

  it('keeps frequent low-grade harvests and bounds full-crop daily cash after seed costs', () => {
    const dailyNetBudgets = [
      500, 2_500, 5_500, 10_000, 32_000, 150_000, 500_000, 1_800_000,
    ];
    for (const species of SPIRIT_GARDEN_SPECIES) {
      const index = QUALITY_VALUES.indexOf(species.quality);
      for (const branch of ['abundance', 'essence'] as const) {
        const crop = fullCropReturn(species, branch);
        expect((6 * crop.net) / crop.calendarDays).toBeLessThan(
          dailyNetBudgets[index]!,
        );
      }
    }
    const common = SPIRIT_GARDEN_SPECIES.find(
      (entry) => entry.quality === '凡品',
    )!;
    expect(
      getSpiritGardenOutput({
        speciesId: common.id,
        quality: common.quality,
        branch: 'abundance',
      }).cycleMs,
    ).toBe(8 * hour);
    const divine = SPIRIT_GARDEN_SPECIES.find(
      (entry) => entry.quality === '神品',
    )!;
    const crop = fullCropReturn(divine, 'abundance');
    expect(
      crop.products.reduce((sum, product) => sum + product.quantity, 0),
    ).toBe(15);
    expect(crop.investment).toBe(1_000_000);
    expect(crop.net).toBe(8_000_000);
  });

  it('keeps every divine direction at 1.2–1.8 million net per day across seed prices and mutation', () => {
    for (const species of SPIRIT_GARDEN_SPECIES.filter(
      (entry) => entry.quality === '神品',
    ))
      for (const branch of ['abundance', 'essence'] as const)
        for (const seedPriceRatio of [0.95 * 0.65, 1, 1.2])
          for (const mutation of [false, true]) {
            const crop = fullCropReturn(
              species,
              branch,
              false,
              seedPriceRatio,
              mutation,
            );
            const dailyNet = (6 * crop.net) / crop.calendarDays;
            expect(dailyNet).toBeGreaterThanOrEqual(1_200_000);
            expect(dailyNet).toBeLessThanOrEqual(1_800_000);
          }
  });

  it('delivers multiple recurring divine harvests within one lifetime at ordinary prices', () => {
    const expectedRounds = { herb: 7, spirit_fruit: 51, tcdb: 5 };
    for (const species of SPIRIT_GARDEN_SPECIES.filter(
      (entry) => entry.quality === '神品',
    ))
      for (const branch of ['abundance', 'essence'] as const) {
        const output = getSpiritGardenOutput({
          speciesId: species.id,
          quality: species.quality,
          branch,
        });
        const crop = fullCropReturn(species, branch);
        const recurringQuantity =
          crop.products
            .filter((product) => product.kind === output.kind)
            .reduce((sum, product) => sum + product.quantity, 0) -
          (output.kind === 'herb' ? 1 : 0);
        expect(recurringQuantity / output.quantity).toBe(
          expectedRounds[output.kind],
        );
        expect(output.cycleMs).toBeLessThanOrEqual(7 * day);
      }
  });

  it('never recovers even the cheapest ordinary seed from the immediate maturity gift', () => {
    for (const quality of QUALITY_VALUES)
      expect(normalHerbPrices[quality]).toBeLessThan(
        BASE_PRICES[quality] * 0.95 * 0.65,
      );
  });

  it('makes evolved production match native same-quality output without a faster low-seed multiplier', () => {
    for (let index = 0; index < QUALITY_VALUES.length - 1; index += 1) {
      const source = SPIRIT_GARDEN_SPECIES.find(
        (entry) => entry.quality === QUALITY_VALUES[index],
      )!;
      for (const branch of ['abundance', 'essence'] as const) {
        const evolvedOutput = getSpiritGardenOutput({
          speciesId: source.id,
          quality: source.quality,
          branch,
          evolved: true,
        });
        const native = SPIRIT_GARDEN_SPECIES.find(
          (entry) =>
            entry.quality === QUALITY_VALUES[index + 1] &&
            (branch === 'abundance' ||
              entry.branches.essence.output.kind === evolvedOutput.kind),
        )!;
        const nativeOutput = getSpiritGardenOutput({
          speciesId: native.id,
          quality: native.quality,
          branch,
        });
        expect(evolvedOutput.cycleMs).toBe(nativeOutput.cycleMs);
        expect(evolvedOutput.quantity).toBe(nativeOutput.quantity);
        const evolved = fullCropReturn(source, branch, true);
        expect(
          evolved.products.some(
            (product) => product.quality === native.quality,
          ),
        ).toBe(true);
        expect(evolved.qi).toBe(
          fullCropReturn(source, branch).qi +
            SPIRIT_GARDEN_EVOLUTION_QI_COSTS[source.quality],
        );
      }
    }
  });

  it('quotes one maturity and direction payment plus optional evolution inputs', () => {
    const expectedQi = [12, 18, 24, 32, 40, 50, 60, 0];
    const maturityQi = [2, 3, 4, 6, 8, 12, 16, 20];
    const directionQi = [3, 5, 6, 9, 12, 18, 24, 30];
    for (const [index, quality] of QUALITY_VALUES.entries()) {
      const species = SPIRIT_GARDEN_SPECIES.find(
        (entry) => entry.quality === quality,
      )!;
      const state = plantSpiritGardenSeed(
        createSpiritGarden(),
        0,
        readSpiritFieldSeedSpec(
          buildSpiritGardenSeed(species.id, quality).details,
        )!.plant,
        plantId,
        '渡劫',
        start,
      );
      const view = getSpiritGardenPlantView(state.plots[0]!.plant!, '渡劫');
      const cost = view.evolveCost;
      expect(view.matureQiCost).toBe(maturityQi[index]);
      expect(view.branchQiCost).toBe(directionQi[index]);
      expect(fullCropReturn(species, 'abundance').qi).toBe(
        maturityQi[index]! + directionQi[index]!,
      );
      expect(SPIRIT_GARDEN_EVOLUTION_QI_COSTS[quality]).toBe(expectedQi[index]);
      expect(cost.qi).toBe(expectedQi[index]);
      if (index < QUALITY_VALUES.length - 1)
        expect(cost.spiritStones).toBe(
          Math.ceil(BASE_PRICES[QUALITY_VALUES[index + 1]!] * 0.35),
        );
    }
  });
});

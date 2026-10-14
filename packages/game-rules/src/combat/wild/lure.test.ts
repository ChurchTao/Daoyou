import { BEAST_RARE_SPECIES_IDS } from '@daoyou/game-content/beasts';
import { WILD_PACK } from '@daoyou/game-content/combat/wild';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import { expect, it } from 'vitest';
import { generateWildEncounter } from './generator.js';
import {
  BEAST_LURE_RATE_MULTIPLIER,
  BEAST_LURE_SEARCHES,
  BEAST_LURE_STATUS_KEY,
  beastLureCharges,
  igniteBeastLure,
  spendBeastLureCharge,
} from './lure.js';

const blank = {
  version: 1,
  statuses: [],
  timestamps: {},
} as unknown as CultivatorCondition;

it('引妖香点燃后给出 25 次、4 倍，再次点燃回到 25 次', () => {
  const first = igniteBeastLure(blank, new Date('2026-10-14T00:00:00.000Z'));
  expect(beastLureCharges(first)).toBe(BEAST_LURE_SEARCHES);
  expect(first.statuses).toEqual([
    expect.objectContaining({
      key: BEAST_LURE_STATUS_KEY,
      usesRemaining: 25,
      payload: { rateMultiplier: BEAST_LURE_RATE_MULTIPLIER },
    }),
  ]);
  const spent = spendBeastLureCharge(first).condition as CultivatorCondition;
  const renewed = igniteBeastLure(spent);
  expect(beastLureCharges(renewed)).toBe(25);
  expect(renewed.statuses.filter((status) => status.key === BEAST_LURE_STATUS_KEY)).toHaveLength(1);
});

it('成功寻觅消耗一次，用尽后状态消失，倍率不超过 4', () => {
  let condition: unknown = igniteBeastLure(blank);
  const multipliers: number[] = [];
  for (let remaining = 25; remaining >= 1; remaining -= 1) {
    expect(beastLureCharges(condition)).toBe(remaining);
    const spent = spendBeastLureCharge(condition);
    expect(spent.spent).toBe(true);
    expect(spent.multiplier).toBe(4);
    multipliers.push(spent.multiplier);
    condition = spent.condition;
  }
  expect(beastLureCharges(condition)).toBe(0);
  expect(spendBeastLureCharge(condition)).toEqual({
    condition,
    multiplier: 1,
    spent: false,
  });
  expect(spendBeastLureCharge(null)).toEqual({
    condition: null,
    multiplier: 1,
    spent: false,
  });
  const tampered = igniteBeastLure(blank);
  tampered.statuses[0]!.payload = { rateMultiplier: 100 };
  expect(spendBeastLureCharge(tampered).multiplier).toBe(4);
  expect(multipliers).toHaveLength(25);
});

it('4 倍提高出现阈值，编组只数保持不变，无稀有池的地区仍只出普通物种', () => {
  const nodeId = WILD_PACK.regions[0]!.nodeId;
  expect(generateWildEncounter(nodeId, 7, WILD_PACK, 1)).toEqual(
    generateWildEncounter(nodeId, 7),
  );
  expect(generateWildEncounter(nodeId, 7, WILD_PACK, 99)).toEqual(
    generateWildEncounter(nodeId, 7, WILD_PACK, 4),
  );
  expect(generateWildEncounter(nodeId, 7, WILD_PACK, 0)).toEqual(
    generateWildEncounter(nodeId, 7),
  );
  let changed = 0;
  for (let seed = 0; seed < 400; seed += 1) {
    const base = generateWildEncounter(nodeId, seed);
    const boosted = generateWildEncounter(nodeId, seed, WILD_PACK, 4);
    expect(boosted).toHaveLength(base.length);
    base.forEach((combatant, index) => {
      if (combatant.isMutant) expect(boosted[index]!.isMutant).toBe(true);
      if (Boolean(combatant.isMutant) !== Boolean(boosted[index]!.isMutant)) {
        changed += 1;
      }
    });
  }
  expect(changed).toBeGreaterThan(0);
  const plain = WILD_PACK.regions.find((region) => !region.rareChance);
  expect(plain).toBeTruthy();
  for (let seed = 0; seed < 80; seed += 1) {
    expect(
      generateWildEncounter(plain!.nodeId, seed, WILD_PACK, 4).every(
        (combatant) => !BEAST_RARE_SPECIES_IDS.has(combatant.speciesId),
      ),
    ).toBe(true);
  }
});

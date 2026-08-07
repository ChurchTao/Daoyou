import {
  blackMarketUnit,
  classifyBlackMarketReveal,
  createBlackMarketPricing,
  evaluateBlackMarketHaggle,
} from './blackMarketRules';

describe('black market rules', () => {
  it('keeps personalized pricing deterministic and within design bounds', () => {
    const pricing = createBlackMarketPricing({
      seed: 'secret-player-cycle-seed',
      npcId: 'urgent-cultivator',
      anchorValue: 10_000,
    });

    expect(pricing).toEqual(
      createBlackMarketPricing({
        seed: 'secret-player-cycle-seed',
        npcId: 'urgent-cultivator',
        anchorValue: 10_000,
      }),
    );
    expect(pricing.initialPrice).toBeGreaterThanOrEqual(12_000);
    expect(pricing.initialPrice).toBeLessThanOrEqual(20_000);
    expect(pricing.floorPrice).toBeGreaterThanOrEqual(5_000);
    expect(pricing.floorPrice).toBeLessThanOrEqual(10_000);
  });

  it('uses a stable unit value while separating labels', () => {
    const first = blackMarketUnit('seed', 'initial');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(first).toBe(blackMarketUnit('seed', 'initial'));
    expect(first).not.toBe(blackMarketUnit('seed', 'floor'));
  });

  it('never lets negotiation cross the hidden floor', () => {
    const decision = evaluateBlackMarketHaggle({
      seed: 'secret-player-cycle-seed',
      npcId: 'silent-elder',
      currentPrice: 18_000,
      floorPrice: 8_000,
      offeredPrice: 2_000,
      patience: 4,
      strategy: 'reason',
      argumentQuality: 2,
      validEvidenceCount: 2,
      randomRoll: 1,
    });

    expect(decision.nextPrice).toBeGreaterThanOrEqual(8_000);
  });

  it('gives the same npc different hidden negotiation profiles across cycles', () => {
    const profiles = Array.from({ length: 80 }, (_, index) =>
      createBlackMarketPricing({
        seed: `cycle-${index}`,
        npcId: 'silent-elder',
        anchorValue: 10_000,
      }),
    );

    expect(profiles.some((profile) => profile.floorPrice === 10_000)).toBe(
      true,
    );
    expect(profiles.some((profile) => profile.floorPrice < 8_000)).toBe(true);
    expect(
      new Set(profiles.map((profile) => profile.patience)).size,
    ).toBeGreaterThan(1);
  });

  it('grades both losses and windfalls from the server anchor', () => {
    expect(classifyBlackMarketReveal(18_000, 10_000).rating).toBe('血亏');
    expect(classifyBlackMarketReveal(10_000, 10_000).rating).toBe('公允');
    expect(classifyBlackMarketReveal(5_000, 10_000).rating).toBe('天降横财');
  });
});

import {
  applyBlackMarketPriceDecision,
  assessOffer,
} from './blackMarketNegotiation';

describe('black market negotiation', () => {
  it('assesses offers relative to the hidden owner floor', () => {
    expect(
      assessOffer({ currentPrice: 10_000, floorPrice: 5_000, offeredPrice: 2_000 }),
    ).toBe('insulting');
    expect(
      assessOffer({ currentPrice: 10_000, floorPrice: 5_000, offeredPrice: 5_500 }),
    ).toBe('low');
    expect(
      assessOffer({ currentPrice: 10_000, floorPrice: 5_000, offeredPrice: 8_000 }),
    ).toBe('reasonable');
    expect(
      assessOffer({ currentPrice: 10_000, floorPrice: 5_000, offeredPrice: 9_500 }),
    ).toBe('strong');
  });

  it('accepts an offer above the owner floor', () => {
    const result = applyBlackMarketPriceDecision({
      currentPrice: 10_000,
      floorPrice: 5_000,
      offeredPrice: 8_000,
      patience: 3,
      decision: 'accept',
      concession: 0.5,
      patienceDelta: -1,
    });

    expect(result).toEqual({
      outcome: 'accepted',
      previousPrice: 10_000,
      nextPrice: 8_000,
      nextPatience: 3,
    });
  });

  it('turns an accept below floor into a counter at the floor', () => {
    const result = applyBlackMarketPriceDecision({
      currentPrice: 10_000,
      floorPrice: 6_000,
      offeredPrice: 4_000,
      patience: 3,
      decision: 'accept',
      concession: 1,
      patienceDelta: -1,
    });

    expect(result.outcome).toBe('countered');
    expect(result.nextPrice).toBe(6_000);
    expect(result.nextPatience).toBe(2);
  });

  it('applies concession toward the hidden floor', () => {
    const result = applyBlackMarketPriceDecision({
      currentPrice: 10_000,
      floorPrice: 5_000,
      offeredPrice: 4_000,
      patience: 3,
      decision: 'counter',
      concession: 0.5,
      patienceDelta: -1,
    });

    expect(result.outcome).toBe('countered');
    expect(result.nextPrice).toBe(7_500);
    expect(result.nextPatience).toBe(2);
  });

  it('locks the price when patience reaches zero', () => {
    const result = applyBlackMarketPriceDecision({
      currentPrice: 10_000,
      floorPrice: 5_000,
      offeredPrice: 4_000,
      patience: 1,
      decision: 'counter',
      concession: 0.5,
      patienceDelta: -1,
    });

    expect(result.outcome).toBe('locked');
    expect(result.nextPrice).toBe(7_500);
    expect(result.nextPatience).toBe(0);
  });

  it('keeps every result inside floor and current price', () => {
    for (const decision of ['accept', 'counter', 'reject'] as const) {
      for (const concession of [0, 0.25, 0.5, 0.75, 1]) {
        const result = applyBlackMarketPriceDecision({
          currentPrice: 10_000,
          floorPrice: 6_000,
          offeredPrice: 3_000,
          patience: 4,
          decision,
          concession,
          patienceDelta: -2,
        });
        expect(result.nextPrice).toBeGreaterThanOrEqual(6_000);
        expect(result.nextPrice).toBeLessThanOrEqual(10_000);
      }
    }
  });

  it('ends negotiation immediately when the npc closes the conversation', () => {
    const result = applyBlackMarketPriceDecision({
      currentPrice: 10_000,
      floorPrice: 6_000,
      offeredPrice: 7_000,
      patience: 3,
      decision: 'end',
      concession: 0,
      patienceDelta: -1,
    });
    expect(result).toEqual({
      outcome: 'locked',
      previousPrice: 10_000,
      nextPrice: 10_000,
      nextPatience: 0,
    });
  });
});

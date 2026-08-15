import {
  computeBlackMarketTrueValue,
  computeOwnerAskPrice,
  applyBlackMarketBeliefPressure,
  createBlackMarketPricing,
  flexibilityLevel,
  initialPatience,
  sampleCognitionMultiplier,
} from './blackMarketPricing';

describe('black market pricing', () => {
  it('computes true value from base price and type multiplier', () => {
    expect(computeBlackMarketTrueValue({ quality: '真品', materialType: 'herb' })).toBe(3000);
    expect(computeBlackMarketTrueValue({ quality: '真品', materialType: 'tcdb' })).toBe(7500);
  });

  it('keeps the cognition multiplier inside the configured range', () => {
    for (let index = 0; index < 200; index += 1) {
      const multiplier = sampleCognitionMultiplier(`seed-${index}`);
      expect(multiplier).toBeGreaterThanOrEqual(0.05);
      expect(multiplier).toBeLessThanOrEqual(3);
    }
  });

  it('keeps owner ask price positive and floor inside the owner ask price', () => {
    for (let index = 0; index < 200; index += 1) {
      const pricing = createBlackMarketPricing({
        seed: `seed-${index}`,
        npcId: 'silent-elder',
        trueValue: 10_000,
      });
      expect(pricing.initialPrice).toBeGreaterThanOrEqual(1);
      expect(pricing.currentPrice).toBe(pricing.initialPrice);
      expect(pricing.currentFloorPrice).toBeGreaterThanOrEqual(
        pricing.floorMinPrice,
      );
      expect(pricing.currentFloorPrice).toBeLessThanOrEqual(
        pricing.floorMaxPrice,
      );
    }
  });

  it('uses deterministic patience and flexibility levels', () => {
    expect(initialPatience('unyielding')).toBe(4);
    expect(initialPatience('shrewd')).toBe(3);
    expect(flexibilityLevel(0.95)).toBe('firm');
    expect(flexibilityLevel(0.8)).toBe('cautious');
    expect(flexibilityLevel(0.7)).toBe('flexible');
    expect(flexibilityLevel(0.5)).toBe('desperate');
  });

  it('computes the owner ask price directly', () => {
    expect(computeOwnerAskPrice(10_000, 1.5)).toBe(15_000);
  });

  it('applies bounded belief pressure and requires evidence to lower the floor', () => {
    const input = {
      initialPrice: 10_000,
      currentPrice: 9_000,
      floorMinPrice: 6_000,
      floorMaxPrice: 9_500,
      currentFloorPrice: 7_500,
    };
    expect(
      applyBlackMarketBeliefPressure({
        ...input,
        pressure: -2,
        hasCredibleEvidence: false,
      }),
    ).toBe(7_500);
    expect(
      applyBlackMarketBeliefPressure({
        ...input,
        pressure: -2,
        hasCredibleEvidence: true,
      }),
    ).toBe(6_900);
    expect(
      applyBlackMarketBeliefPressure({
        ...input,
        currentFloorPrice: 8_900,
        pressure: 1,
        hasCredibleEvidence: false,
      }),
    ).toBe(9_000);
  });
});

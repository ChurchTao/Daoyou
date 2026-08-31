import { describe, expect, it } from 'vitest';
import { getSpiritFieldMarketSeedSlotCount } from './marketOfferings';

describe('spirit-field market offerings', () => {
  const ratios = { common: 0.75, treasure: 0.625, heaven: 0.5 } as const;

  it('does not force seed slots into ordinary markets', () => {
    expect(getSpiritFieldMarketSeedSlotCount('common', 8)).toBe(0);
    expect(getSpiritFieldMarketSeedSlotCount('heaven', 8, {})).toBe(0);
  });

  it('converts the dedicated market ratios into bounded slot counts', () => {
    expect(getSpiritFieldMarketSeedSlotCount('common', 8, ratios)).toBe(6);
    expect(getSpiritFieldMarketSeedSlotCount('treasure', 8, ratios)).toBe(5);
    expect(getSpiritFieldMarketSeedSlotCount('heaven', 8, ratios)).toBe(4);
    expect(getSpiritFieldMarketSeedSlotCount('black', 8, ratios)).toBe(0);
    expect(getSpiritFieldMarketSeedSlotCount('common', 3, { common: 2 })).toBe(3);
  });
});

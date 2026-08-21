import { describe, expect, it } from 'vitest';
import {
  getSpiritFieldMarketSeedSlotCount,
  SPIRIT_FIELD_MARKET_SEED_SLOTS,
} from './marketOfferings';

describe('spirit-field market offerings', () => {
  it('reserves seed slots for non-black layers only', () => {
    expect(SPIRIT_FIELD_MARKET_SEED_SLOTS.common).toBe(2);
    expect(SPIRIT_FIELD_MARKET_SEED_SLOTS.treasure).toBe(2);
    expect(SPIRIT_FIELD_MARKET_SEED_SLOTS.heaven).toBe(1);
    expect(SPIRIT_FIELD_MARKET_SEED_SLOTS.black).toBe(0);
  });

  it('returns slot count without depending on a hard-coded plant catalog', () => {
    expect(getSpiritFieldMarketSeedSlotCount('common')).toBe(2);
    expect(getSpiritFieldMarketSeedSlotCount('black')).toBe(0);
  });
});

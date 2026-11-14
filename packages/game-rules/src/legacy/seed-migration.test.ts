import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import { describe, expect, it } from 'vitest';
import { getSpiritGardenSeedCandidates } from '../spirit-field/garden.js';
import { drawLegacySeedConversion } from './seed-migration.js';

describe('legacy seed conversion', () => {
  it('keeps quality and gives every current species an equal quarter of the roll', () => {
    for (const quality of QUALITY_VALUES) {
      const species = getSpiritGardenSeedCandidates(quality);
      for (let index = 0; index < species.length; index++) {
        for (const roll of [index / 4, (index + 1) / 4 - Number.EPSILON])
          expect(drawLegacySeedConversion(quality, 1, () => roll)).toEqual([
            { speciesId: species[index]!.id, quality, quantity: 1 },
          ]);
      }
    }
  });

  it('draws once per consumed seed and groups repeats without losing quantity', () => {
    const rolls = [0, 0.25, 0.5, 0.75, 0];
    const result = drawLegacySeedConversion('凡品', 5, () => rolls.shift()!);
    expect(result.map((seed) => seed.quantity)).toEqual([2, 1, 1, 1]);
    expect(result.reduce((sum, seed) => sum + seed.quantity, 0)).toBe(5);
    expect(rolls).toEqual([]);
  });

  it('rejects invalid quantity and random values', () => {
    for (const amount of [0, -1, 1.5, 1000, NaN])
      expect(() => drawLegacySeedConversion('凡品', amount, () => 0)).toThrow();
    for (const roll of [-1, 1, Infinity, NaN])
      expect(() => drawLegacySeedConversion('神品', 1, () => roll)).toThrow();
  });
});

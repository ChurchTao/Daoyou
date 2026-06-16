import { describe, expect, it } from 'vitest';
import {
  buildCultivationBoostOperation,
  CULTIVATION_BOOST_BY_QUALITY,
  normalizeCultivationBoostPercent,
} from './cultivationBoost';

describe('cultivation boost scaling', () => {
  it('uses a non-linear quality curve from 50% to 400%', () => {
    expect(CULTIVATION_BOOST_BY_QUALITY).toEqual({
      凡品: 0.5,
      灵品: 0.6411,
      玄品: 0.943,
      真品: 1.3648,
      地品: 1.8901,
      天品: 2.5089,
      仙品: 3.214,
      神品: 4,
    });
    expect(
      CULTIVATION_BOOST_BY_QUALITY['地品'] -
        CULTIVATION_BOOST_BY_QUALITY['真品'],
    ).toBeGreaterThan(
      CULTIVATION_BOOST_BY_QUALITY['玄品'] -
        CULTIVATION_BOOST_BY_QUALITY['灵品'],
    );
  });

  it('caps final cultivation boost between 30% and 700%', () => {
    expect(normalizeCultivationBoostPercent(0.1)).toBe(0.3);
    expect(normalizeCultivationBoostPercent(9)).toBe(7);

    expect(buildCultivationBoostOperation('神品', 2).payload).toEqual({
      boostPercent: 7,
      retreatExpMultiplier: 8,
    });
  });
});

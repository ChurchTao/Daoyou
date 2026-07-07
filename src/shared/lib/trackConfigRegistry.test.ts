import { describe, expect, it } from 'vitest';
import { getTrackConfig } from './trackConfigRegistry';

describe('trackConfigRegistry', () => {
  it('uses the tuned linear body cultivation thresholds', () => {
    const thresholdByLevel = getTrackConfig('body.skin').thresholdByLevel;

    expect(thresholdByLevel(0)).toBe(100);
    expect(thresholdByLevel(1)).toBe(170);
    expect(thresholdByLevel(10)).toBe(800);
  });

  it('uses the tuned linear marrow-wash thresholds', () => {
    const thresholdByLevel = getTrackConfig('marrow_wash').thresholdByLevel;

    expect(thresholdByLevel(0)).toBe(120);
    expect(thresholdByLevel(1)).toBe(180);
    expect(thresholdByLevel(10)).toBe(720);
  });
});

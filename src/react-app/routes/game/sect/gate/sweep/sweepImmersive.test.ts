import { describe, expect, it } from 'vitest';
import { shouldBlockSweepForPortrait } from './sweepImmersive';

describe('sweep landscape gate', () => {
  it('blocks only portrait coarse-pointer viewports', () => {
    expect(
      shouldBlockSweepForPortrait({
        coarsePointer: true,
        landscape: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockSweepForPortrait({
        coarsePointer: true,
        landscape: true,
      }),
    ).toBe(false);
    expect(
      shouldBlockSweepForPortrait({
        coarsePointer: false,
        landscape: false,
      }),
    ).toBe(false);
  });
});

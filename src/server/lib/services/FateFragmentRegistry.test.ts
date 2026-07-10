import { describe, expect, it } from 'vitest';

import { getPositiveFateEffects } from './FateFragmentRegistry';

describe('FateFragmentRegistry market purchase discount', () => {
  it('keeps generated market purchase discount range modest', () => {
    const definition = getPositiveFateEffects().find(
      (effect) => effect.id === 'market-purchase-discount',
    );

    expect(definition?.baseRange).toEqual([0.02, 0.04]);
  });
});

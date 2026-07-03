import { describe, expect, it } from 'vitest';

import {
  getDominantMarketMaterialTypes,
  getMarketNodeSwitchOptions,
  resolveMarketSwitchLayer,
} from './marketConfig';

describe('marketConfig display helpers', () => {
  it('resolves dominant material types by region weight', () => {
    expect(getDominantMarketMaterialTypes('TN_YUE_01')).toEqual([
      'herb',
      'aux',
      'ore',
    ]);
    expect(getDominantMarketMaterialTypes('LX_INNER_01')).toEqual([
      'monster',
      'ore',
      'tcdb',
    ]);
  });

  it('returns enabled market node switch options', () => {
    const options = getMarketNodeSwitchOptions();
    const ids = options.map((option) => option.id);

    expect(ids).toContain('TN_YUE_01');
    expect(ids).toContain('LX_INNER_01');
    expect(ids).toContain('DJ_CENTRAL_01');
    expect(ids).not.toContain('TN_YUE_02');
    expect(options.find((option) => option.id === 'DJ_CENTRAL_01')).toMatchObject({
      name: '大晋·晋京',
      region: '大晋',
      dominantMaterialTypes: ['tcdb', 'ore', 'aux'],
    });
  });

  it('falls back to an available layer when switching market nodes', () => {
    expect(resolveMarketSwitchLayer('TN_YUE_01', 'black')).toBe('black');
    expect(resolveMarketSwitchLayer('TN_YUE_02', 'black')).toBe('common');
  });
});

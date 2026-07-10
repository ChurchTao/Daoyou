import { describe, expect, it } from 'vitest';

import {
  getDominantMarketMaterialTypes,
  getLayerConfig,
  getMarketNodeSwitchOptions,
  getMarketProfileHint,
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

  it('configures black market as high-risk high-tier stock', () => {
    const black = getLayerConfig('black');

    expect(black.rankRange).toEqual({ min: '真品', max: '神品' });
    expect(black.minHighTierCount).toBe(2);
    expect(black.qualityWeights).toMatchObject({
      真品: 45,
      地品: 25,
      天品: 17,
      仙品: 9,
      神品: 4,
    });
    expect(black.qualityWeights).not.toHaveProperty('灵品');
    expect(black.qualityWeights).not.toHaveProperty('玄品');
  });

  it('shows black market risk hint without exact probability', () => {
    expect(getMarketProfileHint('TN_YUE_01', 'black').layerHints).toContain(
      '黑市疑货多，价格浮动大，高阶材料概率更高。',
    );
  });
});

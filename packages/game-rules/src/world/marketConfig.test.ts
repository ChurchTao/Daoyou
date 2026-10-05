import { describe, expect, it } from 'vitest';

import {
  getDominantMarketMaterialTypes,
  getLayerConfig,
  getMarketConfigByNodeId,
  getMarketNodeSwitchOptions,
  getMarketProfileHint,
  resolveMarketSwitchLayer,
  validateLayerAccess,
} from './marketConfig.js';

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
    expect(getDominantMarketMaterialTypes('TN_BAICAO_01')).toEqual([
      'seed',
      'herb',
      'aux',
    ]);
  });

  it('returns enabled market node switch options', () => {
    const options = getMarketNodeSwitchOptions();
    const ids = options.map((option) => option.id);

    expect(ids).toContain('TN_YUE_01');
    expect(ids).toContain('LX_INNER_01');
    expect(ids).toContain('DJ_CENTRAL_01');
    expect(ids).toContain('TN_BAICAO_01');
    expect(ids).toContain('TN_YULING_01');
    expect(ids).not.toContain('TN_YUE_02');
    expect(
      options.find((option) => option.id === 'DJ_CENTRAL_01'),
    ).toMatchObject({
      name: '大晋·晋京',
      region: '大晋',
      dominantMaterialTypes: ['tcdb', 'ore', 'aux'],
    });
    expect(
      options.find((option) => option.id === 'TN_BAICAO_01'),
    ).toMatchObject({
      name: '天南·百草集',
      region: '天南',
      allowedLayers: ['common', 'treasure', 'heaven'],
      dominantMaterialTypes: ['seed', 'herb', 'aux'],
    });
    expect(
      options.find((option) => option.id === 'TN_YULING_01'),
    ).toMatchObject({
      name: '天南·御灵集',
      allowedLayers: ['common', 'treasure', 'heaven'],
    });
  });

  it('falls back to an available layer when switching market nodes', () => {
    expect(resolveMarketSwitchLayer('TN_YUE_01', 'black')).toBe('black');
    expect(resolveMarketSwitchLayer('TN_YUE_02', 'black')).toBe('common');
    expect(resolveMarketSwitchLayer('TN_BAIQI_01', 'heaven')).toBe('common');
  });

  it('keeps early equipment stock accessible only through its intended layers', () => {
    const config = getMarketConfigByNodeId('TN_BAIQI_01');
    expect(validateLayerAccess('炼气', 'common', config).allowed).toBe(true);
    expect(validateLayerAccess('炼气', 'treasure', config).allowed).toBe(false);
    expect(validateLayerAccess('筑基', 'treasure', config).allowed).toBe(true);
    expect(validateLayerAccess('元婴', 'heaven', config).allowed).toBe(false);
    expect(validateLayerAccess('筑基', 'black', config).allowed).toBe(false);
  });

  it('configures black market as high-risk high-tier stock', () => {
    const black = getLayerConfig('black');

    expect(black.rankRange).toEqual({ min: '地品', max: '神品' });
    expect(black.minHighTierCount).toBe(2);
    expect(black.qualityWeights).toMatchObject({
      地品: 25,
      天品: 17,
      仙品: 9,
      神品: 4,
    });
    expect(black.qualityWeights).not.toHaveProperty('灵品');
    expect(black.qualityWeights).not.toHaveProperty('玄品');
    expect(black.qualityWeights).not.toHaveProperty('真品');
  });

  it('shows black market risk hint without exact probability', () => {
    expect(getMarketProfileHint('TN_YUE_01', 'black').layerHints).toContain(
      '黑市疑货多，价格浮动大，高阶材料概率更高。',
    );
  });
});

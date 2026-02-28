import {
  getLayerConfig,
  getMarketConfigByNodeId,
  getNodeRegionTags,
  validateLayerAccess,
} from './marketConfig';

describe('market config', () => {
  it('loads node market config from map', () => {
    const config = getMarketConfigByNodeId('TN_YUE_01');
    expect(config?.enabled).toBe(true);
    expect(config?.allowed_layers).toContain('common');
  });

  it('validates layer access by realm gate', () => {
    const config = getMarketConfigByNodeId('TN_YUE_01');
    const denied = validateLayerAccess('炼气', 'treasure', config);
    const allowed = validateLayerAccess('元婴', 'heaven', config);

    expect(denied.allowed).toBe(false);
    expect(denied.reason).toContain('境界不足');
    expect(allowed.allowed).toBe(true);
  });

  it('returns region tags for weighted generation context', () => {
    const tags = getNodeRegionTags('LX_OUTER_01');
    expect(tags.join('|')).toContain('乱星海');
    expect(tags.length).toBeGreaterThan(2);
  });

  it('has black market mystery chance in layer config', () => {
    const black = getLayerConfig('black');
    expect(black.mysteryChance).toBeGreaterThan(0);
    expect(black.rankRange.min).toBe('玄品');
  });
});

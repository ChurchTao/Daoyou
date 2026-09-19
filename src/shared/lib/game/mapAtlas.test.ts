import { describe, expect, it } from 'vitest';
import {
  ATLAS_REGIONS,
  getAtlasLocations,
  getAtlasRegion,
  TIANNAN_ANCHORS,
} from './mapAtlas';

describe('world atlas location coverage', () => {
  it('resolves every existing location, including satellites and sects, to a region', () => {
    for (const location of getAtlasLocations()) {
      expect(getAtlasRegion(location), location.id).toBeDefined();
    }
    expect(new Set(ATLAS_REGIONS.map((region) => region.id)).size).toBe(
      ATLAS_REGIONS.length,
    );
  });

  it('anchors exactly the existing Tiannan locations without introducing gameplay nodes', () => {
    const expected = getAtlasLocations()
      .filter((location) => getAtlasRegion(location)?.id === 'tiannan')
      .map((location) => location.id)
      .sort();
    expect(Object.keys(TIANNAN_ANCHORS).sort()).toEqual(expected);
    for (const [x, y] of Object.values(TIANNAN_ANCHORS)) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1);
    }
  });
});

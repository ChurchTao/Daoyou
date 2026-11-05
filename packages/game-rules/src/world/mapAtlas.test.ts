import { describe, expect, it } from 'vitest';
import {
  ATLAS_ANCHORS,
  ATLAS_REGIONS,
  getAtlasLocations,
  getAtlasRegion,
} from './mapAtlas.js';
import { getWorldMapLocation } from '@daoyou/game-content/world/map';

describe('world atlas location coverage', () => {
  it('splits presentation regions by parent without changing the business region', () => {
    for (const [parentId, region] of [
      ['DJ_NORTH_01', 'northland'],
      ['DJ_SOUTH_01', 'nanjiang'],
    ] as const) {
      const parent = getWorldMapLocation(parentId)!;
      expect(parent).toMatchObject({ region: '大晋' });
      expect(getAtlasRegion(parent)?.id).toBe(region);
      const children = getAtlasLocations().filter(
        (location) => 'parent_id' in location && location.parent_id === parentId,
      );
      expect(children.length).toBeGreaterThan(0);
      for (const child of children) {
        expect(getAtlasRegion(child)?.id, child.id).toBe(region);
      }
    }
  });

  it('resolves every existing location, including satellites and sects, to a region', () => {
    for (const location of getAtlasLocations()) {
      expect(getAtlasRegion(location), location.id).toBeDefined();
    }
    expect(new Set(ATLAS_REGIONS.map((region) => region.id)).size).toBe(
      ATLAS_REGIONS.length,
    );
  });

  it.each(Object.entries(ATLAS_ANCHORS))(
    'anchors exactly the existing %s locations without introducing gameplay nodes',
    (region, anchors) => {
      const expected = getAtlasLocations()
        .filter((location) => getAtlasRegion(location)?.id === region)
        .map((location) => location.id)
        .sort();
      expect(Object.keys(anchors).sort()).toEqual(expected);
      for (const [x, y] of Object.values(anchors)) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(1);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(1);
      }
    },
  );
});

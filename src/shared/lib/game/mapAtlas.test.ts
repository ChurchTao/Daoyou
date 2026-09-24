import { describe, expect, it } from 'vitest';
import {
  ATLAS_ANCHORS,
  ATLAS_REGIONS,
  getAtlasLocations,
  getAtlasRegion,
} from './mapAtlas';
import { getWorldMapLocation } from './mapSystem';

describe('world atlas location coverage', () => {
  it.each([
    ['ML_PLAINS_01', 'mulan', '慕兰草原'],
    ['DJ_CENTRAL_01', 'dajin', '大晋皇朝'],
  ])(
    'preserves %s region resolution when its display name changes',
    (id, region, name) => {
      const location = getWorldMapLocation(id);
      expect(location).toBeDefined();
      expect(getAtlasRegion(location!)).toMatchObject({ id: region, name });
    },
  );

  it.each([
    ['northland', ['DJ_NORTH_01', 'SAT_DJ_05', 'SAT_DJ_09']],
    [
      'nanjiang',
      [
        'DJ_SOUTH_01',
        'SAT_DJ_01',
        'WILD_DJ_BANYAN',
        'WILD_DJ_DARKCAVE',
        'SECT_WUXIANG',
      ],
    ],
  ] as const)(
    'separates %s with its children while retaining the original business region',
    (region, expected) => {
      const locations = getAtlasLocations().filter(
        (location) => getAtlasRegion(location)?.id === region,
      );
      expect(locations.map((location) => location.id).sort()).toEqual(
        [...expected].sort(),
      );
      for (const location of locations) {
        const parent =
          'region' in location
            ? location
            : getWorldMapLocation(location.parent_id);
        expect(parent && 'region' in parent && parent.region).toBe('大晋');
      }
    },
  );

  it('keeps 20 locations in Dajin after separating north and south', () => {
    expect(
      getAtlasLocations().filter(
        (location) => getAtlasRegion(location)?.id === 'dajin',
      ),
    ).toHaveLength(20);
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

import {
  getAllMapNodes,
  getMapAreaContent,
  getWorldMapLocation,
} from '@daoyou/game-content/world/map';
import { describe, expect, it } from 'vitest';
import {
  ATLAS_ANCHORS,
  ATLAS_REGIONS,
  getAtlasAreaLocations,
  getAtlasLocations,
  getAtlasRegion,
} from './mapAtlas.js';

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
        (location) =>
          'parent_id' in location && location.parent_id === parentId,
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

  it('groups satellites and sect entrances by their own main node', () => {
    const children = getAtlasLocations().filter(
      (location) => 'parent_id' in location,
    );
    const grouped = getAllMapNodes().flatMap((area) => {
      const locations = getAtlasAreaLocations(area.id);
      for (const location of locations) {
        expect(location).toMatchObject({ parent_id: area.id });
      }
      return locations;
    });
    expect(grouped.map(({ id }) => id).sort()).toEqual(
      children.map(({ id }) => id).sort(),
    );
  });

  it('resolves authored places, interactions and anchors inside their area', () => {
    for (const area of getAllMapNodes()) {
      const content = getMapAreaContent(area.id);
      if (!content) continue;
      const locationIds = new Set(
        [area, ...getAtlasAreaLocations(area.id)].map(({ id }) => id),
      );
      for (const place of content.places) {
        expect(locationIds.has(place.id)).toBe(false);
        locationIds.add(place.id);
        if (place.scene) {
          const interactions = [
            ...place.scene.npcs,
            ...(place.scene.facilities ?? []),
          ];
          expect(new Set(interactions.map(({ id }) => id)).size).toBe(
            interactions.length,
          );
        }
      }
      for (const [id, [x, y]] of Object.entries(
        content.artwork?.anchors ?? {},
      )) {
        expect(locationIds.has(id), id).toBe(true);
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(1);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(1);
      }
    }
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

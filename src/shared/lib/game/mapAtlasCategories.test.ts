import { describe, expect, it } from 'vitest';
import { getAtlasLocations } from './mapAtlas';
import {
  ATLAS_CATEGORY_IDS,
  getAtlasCategory,
  getAtlasShortName,
  matchesAtlasCategories,
  parseAtlasCategories,
} from './mapAtlasCategories';
import { getWorldMapLocation } from './mapSystem';

const location = (id: string) => getWorldMapLocation(id)!;

describe('atlas single-purpose locations', () => {
  it('assigns exactly one purpose to every location, with no overlapping gameplay configuration', () => {
    const nodes = getAtlasLocations();
    for (const node of nodes) {
      expect(
        ATLAS_CATEGORY_IDS.filter((category) =>
          matchesAtlasCategories(node, [category]),
        ),
        node.id,
      ).toHaveLength(1);
      expect(matchesAtlasCategories(node, [])).toBe(true);
      const functions =
        'sect_id' in node
          ? [true]
          : [
              !!node.wild_encounter_id,
              !!node.dungeon_config,
              'market_config' in node && !!node.market_config?.enabled,
            ];
      expect(functions.filter(Boolean).length, node.id).toBeLessThanOrEqual(1);
    }
    expect(
      nodes.filter((node) => getAtlasCategory(node) === 'wild'),
    ).toHaveLength(10);
    expect(
      nodes.filter((node) => getAtlasCategory(node) === 'dungeon'),
    ).toHaveLength(31);
    expect(
      nodes.filter((node) => getAtlasCategory(node) === 'market'),
    ).toHaveLength(7);
    expect(
      nodes.filter((node) => getAtlasCategory(node) === 'sect'),
    ).toHaveLength(5);
  });

  it('makes Qingxi slope exclusively a wild habitat, including its authoritative config', () => {
    const node = location('SAT_TN_08');
    expect(getAtlasCategory(node)).toBe('wild');
    expect(matchesAtlasCategories(node, ['dungeon'])).toBe(false);
    expect('dungeon_config' in node).toBe(false);
    expect(node.description).not.toContain('秘境历练');
    expect(
      getAtlasLocations().filter((node) =>
        matchesAtlasCategories(node, ['wild', 'dungeon']),
      ),
    ).toHaveLength(41);
  });

  it('uses actual dungeon entrances rather than lore tags or dangerous names', () => {
    expect(getAtlasCategory(location('TN_YUE_02'))).toBe('landmark');
    expect(getAtlasCategory(location('TN_ZMG_01'))).toBe('landmark');
    expect(getAtlasCategory(location('SAT_ZMG_01'))).toBe('dungeon');
  });

  it('classifies all trading locations as markets, including cities', () => {
    for (const id of [
      'TN_YUE_01',
      'TN_YW_01',
      'DJ_CENTRAL_01',
      'LX_INNER_01',
      'TN_BAICAO_01',
    ]) {
      expect(getAtlasCategory(location(id))).toBe('market');
    }
    expect(getAtlasCategory(location('DJ_NORTH_01'))).toBe('landmark');
  });

  it('filters by union without including unrelated locations', () => {
    expect(
      matchesAtlasCategories(location('WILD_DJ_BANYAN'), ['market', 'sect']),
    ).toBe(false);
    expect(
      matchesAtlasCategories(location('DJ_CENTRAL_01'), ['market', 'sect']),
    ).toBe(true);
  });

  it('canonicalizes URL filters and safely ignores removed categories', () => {
    expect(parseAtlasCategories('dungeon,wild,wild,city')).toEqual([
      'wild',
      'dungeon',
    ]);
    for (const value of [null, '', 'all', 'unknown', 'city'])
      expect(parseAtlasCategories(value)).toEqual([]);
  });

  it('shortens labels without changing authoritative names', () => {
    const node = location('WILD_TN_MOONLAKE');
    expect(getAtlasShortName(node)).toBe('月照天池');
    expect(node.name).toBe('云梦山·月照天池');
    expect(getAtlasShortName(location('TN_YW_01'))).toBe('元武国');
  });
});

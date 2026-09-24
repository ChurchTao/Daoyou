import { describe, expect, it } from 'vitest';
import { formatContentPackErrors } from './content-pack-errors';

describe('content pack error locations', () => {
  it('identifies nested authored entries even for structural failures', () => {
    const data = { paths: [{ id: 'path.one', nodes: [{ id: 'node.two', effects: [{ power: 'bad' }] }] }] };
    expect(formatContentPackErrors('paths.json', data, [{
      path: ['paths', 0, 'nodes', 0, 'effects', 0, 'power'], message: 'Expected number',
    }])).toBe('paths.json: paths.0.nodes.0.effects.0.power [path.one / node.two]: Expected number');
  });
  it('keeps parent identity for semantic paths containing synthetic IDs', () => {
    expect(formatContentPackErrors('skills.json', { skills: [{ id: 'skill.one' }] }, [{
      path: ['skills', 0, 'skill.one', 'target'], message: 'Unknown reference',
    }])).toContain('skills.0.skill.one.target [skill.one]');
  });
  it('handles malformed roots, missing IDs and keyed records without masking errors', () => {
    expect(formatContentPackErrors('pack.json', null, [{ path: [], message: 'Expected object' }]))
      .toBe('pack.json: $: Expected object');
    expect(formatContentPackErrors('pack.json', { rows: [null] }, [{ path: ['rows', 0, 'id'], message: 'Required' }]))
      .toBe('pack.json: rows.0.id: Required');
    expect(formatContentPackErrors('pack.json', {}, [{ path: ['panels', 'species.one'], message: 'Missing' }]))
      .toContain('panels.species.one');
  });
  it('locates realm and floor entries which use domain identities instead of ID', () => {
    expect(formatContentPackErrors('pack.json', { realms: [{ realm: 'iron_bone' }], floors: [{ floor: 10 }] }, [
      { path: ['realms', 0, 'totalLevel'], message: 'Invalid' },
      { path: ['floors', 0, 'kind'], message: 'Invalid' },
    ])).toBe('pack.json: realms.0.totalLevel [iron_bone]: Invalid\npack.json: floors.0.kind [floor:10]: Invalid');
  });
});

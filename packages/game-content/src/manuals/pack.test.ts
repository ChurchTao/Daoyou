import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loadManualPack, ManualPackShape } from '@daoyou/game-domain/manuals/authoring';
import data from './data/manual-pack.json' with { type: 'json' };
import schema from './data/manual-pack.schema.json' with { type: 'json' };

describe('manual content pack', () => {
  it('keeps the authoring schema synchronized', () => {
    expect(schema).toEqual(z.toJSONSchema(ManualPackShape, { reused: 'ref' }));
  });

  it.each([
    ['advanced damage reduction above 50%', 'dotMitigation', 0.51],
    ['basic damage reduction above 20%', 'mitigation', 0.21],
    ['probability above 100%', 'selfCleanse', 1.01],
    ['unbounded script', 'script', 0.1],
  ])('rejects %s', (_, type, valueAt9) => {
    const copy = structuredClone(data);
    copy.manuals[24].mechanism = {
      type,
      condition: 'always',
      valueAt1: 0.01,
      valueAt9,
      ...(type === 'mitigation' ? { kinds: ['physical'] } : {}),
    };
    expect(() => loadManualPack(copy)).toThrow();
  });

  it('allows a growing cleanse probability without allowing arbitrary formulas', () => {
    const copy = structuredClone(data);
    copy.manuals[24].mechanism = {
      type: 'selfCleanse',
      condition: 'always',
      valueAt1: 0.2,
      valueAt9: 0.5,
    };
    expect(() => loadManualPack(copy)).not.toThrow();
    Object.assign(copy.manuals[24].mechanism, { formula: 'self.maxHp' });
    expect(() => loadManualPack(copy)).toThrow();
  });

  it('requires bounded training costs for all supported realms', () => {
    const missing = structuredClone(data);
    Object.assign(missing.progressions.standard.costsByRealm, { 大乘: undefined });
    expect(() => loadManualPack(missing)).toThrow();

    const excessive = structuredClone(data);
    excessive.progressions.standard.costsByRealm.大乘[7].insight = 101;
    expect(() => loadManualPack(excessive)).toThrow();

    const tribulation = structuredClone(data);
    tribulation.manuals[47].realm = '渡劫';
    expect(() => loadManualPack(tribulation)).toThrow();
  });
});

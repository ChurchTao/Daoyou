import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  loadManualPack,
  MANUAL_REALMS,
  ManualPackShape,
} from '@daoyou/game-domain/manuals/authoring';
import data from './data/manual-pack.json' with { type: 'json' };
import schema from './data/manual-pack.schema.json' with { type: 'json' };

describe('manual content pack', () => {
  it('keeps six choices in each of eight realms and no tribulation realm', () => {
    const pack = loadManualPack(data);
    expect(MANUAL_REALMS).toEqual([
      '炼气',
      '筑基',
      '金丹',
      '元婴',
      '化神',
      '炼虚',
      '合体',
      '大乘',
    ]);
    expect(pack.manuals).toHaveLength(48);
    for (const realm of MANUAL_REALMS) {
      expect(pack.manuals.filter((manual) => manual.realm === realm)).toHaveLength(
        6,
      );
      expect(pack.progressions.standard.costsByRealm[realm]).toHaveLength(8);
    }
    expect(schema).toEqual(z.toJSONSchema(ManualPackShape, { reused: 'ref' }));
  });

  it('uses the same 40 to 80 attribute growth for all advanced manuals', () => {
    const pack = loadManualPack(data);
    for (const manual of pack.manuals.filter(manual => MANUAL_REALMS.indexOf(manual.realm) >= 4)) {
      expect(manual.effects).toEqual([expect.objectContaining({ valueAt1: 40, valuePerLevel: 5 })]);
      expect(manual.effects[0]!.valueAt1 + 8 * manual.effects[0]!.valuePerLevel).toBe(80);
    }
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

  it('requires complete bounded training costs for every newly opened realm', () => {
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

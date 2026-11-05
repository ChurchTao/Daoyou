import { describe, expect, it } from 'vitest';
import {
  legacyModifiers,
  legacyRecord,
  legacyText,
} from './products.js';

describe('历史产物存档', () => {
  it('缺失和畸形数据不补造事实', () => {
    for (const value of [null, undefined, 1, '旧物', []]) {
      expect(legacyRecord(value)).toEqual({});
      expect(legacyModifiers(value)).toEqual([]);
    }
    expect(legacyText('')).toBeUndefined();
    expect(legacyText(1)).toBeUndefined();
    expect(legacyText('存档说明')).toBe('存档说明');
  });

  it('仅读取有限的已存属性，不按词缀或层数重算', () => {
    expect(
      legacyModifiers([
        { attrType: 'strength', type: 'flat', value: 0 },
        {
          attrType: 'speed',
          type: 'flat',
          value: -3,
          scaleByLayer: true,
          valueByLayer: [90],
        },
        { attrType: 'unknown-old-stat', type: 'add', value: 0.15 },
        { attrType: 'spirit', type: 'flat', value: Infinity },
        { attrType: 'spirit', type: 'flat', value: NaN },
        { attrType: 'spirit', type: 'flat', value: '10' },
        null,
      ]),
    ).toEqual([
      { attrType: 'strength', type: 'flat', value: 0 },
      { attrType: 'speed', type: 'flat', value: -3 },
      { attrType: 'unknown-old-stat', type: 'add', value: 0.15 },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { BLUEPRINTS } from './equipment-blueprints';

describe('图纸境界名称', () => {
  it('保留物品标识与档位，所有部位均使用无数字的境界名称', () => {
    expect(BLUEPRINTS).toHaveLength(54);
    expect(new Set(BLUEPRINTS.map((item) => item.name)).size).toBe(54);
    for (const item of BLUEPRINTS) {
      expect(item.id).toBe(`blueprint.${item.slot}.${item.level}`);
      expect(item.name).not.toMatch(/\d|级/);
    }
    expect(
      BLUEPRINTS.find((item) => item.id === 'blueprint.armor.10')?.name,
    ).toBe('炼气法衣图纸');
  });
});

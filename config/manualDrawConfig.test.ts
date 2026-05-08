import {
  MANUAL_DRAW_RULES,
  rollManualDrawQualities,
} from './manualDrawConfig';

describe('manualDrawConfig', () => {
  it('单抽只会产出灵品及以上品质', () => {
    const qualities = rollManualDrawQualities('gongfa', 1, () => 0);

    expect(qualities).toEqual([MANUAL_DRAW_RULES.minimumQuality]);
  });

  it('五连抽在基础结果偏低时仍保底至少一部真品', () => {
    const qualities = rollManualDrawQualities('skill', 5, () => 0);

    expect(qualities).toHaveLength(5);
    expect(qualities.every((quality) => quality !== '凡品')).toBe(true);
    expect(qualities.some((quality) => quality === '真品')).toBe(true);
  });

  it('五连抽若本就抽到真品及以上，不会再额外降档覆盖', () => {
    const qualities = rollManualDrawQualities('gongfa', 5, () => 0.9999);

    expect(qualities).toHaveLength(5);
    expect(
      qualities.some((quality) =>
        ['真品', '地品', '天品', '仙品', '神品'].includes(quality),
      ),
    ).toBe(true);
  });
});

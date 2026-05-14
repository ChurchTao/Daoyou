import { parseRedeemRewardPresets } from './redeemRewardPresets';

describe('redeem reward presets', () => {
  it('parses valid preset config', () => {
    const parsed = parseRedeemRewardPresets({
      sample: {
        name: '测试包',
        description: '测试描述',
        attachments: [
          {
            type: 'spirit_stones',
            name: '灵石',
            quantity: 100,
          },
        ],
      },
    });

    expect(parsed.sample.name).toBe('测试包');
    expect(parsed.sample.attachments).toHaveLength(1);
  });

  it('throws on invalid attachment payload', () => {
    expect(() =>
      parseRedeemRewardPresets({
        broken: {
          name: '坏配置',
          description: '缺少必要字段',
          attachments: [
            {
              type: 'material',
              name: '玄铁',
              quantity: 1,
            },
          ],
        },
      }),
    ).toThrow();
  });
});

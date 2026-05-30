import {
  describeRedeemCodeReward,
  resolveRedeemCodeRewardAttachments,
} from './reward';

describe('redeem reward helper', () => {
  it('reads stored reward attachments snapshots', () => {
    const attachments = resolveRedeemCodeRewardAttachments({
      rewardAttachments: [
        {
          type: 'spirit_stones',
          name: '灵石',
          quantity: 888,
        },
      ],
    });

    expect(attachments).toEqual([
      {
        type: 'spirit_stones',
        name: '灵石',
        quantity: 888,
      },
    ]);
  });

  it('treats legacy redeem codes without attachments as expired', () => {
    expect(() =>
      resolveRedeemCodeRewardAttachments({
        rewardAttachments: null,
      }),
    ).toThrow('兑换码已失效');
  });

  it('summarizes stored reward attachments', () => {
    expect(
      describeRedeemCodeReward({
        rewardAttachments: [
          {
            type: 'spirit_stones',
            name: '灵石',
            quantity: 66,
          },
        ],
      }),
    ).toEqual(['灵石 x66']);
  });
});

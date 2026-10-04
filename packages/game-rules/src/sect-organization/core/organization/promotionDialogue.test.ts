import { describe, expect, it } from 'vitest';
import { describeSectPromotionStatus } from './promotionDialogue.js';

describe('describeSectPromotionStatus', () => {
  it.each([
    {
      name: 'describes unmet requirements for the next configurable rank',
      status: {
        nextRank: 'inner' as const,
        missingRequirements: [
          '境界达到筑基',
          '当前贡献达到500',
          '完成一次宗门小比',
        ],
      },
      expected:
        '你若想晋升内门弟子，尚需境界达到筑基、当前贡献达到500、完成一次宗门小比。',
    },
    {
      name: 'directs an eligible disciple to the existing promotion scene',
      status: {
        nextRank: 'outer' as const,
        missingRequirements: [],
      },
      expected: '晋升外门弟子的条件已经齐备，可去宗门大殿办理晋升。',
    },
    {
      name: 'handles the terminal rank without inventing another requirement',
      status: {
        nextRank: null,
        missingRequirements: [],
      },
      expected: '你已列真传，眼下没有更高的弟子职阶需要考校。',
    },
  ])('$name', ({ status, expected }) => {
    expect(describeSectPromotionStatus(status)).toBe(expected);
  });

  it('ignores empty requirement fragments from presentation sources', () => {
    expect(
      describeSectPromotionStatus({
        nextRank: 'true',
        missingRequirements: ['通过长老试炼', '  '],
      }),
    ).toBe('你若想晋升真传弟子，尚需通过长老试炼。');
  });
});

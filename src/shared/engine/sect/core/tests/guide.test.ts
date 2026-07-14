import { describe, expect, it } from 'vitest';
import {
  assignAbilityToSlot,
  createAbilitySlots,
  describeMethodBenefit,
  validateAbilitySlots,
} from '..';
import { LINGXIAO_SECT } from '../../content/lingxiao';

describe('通用宗门展示与装配', () => {
  it('心法收益由通用定义生成', () => {
    const method = LINGXIAO_SECT.methods.find(
      (entry) => entry.id === 'sword-nurturing',
    )!;
    expect(describeMethodBenefit(method, 100)).toContain('气血上限提高5%');
  });

  it('固定四槽保留稀疏位置并避免重复', () => {
    const slots = createAbilitySlots(['guiding-sword', null, 'turning-body']);
    expect(slots).toEqual(['guiding-sword', null, 'turning-body', null]);
    expect(assignAbilityToSlot(slots, 1, 'guiding-sword')).toEqual([
      null,
      'guiding-sword',
      'turning-body',
      null,
    ]);
    expect(
      validateAbilitySlots({
        slots,
        unlockedActiveAbilityIds: ['guiding-sword', 'turning-body'],
      }).valid,
    ).toBe(true);
  });
});

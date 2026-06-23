import { describe, expect, it } from 'vitest';
import {
  resolveAffixSlotLayout,
} from '@shared/engine/creation-v2/config/AffixSelectionConstraints';

describe('AffixSelectionConstraints', () => {
  it('应为所有产品类型提供 slot layout', () => {
    expect(resolveAffixSlotLayout('skill', 5)).toHaveLength(5);
    expect(resolveAffixSlotLayout('artifact', 5)).toHaveLength(5);
    expect(resolveAffixSlotLayout('gongfa', 5)).toHaveLength(5);
  });

  it('skill 应固定 core 后接 modifier 槽', () => {
    expect(resolveAffixSlotLayout('skill', 3)).toEqual([
      { index: 1, slots: ['core'], required: true },
      { index: 2, slots: ['modifier'], required: false },
      { index: 3, slots: ['modifier'], required: false },
    ]);
  });

  it('gongfa 应表达 identity 与 resonance 分层', () => {
    expect(resolveAffixSlotLayout('gongfa', 4)).toEqual([
      { index: 1, slots: ['core'], required: true },
      { index: 2, slots: ['identity'], required: false },
      { index: 3, slots: ['resonance', 'modifier'], required: false },
      { index: 4, slots: ['modifier'], required: false },
    ]);
  });

  it('artifact 第二槽允许 identity 或 modifier', () => {
    expect(resolveAffixSlotLayout('artifact', 2)).toEqual([
      { index: 1, slots: ['core'], required: true },
      { index: 2, slots: ['identity', 'modifier'], required: false },
    ]);
  });

  it('maxCount 小于等于 0 时不开放 slot', () => {
    expect(resolveAffixSlotLayout('gongfa', 0)).toEqual([]);
  });
});

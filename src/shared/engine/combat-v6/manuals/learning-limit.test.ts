import { describe, expect, it } from 'vitest';
import { manualSlot, validateManualStateV1 } from './compiler';
import { CHARACTER_MANUALS_V1 } from './content';
import { changeManual } from './state';
import type { CultivatorManualStateV1 } from './types';

const manuals = CHARACTER_MANUALS_V1.filter(
  (manual) => manual.realm === '炼气',
);
function learn(state: CultivatorManualStateV1, manual = manuals[0]) {
  return changeManual({
    state,
    action: 'learn',
    manualId: manual.id,
    slot: manualSlot(manual),
    realm: '筑基',
    expectedRevision: state.revision,
    resources: { experience: 1000, insight: 100 },
  });
}
function fullSlot(): CultivatorManualStateV1 {
  let state: CultivatorManualStateV1 = {
    version: 1,
    revision: 0,
    learned: [],
    build: { slots: [] },
  };
  for (const manual of manuals) {
    const result = learn(state, manual);
    if (!result.ok) throw new Error(result.diagnostics[0].message);
    state = result.state;
  }
  return state;
}

describe('功法每境界六种学习上限', () => {
  it('六种可以全部学习，重复学习拒绝且保留进度和激活项', () => {
    const state = fullSlot();
    const before = structuredClone(state);
    expect(state.learned).toHaveLength(6);
    expect(state.build.slots).toEqual([{ slot: 1, manualId: manuals[0].id }]);
    expect(learn(state, manuals[3])).toMatchObject({ ok: false });
    expect(state).toEqual(before);
  });
  it('上限按境界分别计算，不阻止另一境界学习', () => {
    const state = fullSlot();
    const result = learn(
      state,
      CHARACTER_MANUALS_V1.find((m) => m.realm === '筑基')!,
    );
    expect(result.ok && result.state.learned).toHaveLength(7);
    expect(result.ok && result.state.build.slots).toHaveLength(2);
  });
  it('学满后仍可修炼、用同名玉简突破及免费切换', () => {
    let state = fullSlot();
    for (const action of ['train', 'train', 'unlock', 'activate'] as const) {
      const result = changeManual({
        state,
        action,
        manualId: manuals[action === 'activate' ? 1 : 0].id,
        slot: 1,
        realm: '筑基',
        expectedRevision: state.revision,
        resources: { experience: 1000, insight: 100 },
      });
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.learned).toHaveLength(6);
    expect(state.learned[0]).toMatchObject({ level: 3, unlockedLevel: 6 });
    expect(state.build.slots[0].manualId).toBe(manuals[1].id);
  });
  it('状态校验拒绝同境界超过六种功法', () => {
    const state = fullSlot();
    const extra = { ...manuals[0], id: 'character_manual.extra' };
    state.learned.push({ manualId: extra.id, level: 1, unlockedLevel: 3 });
    expect(validateManualStateV1(state, '筑基', [...CHARACTER_MANUALS_V1, extra])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: '每个境界位最多学习六种功法' }),
      ]),
    );
  });
});

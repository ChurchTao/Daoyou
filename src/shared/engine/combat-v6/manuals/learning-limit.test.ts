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
  for (const manual of manuals.slice(0, 3)) {
    const result = learn(state, manual);
    if (!result.ok) throw new Error(result.diagnostics[0].message);
    state = result.state;
  }
  return state;
}

describe('功法每境界三种学习上限', () => {
  it('第三种可以学习，第四种拒绝且保留全部进度和激活项', () => {
    const state = fullSlot();
    const before = structuredClone(state);
    expect(state.learned).toHaveLength(3);
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
    expect(result.ok && result.state.learned).toHaveLength(4);
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
    expect(state.learned).toHaveLength(3);
    expect(state.learned[0]).toMatchObject({ level: 3, unlockedLevel: 6 });
    expect(state.build.slots[0].manualId).toBe(manuals[1].id);
  });
  it('状态校验拒绝同境界超过三种功法', () => {
    const state = fullSlot();
    state.learned.push({ manualId: manuals[3].id, level: 1, unlockedLevel: 3 });
    expect(validateManualStateV1(state, '筑基')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: '每个境界位最多学习三种功法' }),
      ]),
    );
  });
});

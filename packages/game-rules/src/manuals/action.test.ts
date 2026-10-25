import { expect, it } from 'vitest';
import {
  ManualActionSchema,
  type ManualAction,
} from '@daoyou/game-domain/manuals';
import { MANUAL_PACK } from '@daoyou/game-content/manuals';
import type { CultivatorManualStateV1 } from '@daoyou/game-domain/manuals';
import type { InventoryItem } from '@daoyou/game-domain/inventory';
import { manualJadeCost, previewManualAction } from './action.js';

const state: CultivatorManualStateV1 = {
  version: 1,
  revision: 0,
  learned: [],
  build: { slots: [] },
};
const manualId = 'character_manual.changchun';
const item: InventoryItem = {
  id: 'jade',
  definitionId: 'jade.' + manualId,
  quantity: 1,
  revision: 0,
  location: 'bag',
  slotIndex: 0,
  instanceData: null,
  stackKey: 'definition.v1:jade.' + manualId,
};
const action: ManualAction = {
  action: 'learn',
  manualId,
  slot: 1,
  expectedRevision: 0,
  item: { id: 'jade', revision: 0 },
};
const resources = { experience: 0, insight: 0 };
it.each([
  ['炼气', 'changchun', 1, 320, 18, 1440, 88],
  ['筑基', 'guiyuan', 2, 1600, 27, 7200, 132],
  ['金丹', 'taibai', 3, 8000, 36, 36000, 176],
  ['元婴', 'tuotian', 4, 32000, 45, 144000, 220],
] as const)(
  '%s费用按功法境界计算，预览遵守精确余额和最新总预算',
  (realm, key, slot, experience, insight, totalExperience, totalInsight) => {
    const manualId = `character_manual.${key}`;
    const learned: CultivatorManualStateV1 = {
      version: 1,
      revision: 0,
      learned: [{ manualId, level: 8, unlockedLevel: 9 }],
      build: { slots: [{ slot, manualId }] },
    };
    const action: ManualAction = {
      action: 'train',
      manualId,
      slot,
      expectedRevision: 0,
    };
    expect(
      previewManualAction(learned, '元婴', action, { experience, insight }),
    ).toMatchObject({
      ok: true,
      cost: { experience, insight },
      state: { learned: [{ level: 9 }] },
    });
    expect(
      previewManualAction(learned, '元婴', action, {
        experience: experience - 1,
        insight,
      }).ok,
    ).toBe(false);
    expect(
      previewManualAction(learned, '元婴', action, {
        experience,
        insight: insight - 1,
      }).ok,
    ).toBe(false);
    expect(learned.learned[0].level).toBe(8);
    const costs = MANUAL_PACK.progressions.standard.costsByRealm[realm];
    expect(costs.reduce((sum, cost) => sum + cost.experience, 0)).toBe(
      totalExperience,
    );
    expect(costs.reduce((sum, cost) => sum + cost.insight, 0)).toBe(
      totalInsight,
    );
  },
);
it('学习接受储物袋或储藏室中版本一致的同名玉简', () => {
  expect(previewManualAction(state, '炼气', action, resources, item).ok).toBe(
    true,
  );
  expect(
    previewManualAction(state, '炼气', action, resources, {
      ...item,
      location: 'storage',
      slotIndex: null,
    }).ok,
  ).toBe(true);
  for (const bad of [
    undefined,
    { ...item, revision: 1 },
    { ...item, quantity: 0 },
    { ...item, definitionId: 'jade.character_manual.qingmu' },
    { ...item, location: 'warehouse' as InventoryItem['location'] },
  ])
    expect(previewManualAction(state, '炼气', action, resources, bad).ok).toBe(
      false,
    );
  expect(item.quantity).toBe(1);
});
it('严格请求拒绝旧改修协议、非法槽位和客户端自报费用', () => {
  expect(ManualActionSchema.safeParse(action).success).toBe(true);
  for (const slot of [0, 7, 8, 9])
    expect(ManualActionSchema.safeParse({ ...action, slot }).success).toBe(false);
  expect(ManualActionSchema.safeParse({ ...action, cost: 0 }).success).toBe(
    false,
  );
  expect(
    ManualActionSchema.safeParse({ ...action, action: 'forget' }).success,
  ).toBe(false);
});
it.each([
  [3, 2, 6],
  [6, 3, 9],
] as const)(
  '%s层突破需%s本，数量不足或版本过期不解锁',
  (level, quantity, unlockedLevel) => {
    const learned: CultivatorManualStateV1 = {
      version: 1,
      revision: 1,
      learned: [{ manualId, level, unlockedLevel: level }],
      build: { slots: [{ slot: 1, manualId }] },
    };
    const unlock = {
      ...action,
      action: 'unlock' as const,
      expectedRevision: 1,
    };
    expect(manualJadeCost(learned, unlock)).toBe(quantity);
    for (const bad of [
      { ...item, quantity: quantity - 1 },
      { ...item, quantity, definitionId: 'jade.character_manual.qingmu' },
      { ...item, quantity, revision: 1 },
      { ...item, quantity, location: 'warehouse' as InventoryItem['location'] },
    ])
      expect(
        previewManualAction(learned, '炼气', unlock, resources, bad).ok,
      ).toBe(false);
    for (const count of [quantity, quantity + 1]) {
      expect(
        previewManualAction(learned, '炼气', unlock, resources, {
          ...item,
          quantity: count,
        }),
      ).toMatchObject({
        ok: true,
        cost: { experience: 0, insight: 0 },
        state: { learned: [{ level, unlockedLevel }] },
      });
    }
    expect(learned.learned[0].unlockedLevel).toBe(level);
  },
);
it('学习消耗一本，修炼与切换不额外消耗玉简', () => {
  expect(manualJadeCost(state, action)).toBe(1);
  expect(manualJadeCost(state, { ...action, action: 'train' })).toBe(0);
  expect(manualJadeCost(state, { ...action, action: 'activate' })).toBe(0);
});
it('大乘来源玉简要到大乘才能学习，仍校验同名玉简及最新版本', () => {
  const manualId = 'character_manual.yuanshi_zhenjie';
  const advancedAction: ManualAction = { ...action, manualId, slot: 5 };
  const advancedJade = {
    ...item,
    definitionId: `jade.${manualId}`,
    stackKey: `definition.v1:jade.${manualId}`,
  };
  expect(previewManualAction(state, '化神', advancedAction, resources, advancedJade).ok).toBe(false);
  expect(previewManualAction(state, '合体', advancedAction, resources, advancedJade).ok).toBe(false);
  expect(previewManualAction(state, '大乘', advancedAction, resources, advancedJade)).toMatchObject({
    ok: true,
    cost: { experience: 0, insight: 0 },
    state: {
      learned: [{ manualId, level: 1, unlockedLevel: 3, slot: 5 }],
      build: { slots: [{ slot: 5, manualId }] },
    },
  });
  expect(previewManualAction(state, '大乘', { ...advancedAction, slot: 6 }, resources, advancedJade)).toMatchObject({
    ok: true,
    state: { learned: [{ manualId, slot: 6 }] },
  });
  for (const invalidAction of [
    { ...advancedAction, slot: 4 as const },
    { ...advancedAction, expectedRevision: 1 },
    { ...advancedAction, item: { id: 'jade', revision: 1 } },
  ])
    expect(previewManualAction(state, '大乘', invalidAction, resources, advancedJade).ok).toBe(false);
  expect(previewManualAction(state, '元婴', advancedAction, resources, advancedJade).ok).toBe(false);
  expect(previewManualAction(state, '大乘', advancedAction, resources, item).ok).toBe(false);
  expect(state.learned).toEqual([]);
});

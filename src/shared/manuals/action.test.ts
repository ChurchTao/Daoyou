import { expect, it } from 'vitest';
import {
  ManualActionSchema,
  type ManualAction,
} from '../contracts/combatV6Manuals';
import type { CultivatorManualStateV1 } from '../engine/combat-v6/manuals/types';
import type { InventoryItem } from '../inventory';
import { QINGXI_POOL_V2 } from '../rewards/wild';
import { previewManualAction } from './action';

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
it('学习仅接受储物袋中版本一致的同名玉简', () => {
  expect(previewManualAction(state, '炼气', action, resources, item).ok).toBe(
    true,
  );
  for (const bad of [
    undefined,
    { ...item, revision: 1 },
    { ...item, quantity: 0 },
    { ...item, definitionId: 'jade.character_manual.songhe' },
    { ...item, location: 'warehouse' as InventoryItem['location'] },
  ])
    expect(previewManualAction(state, '炼气', action, resources, bad).ok).toBe(
      false,
    );
  expect(item.quantity).toBe(1);
});
it('严格请求拒绝旧改修协议、非法槽位和客户端自报费用', () => {
  expect(ManualActionSchema.safeParse(action).success).toBe(true);
  expect(ManualActionSchema.safeParse({ ...action, slot: 5 }).success).toBe(
    false,
  );
  expect(ManualActionSchema.safeParse({ ...action, cost: 0 }).success).toBe(
    false,
  );
  expect(
    ManualActionSchema.safeParse({ ...action, action: 'forget' }).success,
  ).toBe(false);
});
it('同名瓶颈玉简校验与学习一致', () => {
  const learned: CultivatorManualStateV1 = {
    version: 1,
    revision: 1,
    learned: [{ manualId, level: 3, unlockedLevel: 3 }],
    build: { slots: [{ slot: 1, manualId }] },
  };
  const unlock = { ...action, action: 'unlock' as const, expectedRevision: 1 };
  expect(
    previewManualAction(learned, '炼气', unlock, resources, {
      ...item,
      definitionId: 'jade.character_manual.songhe',
    }).ok,
  ).toBe(false);
  expect(
    previewManualAction(learned, '炼气', unlock, resources, item),
  ).toMatchObject({
    ok: true,
    state: { learned: [{ level: 3, unlockedLevel: 6 }] },
  });
});
it('常见与稀有玉简在既有掉落池采用数据包权重', () => {
  const entries = QINGXI_POOL_V2.groups.find(
    (g) => g.id === 'manuals',
  )!.entries;
  expect(entries).toHaveLength(16);
  expect(entries.find((e) => e.rewardId === item.definitionId)!.weight).toBe(
    100,
  );
  expect(
    entries.find((e) => e.rewardId === 'jade.character_manual.songhe')!.weight,
  ).toBe(5);
});

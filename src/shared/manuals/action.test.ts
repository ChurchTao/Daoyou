import { describe, expect, it } from 'vitest';
import {
  ManualActionSchema,
  type ManualAction,
} from '../contracts/combatV6Manuals';
import {
  CHARACTER_MANUALS_V1,
  CHARACTER_MANUAL_ID as ID,
} from '../engine/combat-v6/manuals/content';
import type { CultivatorManualStateV1 } from '../engine/combat-v6/manuals/types';
import { addItems, type InventoryItem } from '../inventory';
import { inventoryStackIdentity } from '../inventory/stack-key';
import { MANUAL_JADES } from '../items/definitions/manual-jades';
import { QINGXI_POOL_V2 } from '../rewards/wild';
import { previewManualAction } from './action';

const empty: CultivatorManualStateV1 = {
  version: 1,
  revision: 0,
  build: { slots: [] },
};
const jade = (manualId = ID.DuanyueTrue): InventoryItem => ({
  id: 'jade',
  definitionId: `jade.${manualId}`,
  quantity: 1,
  revision: 0,
  location: 'bag',
  slotIndex: 0,
  instanceData: null,
  stackKey: `definition.v1:jade.${manualId}`,
});
const action: ManualAction = {
  action: 'learn',
  expectedRevision: 0,
  expectedManualId: null,
  slot: 1,
  item: { id: 'jade', revision: 0 },
};

describe('manual jade use', () => {
  it('directly learns true rank without mutating state or item', () => {
    const item = jade();
    const result = previewManualAction(empty, '炼气', action, item);
    expect(result.ok && result.state.build.slots).toEqual([
      { slot: 1, manualId: ID.DuanyueTrue },
    ]);
    expect(empty.build.slots).toEqual([]);
    expect(item.quantity).toBe(1);
  });
  it('rejects storage, stale inventory, missing item, wrong type and stale manual revision', () => {
    for (const item of [
      undefined,
      { ...jade(), location: 'storage' as const, slotIndex: null },
      { ...jade(), revision: 1 },
      { ...jade(), definitionId: 'book.beast.combo' },
    ]) {
      expect(previewManualAction(empty, '炼气', action, item).ok).toBe(false);
    }
    expect(
      previewManualAction(
        empty,
        '炼气',
        { ...action, expectedRevision: 1 },
        jade(),
      ).ok,
    ).toBe(false);
    expect(
      previewManualAction(empty, '炼气', { ...action, slot: 3 }, jade()).ok,
    ).toBe(false);
  });
  it('upgrades in place and rejects duplication or downgrading', () => {
    const state: CultivatorManualStateV1 = {
      ...empty,
      build: { slots: [{ slot: 1, manualId: ID.DuanyueBase }] },
    };
    const upgraded = previewManualAction(
      state,
      '炼气',
      { ...action, expectedManualId: ID.DuanyueBase },
      jade(),
    );
    expect(upgraded.ok && upgraded.state.build.slots).toEqual([
      { slot: 1, manualId: ID.DuanyueTrue },
    ]);
    expect(
      previewManualAction(state, '炼气', { ...action, slot: 2 }, jade()).ok,
    ).toBe(false);
    if (!upgraded.ok) throw new Error('upgrade failed');
    expect(
      previewManualAction(
        upgraded.state,
        '炼气',
        { ...action, expectedRevision: 1, expectedManualId: ID.DuanyueTrue },
        jade(ID.DuanyueBase),
      ).ok,
    ).toBe(false);
    expect(previewManualAction(upgraded.state, '炼气', action, jade()).ok).toBe(
      false,
    );
  });
  it('replaces only the selected slot and forgets without requiring inventory', () => {
    const state: CultivatorManualStateV1 = {
      ...empty,
      build: {
        slots: [
          { slot: 1, manualId: ID.DuanyueBase },
          { slot: 2, manualId: ID.MingsiBase },
        ],
      },
    };
    const changed = previewManualAction(
      state,
      '炼气',
      { ...action, expectedManualId: ID.DuanyueBase },
      jade(ID.NingguangBase),
    );
    expect(changed.ok && changed.state.build.slots).toEqual([
      { slot: 1, manualId: ID.NingguangBase },
      { slot: 2, manualId: ID.MingsiBase },
    ]);
    const forgotten = previewManualAction(state, '炼气', {
      action: 'forget',
      slot: 1,
      expectedRevision: 0,
      expectedManualId: ID.DuanyueBase,
    });
    expect(forgotten.ok && forgotten.state.build.slots).toEqual([
      { slot: 2, manualId: ID.MingsiBase },
    ]);
  });
  it('validates target and inventory revision references', () => {
    expect(ManualActionSchema.safeParse(action).success).toBe(true);
    expect(ManualActionSchema.safeParse({ ...action, slot: 7 }).success).toBe(
      false,
    );
    expect(
      ManualActionSchema.safeParse({ ...action, item: { id: 'jade' } }).success,
    ).toBe(false);
  });
});
it('registers twenty fixed jades, stacks at 99 and preserves rank-specific identity', () => {
  expect(MANUAL_JADES).toHaveLength(20);
  for (const item of MANUAL_JADES)
    expect(
      CHARACTER_MANUALS_V1.some((manual) => manual.id === item.manualId),
    ).toBe(true);
  let id = 0;
  const definitionId = `jade.${ID.DuanyueBase}`;
  const key = inventoryStackIdentity(definitionId, undefined);
  const result = addItems(
    [],
    { definitionId, quantity: 100 },
    'bag',
    true,
    () => `id${id++}`,
    key,
  );
  expect(result.map((item) => item.quantity)).toEqual([99, 1]);
  expect(inventoryStackIdentity(`jade.${ID.DuanyueTrue}`, undefined)).not.toBe(
    key,
  );
});
it('configures an independent 3% jade group with equal lineage and 95/5 rank weights', () => {
  const group = QINGXI_POOL_V2.groups.find((group) => group.id === 'manuals')!;
  expect(group.chance).toBe(0.03);
  expect(group.entries).toHaveLength(20);
  for (const rank of ['base', 'true']) {
    expect(
      group.entries
        .filter((entry) => entry.rewardId.endsWith(`.${rank}`))
        .reduce((sum, entry) => sum + entry.weight, 0),
    ).toBe(rank === 'base' ? 190 : 10);
  }
});

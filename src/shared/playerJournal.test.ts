import { describe, expect, it } from 'vitest';
import {
  PlayerJournalEventSchema,
  StoredJournalEventSchema,
  retreatResultFromJournal,
} from './contracts/playerJournal';
import type { InventoryItem } from './inventory';
import {
  compactJournalChanges,
  inventoryJournalChanges,
} from './playerJournal';

const item: InventoryItem = {
  id: 'ore',
  definitionId: 'material.v1',
  quantity: 8,
  location: 'bag',
  slotIndex: 0,
  revision: 0,
  stackKey: null,
  instanceData: { name: '玄铁', type: 'ore', rank: '凡品' },
};

describe('journal settlement changes', () => {
  it('records the increment of an existing stack, not the final stack quantity', () => {
    expect(
      inventoryJournalChanges([item], [{ ...item, quantity: 11 }]),
    ).toEqual([{ kind: 'item', id: 'ore', name: '玄铁', amount: 3 }]);
  });
  it('records consumed and new items together, including fully removed stacks', () => {
    expect(
      inventoryJournalChanges([item], [{ ...item, id: 'new', quantity: 2 }]),
    ).toEqual([
      { kind: 'item', id: 'ore', name: '玄铁', amount: -8 },
      { kind: 'item', id: 'new', name: '玄铁', amount: 2 },
    ]);
  });
  it('ignores location/revision changes and does not mutate the snapshots', () => {
    const before = structuredClone(item);
    expect(
      inventoryJournalChanges(
        [item],
        [{ ...item, revision: 1, location: 'storage', slotIndex: null }],
      ),
    ).toEqual([]);
    expect(item).toEqual(before);
  });
  it('keeps costs and gains distinct while combining repeated same-direction writes', () => {
    const changes = compactJournalChanges([
      { kind: 'item', id: 'ore', name: '玄铁', amount: -3 },
      { kind: 'item', id: 'ore', name: '玄铁', amount: -2 },
      { kind: 'item', id: 'ore', name: '玄铁', amount: 5 },
      { kind: 'resource', resource: 'exp', amount: 0 },
    ]);
    expect(changes.map((change) => change.amount)).toEqual([-5, 5]);
  });
  it('stores the replay result but excludes it from the public event contract', () => {
    const event = {
      type: 'resources.settled',
      activity: 'mail_claim',
      changes: [],
      result: { internal: 'private' },
    };
    expect(StoredJournalEventSchema.parse(event).result).toEqual({
      internal: 'private',
    });
    expect(PlayerJournalEventSchema.parse(event)).not.toHaveProperty('result');
  });
  it('does not interpret new events as breakthrough receipts', () => {
    const event = PlayerJournalEventSchema.parse({
      type: 'resources.settled',
      activity: 'yield_claim',
      changes: [],
    });
    expect(() => retreatResultFromJournal(event)).toThrow('非闭关突破执行记录');
  });
  it.each(['reputation', 'contribution'] as const)(
    'accepts standalone %s gains and costs without other resources',
    (resource) => {
      for (const amount of [10, -10]) {
        const event = {
          type: 'resources.settled',
          activity: 'sect_task_action',
          changes: [{ kind: 'resource', resource, amount }],
        };
        expect(PlayerJournalEventSchema.parse(event)).toEqual(event);
      }
      expect(
        PlayerJournalEventSchema.safeParse({
          type: 'resources.settled',
          activity: 'sect_task_action',
          changes: [{ kind: 'resource', resource, amount: 0 }],
        }).success,
      ).toBe(false);
    },
  );
});

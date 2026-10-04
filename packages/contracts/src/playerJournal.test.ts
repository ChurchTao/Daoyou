import { expect, it } from 'vitest';
import {
  PlayerJournalEventSchema,
  StoredJournalEventSchema,
  retreatResultFromJournal,
} from './playerJournal.js';
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

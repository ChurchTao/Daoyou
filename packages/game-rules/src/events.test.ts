import { describe, expect, it } from 'vitest';
import { DomainEventDataSchemas } from './events.js';
const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const CULTIVATOR_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '55555555-5555-4555-8555-555555555555';
describe('domain event payloads', () => {
  it('accepts frozen yield rewards and rejects extra items or stacked quantities', () => {
    const data = {
      cultivatorId: CULTIVATOR_ID,
      actionInstanceId: EVENT_ID,
      realm: '炼气',
      materialCount: 1,
      rewardSnapshot: {
        poolId: 'yield',
        poolVersion: 1,
        items: [{ definitionId: 'blueprint.head.10', quantity: 1 }],
      },
    };
    const schema = DomainEventDataSchemas['yield.claimed'];
    expect(schema.parse(data)).toEqual(data);
    expect(schema.safeParse({ ...data, materialCount: 2 }).success).toBe(false);
    expect(
      schema.safeParse({
        ...data,
        rewardSnapshot: {
          ...data.rewardSnapshot,
          items: [{ definitionId: 'blueprint.head.10', quantity: 2 }],
        },
      }).success,
    ).toBe(false);
  });
});

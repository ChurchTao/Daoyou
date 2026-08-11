import { describe, expect, it } from 'vitest';
import { BattleBoardgameMovePayloadSchema } from './battleMove';

const validPayload = {
  requestId: 'c5ae8ec5-98b7-4d1a-b477-127c510c5785',
  round: 1,
  checkpointRevision: 0,
  intents: {
    actor: { kind: 'ability', abilityId: 'ability', targetUnitId: 'target' },
  },
};

describe('BattleBoardgameMovePayloadSchema', () => {
  it('accepts a bounded strict move payload', () => {
    expect(BattleBoardgameMovePayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects extra fields and malformed ability intents', () => {
    expect(BattleBoardgameMovePayloadSchema.safeParse({
      ...validPayload,
      extra: true,
    }).success).toBe(false);
    expect(BattleBoardgameMovePayloadSchema.safeParse({
      ...validPayload,
      intents: { actor: { kind: 'ability' } },
    }).success).toBe(false);
  });

  it('rejects oversized intent maps and identifiers', () => {
    expect(BattleBoardgameMovePayloadSchema.safeParse({
      ...validPayload,
      intents: Object.fromEntries(
        Array.from({ length: 5 }, (_, index) => [
          `actor-${index}`,
          { kind: 'basic_attack' },
        ]),
      ),
    }).success).toBe(false);
    expect(BattleBoardgameMovePayloadSchema.safeParse({
      ...validPayload,
      intents: { ['x'.repeat(161)]: { kind: 'basic_attack' } },
    }).success).toBe(false);
  });
});

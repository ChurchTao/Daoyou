import { expect, it } from 'vitest';
import { CombatAutoRequestSchema } from './combatAuto.js';
it('AUTO 是带回合和版本号的一次性请求，不接受旧开关协议', () => {
  expect(
    CombatAutoRequestSchema.safeParse({
      type: 'AUTO',
      round: 1,
      expectedRevision: 0,
    }).success,
  ).toBe(true);
  for (const input of [
    { enabled: true, expectedRevision: 0 },
    { type: 'AUTO', round: 0, expectedRevision: 0 },
    { type: 'AUTO', round: 1, expectedRevision: -1 },
  ])
    expect(CombatAutoRequestSchema.safeParse(input).success).toBe(false);
});

import { expect, it } from 'vitest';
import { ArenaV6SubmitSchema } from './combatV6Arena.js';
it('AUTO 请求接受带回合和重试标识的合法协议', () => {
  const input = {
    round: 1,
    requestId: '10000000-0000-4000-8000-000000000001',
    commands: 'AUTO',
  };
  expect(ArenaV6SubmitSchema.parse(input)).toEqual(input);
});
it('拒绝旧单条自动指令协议', () => {
  expect(
    ArenaV6SubmitSchema.safeParse({
      round: 1,
      requestId: crypto.randomUUID(),
      command: { type: 'auto' },
    }).success,
  ).toBe(false);
});

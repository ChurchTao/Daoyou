import { expect, it } from 'vitest';
import { HuntCreateTeamSchema } from './hunts.js';
it.each([1, 2, 3, 4])('创建队伍接受 v%i 讨伐事件', (version) => {
  expect(
    HuntCreateTeamSchema.safeParse({
      eventId: `hunt-v${version}-100-0`,
      minRealm: '金丹',
      maxRealm: '渡劫',
    }).success,
  ).toBe(true);
});
it('创建队伍拒绝逆序境界范围', () => {
  expect(
    HuntCreateTeamSchema.safeParse({
      eventId: 'hunt-v4-100-0',
      minRealm: '渡劫',
      maxRealm: '金丹',
    }).success,
  ).toBe(false);
});

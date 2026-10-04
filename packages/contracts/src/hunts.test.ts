import { expect, it } from 'vitest';
import { HuntCreateTeamSchema } from './hunts.js';
it('创建队伍拒绝逆序境界范围', () => {
  expect(
    HuntCreateTeamSchema.safeParse({
      eventId: 'hunt-v3-100-0',
      minRealm: '渡劫',
      maxRealm: '金丹',
    }).success,
  ).toBe(false);
});

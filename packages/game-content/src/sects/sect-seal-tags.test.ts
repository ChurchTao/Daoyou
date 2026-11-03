import { expect, it } from 'vitest';
import { BAILU_COMBAT } from './bailu-pack.js';
import { JIUJIE_COMBAT } from './jiujie-pack.js';
import { LINGXIAO_COMBAT } from './lingxiao-pack.js';
import { TIANYAN_STATUSES } from './tianyan-foundation.js';
import { WANQIAO_COMBAT } from './wanqiao-pack.js';
import { WUXIANG_COMBAT } from './wuxiang-pack.js';
import { XIAOYUE_COMBAT } from './xiaoyue-pack.js';
import { YOUDU_COMBAT } from './youdu-pack.js';

it('仅将现有宗门的真实行动封印标为封印目标', () => {
  const statuses = [
    ...BAILU_COMBAT.statuses,
    ...JIUJIE_COMBAT.statuses,
    ...LINGXIAO_COMBAT.statuses,
    ...TIANYAN_STATUSES,
    ...WANQIAO_COMBAT.statuses,
    ...WUXIANG_COMBAT.statuses,
    ...XIAOYUE_COMBAT.statuses,
    ...YOUDU_COMBAT.statuses,
  ];
  expect(statuses.filter((status) => status.isSeal).map((status) => status.id).sort()).toEqual([
    'bailu.status.device',
    'bailu.status.disarray',
    'bailu.status.law',
    'bailu.status.peace',
    'bailu.status.restrain',
    'bailu.status.soul',
    'bailu.status.still',
    'jiujie.status.million_weapons',
    'jiujie.status.suppress',
    'tianyan.status.seal',
    'wanqiao.status.freeze',
    'xiaoyue.status.pressure_stun',
    'xiaoyue.status.stun',
  ]);
});

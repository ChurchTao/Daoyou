import { expect, it } from 'vitest';
import { COMBAT_V6_SECT_DEFINITIONS } from './registry.js';

it('仅将现有宗门的真实行动封印标为封印目标', () => {
  const statuses = Object.values(COMBAT_V6_SECT_DEFINITIONS).flatMap(
    (sect) => sect.statuses,
  );
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

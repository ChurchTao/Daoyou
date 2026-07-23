import type { SectMapHotspot } from '@shared/engine/sect';
import { describe, expect, it } from 'vitest';
import { resolveSectMapHotspotState } from './sectMapState';

const hotspots: SectMapHotspot[] = [
  {
    id: 'hall',
    label: '宗门大殿',
    route: '/game/sect/hall',
    permission: 'sect.hall.view',
    left: '50%',
    top: '20%',
    note: '宗门事务',
  },
  {
    id: 'gate',
    label: '山门',
    route: '/game/sect/gate',
    permission: 'sect.gate.view',
    left: '50%',
    top: '80%',
    note: '宗门动态',
    visitor: { description: '访客可在山门外投递拜帖。' },
  },
  {
    id: 'formation',
    label: '护山阵法',
    permission: 'sect.formation.view',
    left: '50%',
    top: '10%',
    note: '尚未开放',
    locked: true,
    visitor: { description: '阵纹在群峰之间流转。' },
  },
];

describe('sect map visitor state', () => {
  it('only makes explicitly presented visitor hotspots selectable', () => {
    const facilities = new Map();

    expect(
      resolveSectMapHotspotState(hotspots[0]!, 'visitor', facilities)
        .selectable,
    ).toBe(false);
    expect(
      resolveSectMapHotspotState(hotspots[1]!, 'visitor', facilities),
    ).toMatchObject({
      selectable: true,
      locked: false,
      reason: '访客可在山门外投递拜帖。',
    });
    expect(
      resolveSectMapHotspotState(hotspots[2]!, 'visitor', facilities)
        .selectable,
    ).toBe(true);
  });

  it('keeps member locking rules unchanged', () => {
    expect(
      resolveSectMapHotspotState(hotspots[2]!, 'member', new Map()),
    ).toMatchObject({
      selectable: true,
      locked: true,
    });
  });
});

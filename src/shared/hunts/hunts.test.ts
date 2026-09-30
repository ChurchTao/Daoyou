import { describe, expect, it } from 'vitest';
import {
  HuntCreateTeamSchema,
  HuntEventIdSchema,
  type HuntTeam,
} from '../contracts/hunts';
import { getAtlasRegion, hasAtlasMap } from '../lib/game/mapAtlas';
import { getWorldMapLocation } from '../lib/game/mapSystem';
import {
  HUNT_BOSSES,
  HUNT_CYCLE_MS,
  huntEventById,
  huntEventsAt,
  huntIsOpen,
} from './config';
import { huntStartError, selectHuntTeam } from './rules';
const now = HUNT_CYCLE_MS * 100 + 10;
function team(count: number, assisting = false): HuntTeam {
  return {
    id: 'a',
    event: huntEventsAt(now)[0],
    leaderId: 'c0',
    minRealm: '金丹',
    maxRealm: '元婴',
    status: 'assembling',
    revision: 0,
    members: Array.from({ length: count }, (_, i) => ({
      userId: `u${i}`,
      cultivatorId: `c${i}`,
      name: `道友${i}`,
      realm: '金丹',
      ready: true,
      assisting,
    })),
  };
}
describe('世界讨伐准入与刷新', () => {
  it('八类目标均轮换到每个境界，新旧传闻链接保持各自的目标', () => {
    const seen = Array.from({ length: 7 }, () => new Set<string>());
    for (let cycle = 100; cycle < 108; cycle++) {
      for (const [index, event] of huntEventsAt(
        HUNT_CYCLE_MS * cycle,
      ).entries()) {
        expect(HuntEventIdSchema.safeParse(event.id).success).toBe(true);
        expect(huntEventById(event.id)).toEqual(event);
        seen[index].add(event.bossId);
        const oldId = `hunt-v1-${cycle}-${index}`;
        expect(HuntEventIdSchema.safeParse(oldId).success).toBe(true);
        expect(huntEventById(oldId)?.bossId).toBe(
          ['heretic', 'demon', 'beast'][(cycle + index) % 3],
        );
        expect(event.id).not.toBe(oldId);
      }
    }
    for (const pool of seen)
      expect(pool).toEqual(new Set(Object.keys(HUNT_BOSSES)));
    expect(huntEventById('hunt-v4-100-0')).toBeUndefined();
    expect(HuntEventIdSchema.safeParse('hunt-v4-100-0').success).toBe(false);
  });
  it('北京时间每六小时刷新，同轮奖励身份保持不变，到点全部替换', () => {
    expect(HUNT_CYCLE_MS).toBe(6 * 60 * 60 * 1000);
    for (const hour of ['00', '06', '12', '18']) {
      const start = Date.parse(`2026-09-30T${hour}:00:00+08:00`);
      const events = huntEventsAt(start);
      expect(huntEventsAt(start + HUNT_CYCLE_MS - 1)).toEqual(events);
      const previous = huntEventsAt(start - 1);
      const next = huntEventsAt(start + HUNT_CYCLE_MS);
      for (const [index, event] of events.entries()) {
        expect(event.id).toMatch(/^hunt-v3-/);
        expect(HuntEventIdSchema.safeParse(event.id).success).toBe(true);
        expect(huntEventById(event.id)).toEqual(event);
        expect(event.startsAt).toBe(start);
        expect(event.expiresAt).toBe(start + HUNT_CYCLE_MS);
        expect(huntIsOpen(event, event.expiresAt)).toBe(false);
        expect(previous[index].expiresAt).toBe(start);
        expect(previous[index].id).not.toBe(event.id);
        expect(next[index].id).not.toBe(event.id);
      }
    }
  });
  it('已发布的 v1/v2 事件仍使用两小时周期和原目标，不延长旧领奖窗口', () => {
    const cycle = 248718;
    const start = cycle * 2 * 60 * 60 * 1000;
    for (const version of [1, 2]) {
      const bosses =
        version === 1
          ? ['heretic', 'demon', 'beast']
          : Object.keys(HUNT_BOSSES);
      for (let index = 0; index < 7; index++) {
        const id = `hunt-v${version}-${cycle}-${index}`;
        expect(HuntEventIdSchema.safeParse(id).success).toBe(true);
        const event = huntEventById(id)!;
        expect(event.startsAt).toBe(start);
        expect(event.expiresAt).toBe(start + 2 * 60 * 60 * 1000);
        expect(event.bossId).toBe(bosses[(cycle + index) % bosses.length]);
        expect(huntIsOpen(event, event.expiresAt)).toBe(false);
      }
    }
  });
  it('各实例对同一时间生成相同出现事件，刷新后换领奖身份', () => {
    expect(huntEventsAt(now)).toEqual(huntEventsAt(now + 1));
    const events = huntEventsAt(now);
    expect(events.map((e) => e.realm)).toEqual([
      '金丹',
      '元婴',
      '化神',
      '炼虚',
      '合体',
      '大乘',
      '渡劫',
    ]);
    for (const event of events) {
      expect(huntEventById(event.id)).toEqual(event);
      expect(
        hasAtlasMap(getAtlasRegion(getWorldMapLocation(event.nodeId)!)!.id),
      ).toBe(true);
      expect(huntIsOpen(event, event.expiresAt - 1)).toBe(true);
      expect(huntIsOpen(event, event.expiresAt)).toBe(false);
      expect(huntIsOpen(event, event.startsAt - 1)).toBe(false);
    }
    expect(
      huntEventsAt(now + HUNT_CYCLE_MS).some((e) => e.id === events[0].id),
    ).toBe(false);
    expect(huntEventById('hunt-v1-1-99')).toBeUndefined();
  });
  it.each([2, 3, 4])('%i人可开战，全部为助战成员也不限制开战', (count) => {
    expect(huntStartError(team(count, true), 'c0', now)).toBeNull();
  });
  it('拒绝单人、超员、未准备、非队长、同账号分身与过期事件', () => {
    expect(huntStartError(team(1), 'c0', now)).toMatch('2～4');
    expect(huntStartError(team(5), 'c0', now)).toMatch('2～4');
    expect(huntStartError(team(2), 'c1', now)).toMatch('队长');
    const t = team(2);
    t.members[1].ready = false;
    expect(huntStartError(t, 'c0', now)).toMatch('全员准备');
    t.members[1].ready = true;
    t.members[1].userId = 'u0';
    expect(huntStartError(t, 'c0', now)).toMatch('同一账号');
    expect(huntStartError(team(2), 'c0', team(2).event.expiresAt)).toMatch(
      '平息',
    );
  });
  it('快速匹配优先补齐符合境界的队伍，排除已开战与满队', () => {
    const a = team(1),
      b = { ...team(3), id: 'b' },
      full = { ...team(4), id: 'full' };
    expect(selectHuntTeam([a, b, full], '金丹', now)?.id).toBe('b');
    expect(selectHuntTeam([a, b], '渡劫', now)).toBeUndefined();
    b.status = 'starting';
    expect(selectHuntTeam([b, a], '金丹', now)?.id).toBe('a');
    expect(
      HuntCreateTeamSchema.safeParse({
        eventId: a.event.id,
        minRealm: '渡劫',
        maxRealm: '金丹',
      }).success,
    ).toBe(false);
  });
});

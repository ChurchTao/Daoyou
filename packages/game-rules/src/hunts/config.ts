import { HUNT_BOSSES } from '@daoyou/game-content/hunts';
import type { HuntBossId, HuntEvent } from '@daoyou/game-domain/hunts';

import { getRealmStageLevel } from '@daoyou/game-domain/progression';

import { getWorldMapLocation } from '@daoyou/game-content/world/map';

import { REALM_VALUES } from '@daoyou/constants/realms';

export const HUNT_CYCLE_MS = 24 * 60 * 60 * 1000;

const LEGACY_HUNT_CYCLE_MS = 2 * 60 * 60 * 1000;
const V3_HUNT_CYCLE_MS = 6 * 60 * 60 * 1000;

const HUNT_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
const HUNT_CYCLE_OFFSET_MS =
  HUNT_TIMEZONE_OFFSET_MS + HUNT_CYCLE_MS - 10 * 60 * 60 * 1000;

export const HUNT_REALMS = REALM_VALUES.slice(2);

const NODES = [
  'SAT_TN_04',
  'SAT_TN_02',
  'DJ_CENTRAL_01',
  'DJ_RIFT_01',
  'DJ_KW_01',
  'DJ_SKY_01',
  'DJ_TRIB_01',
];

export function huntEventsAt(now: number): HuntEvent[] {
  const cycle = Math.floor((now + HUNT_CYCLE_OFFSET_MS) / HUNT_CYCLE_MS);
  return eventsForCycle(cycle, 4);
}

// Published links retain their original duration and boss rotation.
function eventsForCycle(cycle: number, version: 1 | 2 | 3 | 4): HuntEvent[] {
  const duration =
    version === 4
      ? HUNT_CYCLE_MS
      : version === 3
        ? V3_HUNT_CYCLE_MS
        : LEGACY_HUNT_CYCLE_MS;
  const offset =
    version === 4
      ? HUNT_CYCLE_OFFSET_MS
      : version === 3
        ? HUNT_TIMEZONE_OFFSET_MS
        : 0;
  const startsAt = cycle * duration - offset;
  const bosses: HuntBossId[] =
    version === 1
      ? ['heretic', 'demon', 'beast']
      : (Object.keys(HUNT_BOSSES) as HuntBossId[]);
  return HUNT_REALMS.map((realm, index) => ({
    id: `hunt-v${version}-${cycle}-${index}`,
    bossId: bosses[(cycle + index) % bosses.length],
    realm,
    level: getRealmStageLevel(realm, '中期'),
    nodeId: NODES[index],
    locationName: getWorldMapLocation(NODES[index])!.name,
    startsAt,
    expiresAt: startsAt + duration,
  }));
}

export function huntEventById(id: string): HuntEvent | undefined {
  const match = /^hunt-v([1234])-(\d{1,10})-([0-6])$/.exec(id);
  return match
    ? eventsForCycle(Number(match[2]), Number(match[1]) as 1 | 2 | 3 | 4)[
        Number(match[3])
      ]
    : undefined;
}

export function huntIsOpen(event: HuntEvent, now: number) {
  return now >= event.startsAt && now < event.expiresAt;
}

export function huntMapHref(event: HuntEvent) {
  return `/game/map-v2?nodeId=${encodeURIComponent(event.nodeId)}&hunt=${encodeURIComponent(event.id)}`;
}

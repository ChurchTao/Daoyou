import { getRealmStageLevel } from '../config/realmProgression';
import { getWorldMapLocation } from '../lib/game/mapSystem';
import { REALM_VALUES } from '../types/constants';

export const HUNT_CYCLE_MS = 6 * 60 * 60 * 1000;
const LEGACY_HUNT_CYCLE_MS = 2 * 60 * 60 * 1000;
const HUNT_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
export const HUNT_REALMS = REALM_VALUES.slice(2);
export const HUNT_BOSSES = {
  heretic: {
    name: '噬灵邪修',
    icon: 'icon:cultivator-male-avatar',
    hint: '护法每回合都会替邪修疗伤。先封住护法的招式，或合力除去护法，便能断了他的援手。',
  },
  demon: {
    name: '六目古魔',
    icon: 'icon:beast-six-eyed-ape',
    hint: '魔眼盯上谁，古魔下一回合便会向谁挥出重击。被盯上的道友宜先防御，同伴可用保护或救援接应。',
  },
  beast: {
    name: '双生冥虎',
    icon: 'icon:beast-nether-tiger',
    hint: '双虎轮流为彼此施加护体，刀剑术法都难伤其身。可先驱散护体，或转攻另一只冥虎。',
  },
  bloodPython: {
    name: '血河妖蟒',
    icon: 'icon:beast-ink-jiao',
    hint: '妖蟒气血绵长，却无坚甲护身。先清除随从，再合力猛攻，留意长战中的疗伤与回灵。',
  },
  ironTurtle: {
    name: '铁背玄鼋',
    icon: 'icon:beast-snake-neck-turtle',
    hint: '铁背坚壳难受刀剑，却挡不住术法。擅长法术的道友主攻玄鼋，其余人先清理随从。',
  },
  mistToad: {
    name: '吞霞灵蟾',
    icon: 'icon:beast-golden-toad',
    hint: '灵蟾吞霞炼气，寻常术法难以奏效，肉身却不甚坚固。宜以刀剑近身破敌。',
  },
  gildedCorpse: {
    name: '金身尸王',
    icon: 'icon:cultivator-male-avatar',
    hint: '尸王金身不惧刀剑术法，内里气血却已枯竭。能直伤其身的固定伤害最为奏效。',
  },
  shadowMarten: {
    name: '掠影妖貂',
    icon: 'icon:beast-moon-marten',
    hint: '妖貂身法奇快，刀剑常落空。以法术攻它更稳，擅长必中招式的道友也可出手。',
  },
} as const;
export type HuntBossId = keyof typeof HUNT_BOSSES;
const NODES = [
  'SAT_TN_04',
  'SAT_TN_02',
  'DJ_CENTRAL_01',
  'DJ_RIFT_01',
  'DJ_KW_01',
  'DJ_SKY_01',
  'DJ_TRIB_01',
];
export type HuntEvent = {
  id: string;
  bossId: HuntBossId;
  realm: (typeof REALM_VALUES)[number];
  level: number;
  nodeId: string;
  locationName: string;
  startsAt: number;
  expiresAt: number;
  /** Only present in battles created before the multi-resource reward rollout. */
  spiritStones?: number;
};
export function huntEventsAt(now: number): HuntEvent[] {
  const cycle = Math.floor((now + HUNT_TIMEZONE_OFFSET_MS) / HUNT_CYCLE_MS);
  return eventsForCycle(cycle, 3);
}
// Published links retain their original duration and boss rotation.
function eventsForCycle(cycle: number, version: 1 | 2 | 3): HuntEvent[] {
  const duration = version === 3 ? HUNT_CYCLE_MS : LEGACY_HUNT_CYCLE_MS;
  const startsAt =
    cycle * duration - (version === 3 ? HUNT_TIMEZONE_OFFSET_MS : 0);
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
  const match = /^hunt-v([123])-(\d{1,10})-([0-6])$/.exec(id);
  return match
    ? eventsForCycle(Number(match[2]), Number(match[1]) as 1 | 2 | 3)[
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

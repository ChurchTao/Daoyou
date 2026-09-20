import {
  pickTowerRace,
  resolveTowerFloorKind,
  resolveTowerRealmStage,
  type TowerEncounter,
} from '@shared/lib/tower';
import {
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';

export const INFINITE_TOWER_VERSION = 1;
export const INFINITE_TOWER_REALM_FLOORS = 20;
export const INFINITE_TOWER_LAST_REALM_FLOOR =
  REALM_VALUES.length * INFINITE_TOWER_REALM_FLOORS;

const REALM_REWARD_BASE: Record<RealmType, number> = {
  炼气: 5_000,
  筑基: 10_000,
  金丹: 20_000,
  元婴: 40_000,
  化神: 80_000,
  炼虚: 120_000,
  合体: 180_000,
  大乘: 240_000,
  渡劫: 320_000,
};

export interface InfiniteTowerFloorRule {
  floor: number;
  realm: RealmType;
  realmStage: RealmStage;
  localFloor: number;
  kind: TowerEncounter['kind'];
  difficulty: number;
  endlessAttributeMultiplier: number;
}

export interface InfiniteTowerRewardPreview {
  floor: number;
  baseReward: number;
  bossBonus: number;
  totalReward: number;
  itemRewards: InfiniteTowerItemReward[];
}

export type InfiniteTowerItemRewardKind =
  'medium_qi_talisman' | 'attribute_reset_talisman';

export interface InfiniteTowerItemReward {
  kind: InfiniteTowerItemRewardKind;
  name: string;
  quantity: number;
}

export interface InfiniteTowerLeaderboardEntry {
  rank: number;
  cultivatorId: string;
  name: string;
  title: string | null;
  realm: RealmType;
  realmStage: RealmStage;
  highestFloor: number;
  reachedAt: string;
  isSelf: boolean;
}

export interface InfiniteTowerState {
  highestFloorCleared: number;
  currentFloor: number;
  totalSpiritStonesEarned: number;
  firstReachedAt: string | null;
  currentRule: InfiniteTowerFloorRule;
  currentReward: InfiniteTowerRewardPreview;
}

export interface InfiniteTowerBattleContext {
  battleId: string;
  encounter: TowerEncounter;
  reward: InfiniteTowerRewardPreview;
}

export function normalizeInfiniteTowerFloor(floor: number): number {
  if (!Number.isFinite(floor)) return 1;
  return Math.max(1, Math.min(100_000, Math.floor(floor)));
}

export function resolveInfiniteTowerFloor(
  floor: number,
): InfiniteTowerFloorRule {
  const safeFloor = normalizeInfiniteTowerFloor(floor);
  const isEndless = safeFloor > INFINITE_TOWER_LAST_REALM_FLOOR;
  const realmIndex = Math.min(
    REALM_VALUES.length - 1,
    Math.floor((safeFloor - 1) / INFINITE_TOWER_REALM_FLOORS),
  );
  const localFloor = isEndless
    ? INFINITE_TOWER_REALM_FLOORS
    : ((safeFloor - 1) % INFINITE_TOWER_REALM_FLOORS) + 1;
  const endlessSteps = isEndless
    ? Math.floor((safeFloor - INFINITE_TOWER_LAST_REALM_FLOOR - 1) / 10) + 1
    : 0;

  return {
    floor: safeFloor,
    realm: REALM_VALUES[realmIndex],
    realmStage: isEndless ? '圆满' : resolveTowerRealmStage(localFloor),
    localFloor,
    kind: resolveTowerFloorKind(isEndless ? safeFloor : localFloor),
    difficulty: isEndless ? 100 : localFloor * 5,
    endlessAttributeMultiplier: Math.min(5, 1 + endlessSteps * 0.05),
  };
}

export function resolveInfiniteTowerReward(
  floor: number,
): InfiniteTowerRewardPreview {
  const rule = resolveInfiniteTowerFloor(floor);
  const realmBase = REALM_REWARD_BASE[rule.realm];
  let baseReward: number;

  if (rule.floor <= INFINITE_TOWER_LAST_REALM_FLOOR) {
    const ratio = 0.5 + (rule.localFloor - 1) / 19;
    baseReward = Math.round((realmBase * ratio) / 500) * 500;
  } else {
    const endlessProgress = (rule.floor - INFINITE_TOWER_LAST_REALM_FLOOR) / 50;
    baseReward = Math.min(
      500_000,
      Math.round((realmBase * (1 + endlessProgress * 0.1)) / 500) * 500,
    );
  }

  const bossBonus =
    rule.kind === 'boss' ? Math.min(2_500_000, realmBase * 5) : 0;
  const itemRewards: InfiniteTowerItemReward[] = [];

  if (rule.floor % 20 === 0) {
    itemRewards.push({
      kind: 'medium_qi_talisman',
      name: '中聚灵符',
      quantity: 1,
    });
  }
  if (rule.floor % 50 === 0) {
    itemRewards.push({
      kind: 'attribute_reset_talisman',
      name: '归元洗髓符',
      quantity: 1,
    });
  }

  return {
    floor: rule.floor,
    baseReward,
    bossBonus,
    totalReward: baseReward + bossBonus,
    itemRewards,
  };
}

export function buildInfiniteTowerEncounter(args: {
  cultivatorId: string;
  floor: number;
}): TowerEncounter {
  const rule = resolveInfiniteTowerFloor(args.floor);
  return {
    floor: rule.floor,
    kind: rule.kind,
    difficulty: rule.difficulty,
    race: pickTowerRace(
      `infinite-tower:v${INFINITE_TOWER_VERSION}:${args.cultivatorId}`,
      rule.floor,
    ),
    realm: rule.realm,
    realmStage: rule.realmStage,
    isBoss: rule.kind === 'boss',
  };
}

export function buildInfiniteTowerEnemySeed(args: {
  cultivatorId: string;
  floor: number;
}): string {
  return `infinite-tower:v${INFINITE_TOWER_VERSION}:${args.cultivatorId}:${normalizeInfiniteTowerFloor(args.floor)}`;
}

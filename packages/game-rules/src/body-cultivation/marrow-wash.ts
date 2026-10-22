import type { RealmType } from '@daoyou/constants/realms';
import type {
  CultivatorCondition,
  MarrowWashState,
} from '@daoyou/game-domain/condition';
import { advanceProgressTrack } from './progress.js';

export const SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP = 120;

const MARROW_WASH_LEVEL_CAP_BY_REALM = {
  炼气: 10,
  筑基: 20,
  金丹: 35,
  元婴: 50,
  化神: 70,
  炼虚: 90,
  合体: 120,
  大乘: 120,
  渡劫: 120,
} as const satisfies Record<RealmType, number>;

export interface MarrowWashSummary {
  level: number;
  progress: number;
  threshold: number;
  levelCap: number;
}

export interface MarrowWashProgressAdvance {
  state: Required<MarrowWashState>;
  levelUps: number[];
  unusedProgress: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getMarrowWashThresholdByLevel(level: number): number {
  return 120 + 60 * Math.max(0, Math.floor(level));
}

export function getMarrowWashLevelCapByCultivationRealm(
  realm: RealmType | undefined,
): number {
  return realm
    ? MARROW_WASH_LEVEL_CAP_BY_REALM[realm]
    : MARROW_WASH_LEVEL_CAP_BY_REALM.炼气;
}

export function normalizeMarrowWashState(
  conditionInput: CultivatorCondition | undefined,
): Required<MarrowWashState> {
  const raw = conditionInput?.tracks?.marrowWash;
  const rawLevel = Math.max(0, Math.floor(raw?.level ?? 0));
  const rawProgress = Math.max(0, Math.floor(raw?.progress ?? 0));
  const rawBreakthroughs = Math.max(0, Math.floor(raw?.breakthroughs ?? 0));
  const rawRealm = Math.max(0, Math.floor(raw?.realm ?? 0));
  const breakthroughs = Math.max(rawBreakthroughs, rawRealm);
  const realm = breakthroughs;

  return {
    version: 1,
    level: rawLevel,
    progress: rawProgress,
    realm,
    breakthroughs,
  };
}

export function getMarrowWashRootBonus(level: number): number {
  return Math.floor(Math.max(0, level) / 10);
}

export function advanceMarrowWash(
  state: Required<MarrowWashState>,
  value: number,
  realm: RealmType,
): MarrowWashProgressAdvance {
  return advanceProgressTrack(
    state,
    value,
    getMarrowWashLevelCapByCultivationRealm(realm),
    getMarrowWashThresholdByLevel,
  );
}

export function getMarrowWashSummary(
  conditionInput: CultivatorCondition | undefined,
  options: { cultivatorRealm?: RealmType } = {},
): MarrowWashSummary {
  const state = normalizeMarrowWashState(conditionInput);
  const levelCap = getMarrowWashLevelCapByCultivationRealm(
    options.cultivatorRealm,
  );

  return {
    level: state.level,
    progress: state.progress,
    threshold: getMarrowWashThresholdByLevel(state.level),
    levelCap,
  };
}

export function clampSpiritualRootEffectiveStrength(value: number): number {
  return clamp(Math.floor(value), 0, SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP);
}

export function getSpiritualRootBaseStrength(root: {
  strength: number;
  baseStrength?: number;
}): number {
  return Math.max(0, Math.floor(root.baseStrength ?? root.strength));
}

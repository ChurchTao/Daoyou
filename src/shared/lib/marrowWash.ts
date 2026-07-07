import type { CultivatorCondition, MarrowWashState } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';

export const SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP = 120;
export const MARROW_WASH_BREAKTHROUGH_QI_COST = 20;
export const MARROW_WASH_BREAKTHROUGH_LEVEL_STEP = 10;

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
  realm: number;
  realmLabel: string;
  breakthroughs: number;
  levelCap: number;
  nextBreakthroughLevel: number | null;
  canBreakthrough: boolean;
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
  return realm ? MARROW_WASH_LEVEL_CAP_BY_REALM[realm] : MARROW_WASH_LEVEL_CAP_BY_REALM.炼气;
}

export function normalizeMarrowWashState(
  conditionInput: CultivatorCondition | undefined,
): Required<MarrowWashState> {
  const raw = conditionInput?.tracks?.marrowWash;
  const level = Math.max(0, Math.floor(raw?.level ?? 0));
  const progress = Math.max(0, Math.floor(raw?.progress ?? 0));
  const inferredBreakthroughs = Math.max(
    0,
    Math.floor(level / MARROW_WASH_BREAKTHROUGH_LEVEL_STEP) - 1,
  );
  const breakthroughs = Math.max(
    0,
    Math.floor(raw?.breakthroughs ?? inferredBreakthroughs),
  );
  const realm = Math.max(0, Math.floor(raw?.realm ?? breakthroughs));

  return {
    version: 1,
    level,
    progress,
    realm,
    breakthroughs,
  };
}

export function getMarrowWashRealmLabel(realm: number): string {
  return realm <= 0 ? '未破限' : `第${realm}重`;
}

export function getNextMarrowWashBreakthroughLevel(
  state: Pick<MarrowWashState, 'breakthroughs'>,
): number {
  return (
    (Math.max(0, Math.floor(state.breakthroughs ?? 0)) + 1) *
    MARROW_WASH_BREAKTHROUGH_LEVEL_STEP
  );
}

export function getMarrowWashSummary(
  conditionInput: CultivatorCondition | undefined,
  options: { cultivatorRealm?: RealmType } = {},
): MarrowWashSummary {
  const state = normalizeMarrowWashState(conditionInput);
  const levelCap = getMarrowWashLevelCapByCultivationRealm(options.cultivatorRealm);
  const nextBreakthroughLevel = getNextMarrowWashBreakthroughLevel(state);
  const canReachNext = nextBreakthroughLevel <= levelCap;

  return {
    level: state.level,
    progress: state.progress,
    threshold: getMarrowWashThresholdByLevel(state.level),
    realm: state.realm,
    realmLabel: getMarrowWashRealmLabel(state.realm),
    breakthroughs: state.breakthroughs,
    levelCap,
    nextBreakthroughLevel: canReachNext ? nextBreakthroughLevel : null,
    canBreakthrough: canReachNext && state.level >= nextBreakthroughLevel,
  };
}

export function breakthroughMarrowWash(
  conditionInput: CultivatorCondition | undefined,
  options: { cultivatorRealm?: RealmType } = {},
): {
  condition: CultivatorCondition;
  fromRealm: number;
  toRealm: number;
  breakthroughLevel: number;
} {
  if (!conditionInput) {
    throw new Error('洗髓状态缺失，无法突破。');
  }

  const state = normalizeMarrowWashState(conditionInput);
  const levelCap = getMarrowWashLevelCapByCultivationRealm(options.cultivatorRealm);
  const breakthroughLevel = getNextMarrowWashBreakthroughLevel(state);

  if (breakthroughLevel > levelCap) {
    throw new Error(
      `当前修为境界最多承载洗髓 Lv.${levelCap}，需提升修为后再继续洗髓破限。`,
    );
  }
  if (state.level < breakthroughLevel) {
    throw new Error(`洗髓等级不足，达到 Lv.${breakthroughLevel} 后方可破限。`);
  }

  const toRealm = state.breakthroughs + 1;
  return {
    condition: {
      ...conditionInput,
      tracks: {
        ...conditionInput.tracks,
        marrowWash: {
          ...state,
          realm: toRealm,
          breakthroughs: toRealm,
        },
      },
    },
    fromRealm: state.realm,
    toRealm,
    breakthroughLevel,
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

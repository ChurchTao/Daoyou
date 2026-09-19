import type {
  BodyCultivationRealm,
  BodyCultivationState,
  CultivatorCondition,
} from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import {
  BODY_CULTIVATION_REALM_REQUIREMENTS,
  getNextBodyCultivationRealm,
} from './config';
import { normalizeBodyCultivationState } from './normalize';
import { getBodyCultivationSummary } from './summary';

export interface BodyCultivationRealmBreakthroughPreview {
  currentRealm: BodyCultivationRealm;
  nextRealm: BodyCultivationRealm | null;
  canAdvance: boolean;
  totalLevel: number;
  requiredTotalLevel: number | null;
  requiredCultivationRealm: RealmType | null;
  requirements: {
    label: string;
    met: boolean;
  }[];
}

export interface BodyCultivationRealmBreakthroughResult {
  state: BodyCultivationState;
  fromRealm: BodyCultivationRealm;
  toRealm: BodyCultivationRealm;
}

export function previewBodyCultivationRealmBreakthrough(
  condition: CultivatorCondition | undefined,
  options: { cultivatorRealm?: RealmType } = {},
): BodyCultivationRealmBreakthroughPreview {
  const state = normalizeBodyCultivationState(condition);
  const summary = getBodyCultivationSummary(condition, options);
  const nextRealm = summary.nextRealm?.key ?? null;
  const requirement = nextRealm
    ? BODY_CULTIVATION_REALM_REQUIREMENTS[nextRealm]
    : null;

  return {
    currentRealm: state.realm,
    nextRealm,
    canAdvance: summary.nextRealm?.canAttempt ?? false,
    totalLevel: summary.totalLevel,
    requiredTotalLevel: requirement?.totalLevel ?? null,
    requiredCultivationRealm: requirement?.minCultivationRealm ?? null,
    requirements: summary.nextRealm?.requirements ?? [],
  };
}

export function breakthroughBodyCultivationRealm(
  condition: CultivatorCondition | undefined,
  options: { cultivatorRealm?: RealmType } = {},
): BodyCultivationRealmBreakthroughResult {
  const state = normalizeBodyCultivationState(condition);
  const preview = previewBodyCultivationRealmBreakthrough(condition, options);

  if (!preview.nextRealm) {
    throw new Error('肉身已达最高阶位。');
  }

  if (!preview.canAdvance) {
    const missing = preview.requirements
      .filter((requirement) => !requirement.met)
      .map((requirement) => requirement.label)
      .join('、');
    throw new Error(`肉身进阶条件不足：${missing}`);
  }

  const nextRealm = getNextBodyCultivationRealm(state.realm);
  if (nextRealm !== preview.nextRealm) {
    throw new Error('肉身阶位状态不一致，请重新尝试。');
  }

  return {
    state: {
      ...state,
      realm: preview.nextRealm,
      milestones: { ...state.milestones },
      breakthrough: undefined,
    },
    fromRealm: state.realm,
    toRealm: preview.nextRealm,
  };
}

export function getBodyCultivationRealmSoftCap(
  realm: BodyCultivationRealm,
): number {
  return BODY_CULTIVATION_REALM_REQUIREMENTS[realm].softTrackCap;
}

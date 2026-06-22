import type {
  BodyCultivationRealm,
  BodyCultivationState,
  CultivatorCondition,
} from '@shared/types/condition';
import type { MaterialType, Quality, RealmType } from '@shared/types/constants';
import type { AlchemyPropertyKey } from '@shared/types/consumable';
import { getMaterialTypeLabel } from '@shared/lib/gameConceptDisplay';
import {
  BODY_CULTIVATION_REALM_REQUIREMENTS,
  getNextBodyCultivationRealm,
} from './config';
import { normalizeBodyCultivationState } from './normalize';
import { getBodyCultivationSummary } from './summary';

export interface BodyCultivationRealmBreakthroughPreview {
  currentRealm: BodyCultivationRealm;
  nextRealm: BodyCultivationRealm | null;
  canAttempt: boolean;
  successChance: number;
  guaranteeProgress: number;
  failedAttempts: number;
  requirements: {
    label: string;
    met: boolean;
  }[];
  costs: BodyCultivationRealmBreakthroughCost[];
}

export type BodyCultivationRealmBreakthroughCost =
  | {
      type: 'material';
      name: string;
      label: string;
      quantity: number;
      materialType: MaterialType;
      minQuality: Quality;
    }
  | {
      type: 'consumable';
      name: string;
      label: string;
      quantity: number;
      family: 'tempering';
      property: Extract<AlchemyPropertyKey, `body_${string}`>;
      minQuality: Quality;
    };

export interface BodyCultivationRealmBreakthroughResult {
  state: BodyCultivationState;
  fromRealm: BodyCultivationRealm;
  toRealm: BodyCultivationRealm;
  success: boolean;
  chance: number;
  roll: number;
  failedAttempts: number;
  guaranteeProgress: number;
}

export const BODY_CULTIVATION_BREAKTHROUGH_BASE_CHANCE = 0.82;
export const BODY_CULTIVATION_BREAKTHROUGH_FAILURE_PROGRESS = 34;
export const BODY_CULTIVATION_BREAKTHROUGH_PITY_BONUS = 0.08;
export const BODY_CULTIVATION_BREAKTHROUGH_MAX_CHANCE = 0.98;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getBodyCultivationBreakthroughProgress(
  state: BodyCultivationState,
  nextRealm: BodyCultivationRealm | null,
): { failedAttempts: number; progress: number } {
  if (!nextRealm || state.breakthrough?.targetRealm !== nextRealm) {
    return { failedAttempts: 0, progress: 0 };
  }

  return {
    failedAttempts: Math.max(0, Math.floor(state.breakthrough.failedAttempts)),
    progress: clamp(Math.floor(state.breakthrough.progress), 0, 100),
  };
}

function getBodyCultivationBreakthroughChance(
  failedAttempts: number,
  guaranteeProgress: number,
): number {
  if (guaranteeProgress >= 100) {
    return 1;
  }

  return clamp(
    BODY_CULTIVATION_BREAKTHROUGH_BASE_CHANCE +
      Math.max(0, failedAttempts) * BODY_CULTIVATION_BREAKTHROUGH_PITY_BONUS,
    BODY_CULTIVATION_BREAKTHROUGH_BASE_CHANCE,
    BODY_CULTIVATION_BREAKTHROUGH_MAX_CHANCE,
  );
}

const BODY_CULTIVATION_REALM_BREAKTHROUGH_PILL_REQUIREMENTS: Partial<
  Record<
    BodyCultivationRealm,
    {
      property: Extract<AlchemyPropertyKey, `body_${string}`>;
      minQuality: Quality;
      label: string;
    }
  >
> = {
  bronze_skin: {
    property: 'body_skin',
    minQuality: '玄品',
    label: '炼体·皮肤破限丹（玄品以上）',
  },
  iron_bone: {
    property: 'body_sinew_bone',
    minQuality: '玄品',
    label: '炼体·筋骨破限丹（玄品以上）',
  },
  jade_marrow: {
    property: 'body_sinew_bone',
    minQuality: '真品',
    label: '炼体·筋骨破限丹（真品以上）',
  },
  golden_body: {
    property: 'body_organs',
    minQuality: '地品',
    label: '炼体·脏腑破限丹（地品以上）',
  },
  dharma_body: {
    property: 'body_primordial_spirit',
    minQuality: '天品',
    label: '炼体·元神破限丹（天品以上）',
  },
  dao_body: {
    property: 'body_primordial_spirit',
    minQuality: '仙品',
    label: '炼体·元神破限丹（仙品以上）',
  },
};

const BODY_CULTIVATION_REALM_BREAKTHROUGH_MATERIAL_REQUIREMENTS: Partial<
  Record<
    BodyCultivationRealm,
    {
      materialType: MaterialType;
      minQuality: Quality;
    }
  >
> = {
  bronze_skin: {
    materialType: 'aux',
    minQuality: '玄品',
  },
  iron_bone: {
    materialType: 'tcdb',
    minQuality: '玄品',
  },
  jade_marrow: {
    materialType: 'tcdb',
    minQuality: '真品',
  },
  golden_body: {
    materialType: 'tcdb',
    minQuality: '地品',
  },
  dharma_body: {
    materialType: 'tcdb',
    minQuality: '天品',
  },
  dao_body: {
    materialType: 'tcdb',
    minQuality: '仙品',
  },
};

function getBodyCultivationMaterialRequirementLabel(
  materialType: MaterialType,
  minQuality: Quality,
): string {
  return `破限资材（${getMaterialTypeLabel(materialType)}，${minQuality}以上）`;
}

function buildBodyCultivationBreakthroughCosts(
  realm: BodyCultivationRealm,
  options: { materialQuantity?: number; pillQuantity?: number } = {},
): BodyCultivationRealmBreakthroughCost[] {
  const materialRequirement =
    BODY_CULTIVATION_REALM_BREAKTHROUGH_MATERIAL_REQUIREMENTS[realm];
  const pillRequirement =
    BODY_CULTIVATION_REALM_BREAKTHROUGH_PILL_REQUIREMENTS[realm];
  const costs: BodyCultivationRealmBreakthroughCost[] = [];

  if (materialRequirement) {
    const label = getBodyCultivationMaterialRequirementLabel(
      materialRequirement.materialType,
      materialRequirement.minQuality,
    );
    costs.push({
      type: 'material',
      name: label,
      label,
      quantity: options.materialQuantity ?? 1,
      materialType: materialRequirement.materialType,
      minQuality: materialRequirement.minQuality,
    });
  }

  if (pillRequirement) {
    costs.push({
      type: 'consumable',
      name: pillRequirement.label,
      label: pillRequirement.label,
      quantity: options.pillQuantity ?? 1,
      family: 'tempering',
      property: pillRequirement.property,
      minQuality: pillRequirement.minQuality,
    });
  }

  return costs;
}

export const BODY_CULTIVATION_REALM_BREAKTHROUGH_COSTS: Partial<
  Record<
    BodyCultivationRealm,
    readonly BodyCultivationRealmBreakthroughCost[]
  >
> = {
  bronze_skin: buildBodyCultivationBreakthroughCosts('bronze_skin'),
  iron_bone: buildBodyCultivationBreakthroughCosts('iron_bone'),
  jade_marrow: buildBodyCultivationBreakthroughCosts('jade_marrow', {
    materialQuantity: 2,
  }),
  golden_body: buildBodyCultivationBreakthroughCosts('golden_body'),
  dharma_body: buildBodyCultivationBreakthroughCosts('dharma_body'),
  dao_body: buildBodyCultivationBreakthroughCosts('dao_body', {
    materialQuantity: 2,
  }),
};

export function getBodyCultivationRealmBreakthroughCosts(
  realm: BodyCultivationRealm | null,
): BodyCultivationRealmBreakthroughCost[] {
  if (!realm) return [];
  return [...(BODY_CULTIVATION_REALM_BREAKTHROUGH_COSTS[realm] ?? [])];
}

export function previewBodyCultivationRealmBreakthrough(
  condition: CultivatorCondition | undefined,
  options: { cultivatorRealm?: RealmType } = {},
): BodyCultivationRealmBreakthroughPreview {
  const state = normalizeBodyCultivationState(condition);
  const summary = getBodyCultivationSummary(condition, options);
  const nextRealm = summary.nextRealm?.key ?? null;
  const progress = getBodyCultivationBreakthroughProgress(state, nextRealm);

  return {
    currentRealm: state.realm,
    nextRealm,
    canAttempt: summary.nextRealm?.canAttempt ?? false,
    successChance: getBodyCultivationBreakthroughChance(
      progress.failedAttempts,
      progress.progress,
    ),
    guaranteeProgress: progress.progress,
    failedAttempts: progress.failedAttempts,
    requirements: summary.nextRealm?.requirements ?? [],
    costs: getBodyCultivationRealmBreakthroughCosts(
      summary.nextRealm?.key ?? null,
    ),
  };
}

export function breakthroughBodyCultivationRealm(
  condition: CultivatorCondition | undefined,
  options: { cultivatorRealm?: RealmType } = {},
  rng: () => number = Math.random,
): BodyCultivationRealmBreakthroughResult {
  const state = normalizeBodyCultivationState(condition);
  const preview = previewBodyCultivationRealmBreakthrough(condition, options);

  if (!preview.nextRealm) {
    throw new Error('肉身已达最高阶位。');
  }

  if (!preview.canAttempt) {
    const missing = preview.requirements
      .filter((requirement) => !requirement.met)
      .map((requirement) => requirement.label)
      .join('、');
    throw new Error(`肉身破限条件不足：${missing}`);
  }

  const nextRealm = getNextBodyCultivationRealm(state.realm);
  if (nextRealm !== preview.nextRealm) {
    throw new Error('肉身阶位状态不一致，请重新尝试。');
  }

  const roll = rng();
  const success = roll <= preview.successChance;

  if (!success) {
    const failedAttempts = preview.failedAttempts + 1;
    const guaranteeProgress = clamp(
      preview.guaranteeProgress +
        BODY_CULTIVATION_BREAKTHROUGH_FAILURE_PROGRESS,
      0,
      100,
    );

    return {
      state: {
        ...state,
        breakthrough: {
          targetRealm: preview.nextRealm,
          progress: guaranteeProgress,
          failedAttempts,
        },
      },
      fromRealm: state.realm,
      toRealm: preview.nextRealm,
      success: false,
      chance: preview.successChance,
      roll,
      failedAttempts,
      guaranteeProgress,
    };
  }

  return {
    state: {
      ...state,
      realm: preview.nextRealm,
      milestones: {
        ...state.milestones,
        [`realm.${preview.nextRealm}`]: true,
      },
      breakthrough: undefined,
    },
    fromRealm: state.realm,
    toRealm: preview.nextRealm,
    success: true,
    chance: preview.successChance,
    roll,
    failedAttempts: 0,
    guaranteeProgress: 0,
  };
}

export function getBodyCultivationRealmSoftCap(
  realm: BodyCultivationRealm,
): number {
  return BODY_CULTIVATION_REALM_REQUIREMENTS[realm].softTrackCap;
}

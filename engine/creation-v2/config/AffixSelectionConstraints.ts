import type { AffixSelectionConstraints } from '../rules/contracts';
import type { AffixCandidate, AffixCategory, CreationProductType } from '../types';
import {
  CREATION_AFFIX_BUCKET_CAP_PROFILES,
  CREATION_AFFIX_CATEGORY_CAP_PROFILES,
  CREATION_PROJECTION_BALANCE,
  type CreationAffixBucketCaps,
} from './CreationBalance';

/**
 * 单个产物类型在不同词缀槽位数下的约束画像。
 *
 * 用途：
 * 1. 定义不同产物在 2/3/4/5 槽时，允许出现多少个各分类词缀。
 * 2. 定义高阶桶总量上限，避免高阶词缀在高投入场景中失控。
 */
export interface AffixSelectionConstraintProfile {
  /**
   * 分类上限表。
   * key 是最大词缀槽位数，value 是该槽位数下各分类最多允许被抽中的数量。
   */
  categoryCapsBySlotCount: Readonly<
    Record<number, Readonly<Record<AffixCategory, number>>>
  >;

  /**
   * 高阶桶上限表。
   * key 是最大词缀槽位数，value 用来限制 signature/synergy/mythic 这类高阶词缀的总量。
   */
  bucketCapsBySlotCount: Readonly<Record<number, Readonly<CreationAffixBucketCaps>>>;
}

/** 便于表达“槽位数 -> 分类上限”的只读映射类型。 */
type AffixCategoryCapProfileMap = Readonly<
  Record<number, Readonly<Record<AffixCategory, number>>>
>;

/** 便于表达“槽位数 -> 高阶桶上限”的只读映射类型。 */
type AffixBucketCapProfileMap = Readonly<
  Record<number, Readonly<CreationAffixBucketCaps>>
>;

/**
 * 默认约束画像。
 *
 * 作用：
 * 1. 作为所有产物的基础公共约束。
 * 2. 当某个产物没有单独配置时，直接回退到这套默认值。
 */
export const DEFAULT_AFFIX_SELECTION_CONSTRAINT_PROFILE: Readonly<AffixSelectionConstraintProfile> = {
  categoryCapsBySlotCount: CREATION_AFFIX_CATEGORY_CAP_PROFILES,
  bucketCapsBySlotCount: CREATION_AFFIX_BUCKET_CAP_PROFILES,
};

/**
 * 技能产物的词缀约束画像。
 *
 * 调整方向：
 * 1. 相比默认配置，更偏向 prefix，强调主动输出和前置增伤能力。
 * 2. 在 4 槽阶段压制 synergy，避免中投入时过早进入复杂联动形态。
 */
export const SKILL_AFFIX_SELECTION_CONSTRAINT_PROFILE: Readonly<AffixSelectionConstraintProfile> = {
  categoryCapsBySlotCount: withCategoryCapOverrides({
    // 3 槽：允许双 prefix，鼓励技能尽早形成“核心伤害 + 双前置强化”的轮廓。
    3: { prefix: 2, suffix: 1 },
    // 4 槽：仍然偏向 prefix，同时先关闭 synergy，避免联动词条在中段投入中过强。
    4: { prefix: 2, suffix: 1, synergy: 0 },
    // 5 槽：显式保留双 prefix 倾向，其余分类沿用默认 5 槽约束。
    5: { prefix: 2 },
  }),
  // 目前仍沿用默认高阶桶限制：5 槽最多 1 个高阶词条，且 mythic 最多 1 个。
  bucketCapsBySlotCount: withBucketCapOverrides({}),
};

/**
 * 法宝产物的词缀约束画像。
 *
 * 调整方向：
 * 1. 相比技能，更偏向 suffix，方便承载护盾、回复、反制等持续型能力。
 * 2. 4 槽时允许 1 个 synergy，为法宝留出少量机制联动空间。
 */
export const ARTIFACT_AFFIX_SELECTION_CONSTRAINT_PROFILE: Readonly<AffixSelectionConstraintProfile> = {
  categoryCapsBySlotCount: withCategoryCapOverrides({
    // 3 槽：优先给 suffix，法宝更容易先成型为“核心 + 双被动支撑”。
    3: { prefix: 1, suffix: 2 },
    // 4 槽：继续保持 suffix 倾向，同时开放 1 个 synergy 作为功能联动入口。
    4: { prefix: 1, suffix: 2, synergy: 1 },
    // 5 槽：仍然保持法宝的 suffix 倾向，方便后期堆持续收益或防御类机制。
    5: { prefix: 1, suffix: 2 },
  }),
  // 当前高阶桶仍与默认保持一致，后续如果法宝高阶表现偏弱/偏强可单独调这里。
  bucketCapsBySlotCount: withBucketCapOverrides({}),
};

/**
 * 功法产物的词缀约束画像。
 *
 * 调整方向：
 * 1. 同样偏向 suffix，用来容纳回复、增益、资源循环等持续效果。
 * 2. 与法宝不同，4 槽时先关闭 synergy，避免功法在中段投入时联动层级过快抬升。
 */
export const GONGFA_AFFIX_SELECTION_CONSTRAINT_PROFILE: Readonly<AffixSelectionConstraintProfile> = {
  categoryCapsBySlotCount: withCategoryCapOverrides({
    // 3 槽：优先形成“核心 + 双持续/回复型后缀”的基础骨架。
    3: { prefix: 1, suffix: 2 },
    // 4 槽：仍然维持 suffix 倾向，同时显式关闭 synergy，控制中段复杂度。
    4: { prefix: 1, suffix: 2, synergy: 0 },
    // 5 槽：保留 suffix 偏好，方便高投入时继续叠加续航和功能性效果。
    5: { prefix: 1, suffix: 2 },
  }),
  // 高阶桶目前也沿用默认值，确保强度边界先统一再按产物细调。
  bucketCapsBySlotCount: withBucketCapOverrides({}),
};

/**
 * 产物类型 -> 约束画像 的总注册表。
 *
 * 作用：
 * 1. 让 selector 根据 productType 自动找到对应的约束配置。
 * 2. 后续如果新增产物类型，只需要在这里注册新的 profile。
 */
export const CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES: Readonly<
  Record<CreationProductType, Readonly<AffixSelectionConstraintProfile>>
> = {
  skill: SKILL_AFFIX_SELECTION_CONSTRAINT_PROFILE,
  artifact: ARTIFACT_AFFIX_SELECTION_CONSTRAINT_PROFILE,
  gongfa: GONGFA_AFFIX_SELECTION_CONSTRAINT_PROFILE,
};

/**
 * 根据产物类型、槽位上限和候选池内容，解析本次抽词缀应使用的完整约束。
 *
 * 参数含义：
 * - productType：当前造物产物类型，用来决定使用哪套 profile。
 * - maxCount：本次流程允许抽取的最大词缀数量，通常由预算对应的槽位数决定。
 * - pool：当前词缀候选池，用来按“实际可用候选数”收缩各分类上限。
 *
 * 返回值含义：
 * - categoryCaps：当前轮抽取时，各分类最多还能拿多少个。
 * - bucketCaps：当前轮抽取时，高阶词缀总量和 mythic 数量上限。
 */
export function resolveAffixSelectionConstraints(
  productType: CreationProductType,
  maxCount: number,
  pool: AffixCandidate[],
): AffixSelectionConstraints {
  const profile =
    CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES[productType] ??
    DEFAULT_AFFIX_SELECTION_CONSTRAINT_PROFILE;

  if (maxCount <= 0) {
    return {
      categoryCaps: createEmptyCategoryCaps(),
      bucketCaps: { highTierTotal: 0, mythic: 0 },
    };
  }

  // 如果传入的槽位数没有专门配置，就回退到系统默认最大槽位的 profile，避免出现无配置空洞。
  const normalizedMaxCount =
    profile.categoryCapsBySlotCount[maxCount] !== undefined &&
    profile.bucketCapsBySlotCount[maxCount] !== undefined
      ? maxCount
      : CREATION_PROJECTION_BALANCE.defaultMaxAffixCount;

  // 统计候选池里每个分类实际有多少候选，防止 cap 大于可选数量。
  const categoryAvailable = countByCategory(pool);
  const categoryProfile =
    profile.categoryCapsBySlotCount[normalizedMaxCount] ??
    profile.categoryCapsBySlotCount[CREATION_PROJECTION_BALANCE.defaultMaxAffixCount];
  const bucketProfile =
    profile.bucketCapsBySlotCount[normalizedMaxCount] ??
    profile.bucketCapsBySlotCount[CREATION_PROJECTION_BALANCE.defaultMaxAffixCount];

  return {
    categoryCaps: {
      core: Math.min(categoryProfile.core, categoryAvailable.core ?? 0),
      prefix: Math.min(categoryProfile.prefix, categoryAvailable.prefix ?? 0),
      suffix: Math.min(categoryProfile.suffix, categoryAvailable.suffix ?? 0),
      resonance: Math.min(categoryProfile.resonance, categoryAvailable.resonance ?? 0),
      signature: Math.min(categoryProfile.signature, categoryAvailable.signature ?? 0),
      synergy: Math.min(categoryProfile.synergy, categoryAvailable.synergy ?? 0),
      mythic: Math.min(categoryProfile.mythic, categoryAvailable.mythic ?? 0),
    },
    bucketCaps: bucketProfile,
  };
}

/** 生成一份全 0 的分类上限，用于“完全不允许抽取任何词缀”的场景。 */
function createEmptyCategoryCaps(): Record<AffixCategory, number> {
  return {
    core: 0,
    prefix: 0,
    suffix: 0,
    resonance: 0,
    signature: 0,
    synergy: 0,
    mythic: 0,
  };
}

/** 统计候选池中各分类实际可用的词缀数量。 */
function countByCategory(
  pool: AffixCandidate[],
): Partial<Record<AffixCategory, number>> {
  const counts: Partial<Record<AffixCategory, number>> = {};
  for (const candidate of pool) {
    counts[candidate.category] = (counts[candidate.category] ?? 0) + 1;
  }
  return counts;
}

/**
 * 在默认分类上限矩阵上做局部覆写。
 *
 * 用途：
 * 1. 只改少数槽位数、少数分类的上限。
 * 2. 未覆写的部分自动继承默认配置，避免整张表重复维护。
 */
function withCategoryCapOverrides(
  overrides: Partial<Record<number, Partial<Record<AffixCategory, number>>>>,
): AffixCategoryCapProfileMap {
  return Object.fromEntries(
    Object.entries(CREATION_AFFIX_CATEGORY_CAP_PROFILES).map(
      ([slotCount, caps]) => [
        Number(slotCount),
        {
          ...caps,
          ...(overrides[Number(slotCount)] ?? {}),
        },
      ],
    ),
  ) as AffixCategoryCapProfileMap;
}

/**
 * 在默认高阶桶矩阵上做局部覆写。
 *
 * 用途：
 * 1. 当某个产物类型需要单独调高/调低高阶词缀可达性时使用。
 * 2. 未覆写的槽位直接沿用默认桶限制。
 */
function withBucketCapOverrides(
  overrides: Partial<Record<number, Partial<CreationAffixBucketCaps>>>,
): AffixBucketCapProfileMap {
  return Object.fromEntries(
    Object.entries(CREATION_AFFIX_BUCKET_CAP_PROFILES).map(
      ([slotCount, caps]) => [
        Number(slotCount),
        {
          ...caps,
          ...(overrides[Number(slotCount)] ?? {}),
        },
      ],
    ),
  ) as AffixBucketCapProfileMap;
}
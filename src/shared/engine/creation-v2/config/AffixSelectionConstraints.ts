import type { AffixSelectionConstraints } from '../rules/contracts';
import type { AffixCandidate, AffixCategory, CreationProductType } from '../types';
import { CREATION_PROJECTION_BALANCE } from './CreationBalance';

/**
 * 每个产物类型的固定池配额。
 * key 是词缀 category，value 是该池最多允许被抽中的数量。
 * Math.min 收缩逻辑由 resolveAffixSelectionConstraints 负责。
 */
const SKILL_POOL_CAPS: Partial<Record<AffixCategory, number>> = {
  skill_core: 1,
  skill_variant: 4,
  skill_rare: 1,
};

const GONGFA_POOL_CAPS: Partial<Record<AffixCategory, number>> = {
  gongfa_foundation: 1,
  gongfa_school: 4,
  gongfa_secret: 1,
};

const ARTIFACT_POOL_CAPS: Partial<Record<AffixCategory, number>> = {
  artifact_core: 1,
  artifact_panel: 2,
  artifact_defense: 3,
  artifact_treasure: 1,
};

const PRODUCT_POOL_CAPS: Record<CreationProductType, Partial<Record<AffixCategory, number>>> = {
  skill: SKILL_POOL_CAPS,
  gongfa: GONGFA_POOL_CAPS,
  artifact: ARTIFACT_POOL_CAPS,
};

/**
 * 根据产物类型、槽位上限和候选池内容，解析本次抽词缀应使用的完整约束。
 *
 * 参数含义：
 * - productType：当前造物产物类型，用来决定使用哪套固定池配额。
 * - maxCount：本次流程允许抽取的最大词缀数量（>0 校验用，具体配额由产物类型固定）。
 * - pool：当前词缀候选池，用来按"实际可用候选数"收缩各分类上限。
 *
 * 返回值含义：
 * - categoryCaps：当前轮抽取时，各分类最多还能拿多少个（已按候选数量收缩）。
 * - bucketCaps：高阶稀有池总量上限（固定为 1）。
 */
export function resolveAffixSelectionConstraints(
  productType: CreationProductType,
  maxCount: number,
  pool: AffixCandidate[],
): AffixSelectionConstraints {
  if (maxCount <= 0) {
    return {
      categoryCaps: createEmptyCategoryCaps(),
      bucketCaps: { highTierTotal: 0 },
    };
  }

  const caps = PRODUCT_POOL_CAPS[productType] ?? {};
  const categoryAvailable = countByCategory(pool);

  const categoryCaps: Partial<Record<AffixCategory, number>> = {};
  for (const [cat, cap] of Object.entries(caps) as [AffixCategory, number][]) {
    categoryCaps[cat] = Math.min(cap, categoryAvailable[cat] ?? 0);
  }

  return {
    categoryCaps,
    bucketCaps: { highTierTotal: 1 },
  };
}

/** 生成一份全 0 的分类上限，用于"完全不允许抽取任何词缀"的场景。 */
function createEmptyCategoryCaps(): Partial<Record<AffixCategory, number>> {
  return {};
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

// Re-export defaultMaxAffixCount for external consumers
export { CREATION_PROJECTION_BALANCE };


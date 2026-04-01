import { QUALITY_ORDER } from '@/types/constants';
import { CreationSession } from '../CreationSession';
import { AffixCandidate } from '../types';
import { AffixDefinition } from './types';
import { AffixRegistry } from './AffixRegistry';

/**
 * 词缀候选池构建器
 * 根据 session 当前状态（tags、品质上限、解锁类别、产物类型）
 * 从 AffixRegistry 查询并生成 AffixCandidate[]
 */
export class AffixPoolBuilder {
  build(registry: AffixRegistry, session: CreationSession): AffixCandidate[] {
    const { tags, materialFingerprints, recipeMatch, input } = session.state;
    if (!recipeMatch) return [];

    // 取所有材料中最高品质的 qualityOrder
    const maxQualityOrder = materialFingerprints.reduce(
      (max, fp) => Math.max(max, QUALITY_ORDER[fp.rank]),
      0,
    );

    const matching = registry.queryByTags(
      tags,
      recipeMatch.unlockedAffixCategories,
      input.productType,
    );

    return matching
      .filter((def) => {
        if (
          def.minQuality !== undefined &&
          maxQualityOrder < QUALITY_ORDER[def.minQuality]
        ) {
          return false;
        }
        return true;
      })
      .map((def) => this.toCandidate(def));
  }

  private toCandidate(def: AffixDefinition): AffixCandidate {
    return {
      id: def.id,
      name: def.displayName,
      category: def.category,
      tags: def.tagQuery,
      weight: def.weight,
      energyCost: def.energyCost,
      exclusiveGroup: def.exclusiveGroup,
      minQuality: def.minQuality,
    };
  }
}

import { AffixCategory, CreationProductType } from '../types';
import { AffixDefinition } from './types';
import { CREATION_AFFIX_POOL_SCORING } from '../config/CreationBalance';

/**
 * 词缀注册表
 * 存储所有 AffixDefinition，并支持按 tag / 类别 / 产物类型查询
 */
export class AffixRegistry {
  private defs: AffixDefinition[] = [];

  register(defs: AffixDefinition[]): void {
    this.defs.push(...defs);
  }

  /**
   * 按 tags + 解锁类别 + 产物类型查询
   * 普通词缀（prefix/suffix）：OR 语义，命中任意 1 个标签即可入池
   * 高阶词缀（resonance+）：至少需要命中 minTagHitsByCategory 数量的标签才可入池
   */
  queryByTags(
    tags: string[],
    unlockedCategories: AffixCategory[],
    productType?: CreationProductType,
  ): AffixDefinition[] {
    const categorySet = new Set<AffixCategory>(unlockedCategories);
    const tagSet = new Set(tags);
    const minHits = CREATION_AFFIX_POOL_SCORING.minTagHitsByCategory;

    return this.defs.filter((def) => {
      if (!categorySet.has(def.category)) return false;
      if (productType && !def.applicableTo.includes(productType)) return false;
      const hitCount = def.tagQuery.filter((t) => tagSet.has(t)).length;
      const required = (minHits as Record<string, number>)[def.category] ?? 1;
      return hitCount >= required;
    });
  }

  queryById(id: string): AffixDefinition | undefined {
    return this.defs.find((d) => d.id === id);
  }

  getAll(): AffixDefinition[] {
    return [...this.defs];
  }
}

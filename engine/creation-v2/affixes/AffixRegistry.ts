import { AffixCategory, CreationProductType } from '../types';
import { AffixDefinition } from './types';

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
   * tagQuery 采用 OR 语义：session.tags 中命中 def.tagQuery 中任意一条即可
   */
  queryByTags(
    tags: string[],
    unlockedCategories: AffixCategory[],
    productType?: CreationProductType,
  ): AffixDefinition[] {
    const categorySet = new Set<AffixCategory>(unlockedCategories);
    const tagSet = new Set(tags);

    return this.defs.filter((def) => {
      if (!categorySet.has(def.category)) return false;
      if (productType && !def.applicableTo.includes(productType)) return false;
      return def.tagQuery.some((t) => tagSet.has(t));
    });
  }

  queryById(id: string): AffixDefinition | undefined {
    return this.defs.find((d) => d.id === id);
  }

  getAll(): AffixDefinition[] {
    return [...this.defs];
  }
}

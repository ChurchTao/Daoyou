import { db } from '../../../lib/drizzle/db';
import { abilityTemplates } from '../../../lib/drizzle/schema';
import { eq } from 'drizzle-orm';
import { AbilityFactory } from '../factories/AbilityFactory';
import { Ability } from '../abilities/Ability';

/**
 * 技能数据加载器
 * 
 * 职责：
 * - 封装 Drizzle 查询逻辑
 * - 从数据库获取技能模板配置
 * - 利用 AbilityFactory 实例化技能
 */
export class AbilityDataLoader {
  /**
   * 根据 Slug 加载单个技能模板
   * @param slug 技能唯一标识符
   */
  static async loadBySlug(slug: string): Promise<Ability | null> {
    const database = db();
    
    // 1. 从数据库获取配置
    const result = await database.query.abilityTemplates.findFirst({
      where: eq(abilityTemplates.slug, slug),
    });

    if (!result) {
      console.warn(`Ability template not found for slug: ${slug}`);
      return null;
    }

    // 2. 将结果中的 config 部分交给工厂实例化
    // 注入 slug 作为 ID 保证唯一性或可追踪性
    const config = {
      ...(result.config as any),
      id: result.slug,
      name: result.name,
      description: result.description,
    };

    return AbilityFactory.create(config);
  }

  /**
   * 批量加载技能模板
   * @param slugs Slug 数组
   */
  static async loadManyBySlugs(slugs: string[]): Promise<Ability[]> {
    const abilities: Ability[] = [];
    
    for (const slug of slugs) {
      const ability = await this.loadBySlug(slug);
      if (ability) {
        abilities.push(ability);
      }
    }
    
    return abilities;
  }

  /**
   * 加载指定单位的所有技能配置
   * (这里演示了如何将这种设计应用到具体角色身上)
   */
  static async loadForCultivator(cultivatorId: string): Promise<Ability[]> {
    // 实际业务中，可能需要关联查询 cultivators -> skills
    // 这里暂时提供一个概念占位
    return [];
  }
}

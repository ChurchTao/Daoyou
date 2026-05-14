import { eq } from 'drizzle-orm';
import { db } from '@server/lib/drizzle/db';
import { creationProducts } from '@server/lib/drizzle/schema';
import { deserializeAbilityConfig } from '../../creation-v2/persistence/ProductPersistenceMapper';
import { Ability } from '../abilities/Ability';
import { AbilityFactory } from '../factories/AbilityFactory';

/**
 * 技能数据加载器（v2）
 *
 * 从 creation_products 表加载指定角色的所有战斗用能力：
 * - 全部神通（skill）
 * - 全部功法（gongfa）
 * - 已装备法宝（artifact, is_equipped=true）
 *
 * 旧版基于 abilityTemplates 表的按 slug 加载接口已随 creation 引擎下线。
 */
export class AbilityDataLoader {
  static async loadForCultivatorV2(cultivatorId: string): Promise<Ability[]> {
    const database = db();

    const rows = await database
      .select()
      .from(creationProducts)
      .where(eq(creationProducts.cultivatorId, cultivatorId));

    const abilities: Ability[] = [];

    for (const row of rows) {
      if (row.productType === 'artifact' && !row.isEquipped) continue;

      try {
        const config = deserializeAbilityConfig(
          row.abilityConfig as Record<string, unknown>,
          row.id,
        );
        const ability = AbilityFactory.create(config);
        abilities.push(ability);
      } catch (err) {
        console.warn(
          `[AbilityDataLoader] Failed to load ability for product ${row.id}:`,
          err,
        );
      }
    }

    return abilities;
  }
}

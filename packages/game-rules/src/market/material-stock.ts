import { MARKET_MATERIAL_STACK_RANGES } from '@daoyou/game-content/market';
import type { Material } from '@daoyou/game-domain/character';

export function marketMaterialStackRange(
  material: Pick<Material, 'type' | 'rank'>,
): { min: number; max: number } {
  switch (material.type) {
    case 'herb':
    case 'ore':
    case 'monster':
    case 'aux':
    case 'tcdb':
      return MARKET_MATERIAL_STACK_RANGES[material.rank];
    default:
      return { min: 1, max: 1 };
  }
}

/** 单价转换为整叠售价；只在生成新货架时抽取数量。 */
export function rollMarketMaterialStock(
  material: Pick<Material, 'type' | 'rank'> & { price: number },
  random: () => number = Math.random,
): { quantity: number; price: number } {
  const { min, max } = marketMaterialStackRange(material);
  const quantity = min + Math.floor(random() * (max - min + 1));
  const price = material.price * quantity;
  if (
    !Number.isSafeInteger(material.price) ||
    material.price < 1 ||
    !Number.isSafeInteger(price) ||
    price < 1
  )
    throw new RangeError('坊市材料售价无效');
  return { quantity, price };
}

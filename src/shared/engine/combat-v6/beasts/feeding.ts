import type { ConsumableSpec } from '@shared/types/consumable';
import { gainBeastExp, nextBeastExp } from './progression';
import type { SummonedBeast } from './schema';

/** 消耗品中保存的是已结算品相和契合倍率的收益，喂养时不再乘算。 */
export function beastFoodCultivation(spec: ConsumableSpec): number {
  if (spec.kind !== 'pill' && spec.kind !== 'spirit_fruit') return 0;
  if (!Array.isArray(spec.operations) || spec.operations.length !== 1) return 0;
  const operation = spec.operations[0];
  if (operation?.type !== 'gain_beast_cultivation') return 0;
  return Number.isSafeInteger(operation.value) &&
    operation.value > 0 &&
    operation.value <= 112125
    ? operation.value
    : 0;
}

export function previewBeastFeeding(
  beast: SummonedBeast,
  spec: ConsumableSpec,
  quantity: number,
  ownerLevel: number,
) {
  const perItem = beastFoodCultivation(spec);
  if (!perItem) throw new Error('此物品不能用于增加灵兽修为');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
    throw new Error('喂养数量无效');
  if (!Number.isInteger(ownerLevel) || ownerLevel < 0)
    throw new Error('人物等级无效');
  const cap = Math.min(180, ownerLevel);
  if (beast.level >= cap) throw new Error('灵兽已达当前等级上限');
  let remaining = -beast.exp;
  for (let level = beast.level; level < cap; level++)
    remaining += nextBeastExp(level);
  const maxQuantity = Math.ceil(remaining / perItem);
  if (quantity > maxQuantity)
    throw new Error(`达到当前等级上限最多需要${maxQuantity}颗`);
  const amount = perItem * quantity;
  return {
    beast: gainBeastExp(beast, amount, ownerLevel),
    gained: Math.min(remaining, amount),
    wasted: Math.max(0, amount - remaining),
    maxQuantity,
  };
}

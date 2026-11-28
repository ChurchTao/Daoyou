import type { SummonedBeast } from '@daoyou/game-domain/beasts';
import type { ConsumableSpec } from '@daoyou/game-domain/consumables';
import { gainBeastExp, nextBeastExp } from './progression.js';
import { beastVitals } from './projection.js';
import { BeastSchema } from './schema.js';

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
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
    throw new Error('喂养数量无效');

  const cultivation = beastFoodCultivation(spec);
  if (cultivation) {
    if (!Number.isInteger(ownerLevel) || ownerLevel < 0)
      throw new Error('人物等级无效');
    const cap = Math.min(180, ownerLevel);
    if (beast.level >= cap) throw new Error('灵兽已达当前等级上限');
    let remaining = -beast.exp;
    for (let level = beast.level; level < cap; level++)
      remaining += nextBeastExp(level);
    const maxQuantity = Math.ceil(remaining / cultivation);
    if (quantity > maxQuantity)
      throw new Error(`达到当前等级上限最多需要${maxQuantity}颗`);
    const amount = cultivation * quantity;
    return {
      beast: gainBeastExp(beast, amount, ownerLevel),
      gained: Math.min(remaining, amount),
      wasted: Math.max(0, amount - remaining),
      lifespanGained: 0,
      hpRestored: 0,
      mpRestored: 0,
      maxQuantity,
    };
  }

  if (spec.kind !== 'pill' && spec.kind !== 'spirit_fruit')
    throw new Error('此物品不能用于喂养灵兽');

  const { hp, mp, maxHp, maxMp } = beastVitals(beast);
  const maximum = { hp: maxHp, mp: maxMp };
  const restorePerItem = { hp: 0, mp: 0 };
  let lifespanPerItem = 0;
  let hasRecovery = false;
  for (const operation of spec.operations) {
    // Apply only the effects supported by the selected beast.
    if (operation.type === 'increase_lifespan' && operation.value > 0) {
      lifespanPerItem += Math.max(1, Math.floor(operation.value));
    } else if (operation.type === 'restore_resource' && operation.value > 0) {
      hasRecovery = true;
      const amount =
        operation.mode === 'percent'
          ? maximum[operation.resource] * operation.value
          : operation.value;
      restorePerItem[operation.resource] += Math.floor(amount);
    }
  }

  const missingHp = maxHp - hp;
  const missingMp = maxMp - mp;
  const maxQuantity =
    lifespanPerItem > 0
      ? 99
      : Math.max(
          restorePerItem.hp > 0 ? Math.ceil(missingHp / restorePerItem.hp) : 0,
          restorePerItem.mp > 0 ? Math.ceil(missingMp / restorePerItem.mp) : 0,
        );
  if (!maxQuantity)
    throw new Error(
      hasRecovery
        ? '此药果当前无法恢复灵兽气血或法力'
        : '此物品不能用于喂养灵兽',
    );
  if (quantity > maxQuantity)
    throw new Error(`回满此药果可恢复的气血或法力最多需要${maxQuantity}颗`);

  const lifespanGained = lifespanPerItem * quantity;
  const currentLifespan = beast.currentLifespan + lifespanGained;
  if (!Number.isSafeInteger(currentLifespan))
    throw new Error('喂养后的灵兽寿元超出可记录范围');
  const hpRestored = Math.min(missingHp, restorePerItem.hp * quantity);
  const mpRestored = Math.min(missingMp, restorePerItem.mp * quantity);
  return {
    beast: BeastSchema.parse({
      ...beast,
      currentLifespan,
      ...(hpRestored || mpRestored
        ? { vitals: { hp: hp + hpRestored, mp: mp + mpRestored } }
        : {}),
      revision: beast.revision + 1,
    }),
    gained: 0,
    wasted: 0,
    lifespanGained,
    hpRestored,
    mpRestored,
    maxQuantity,
  };
}

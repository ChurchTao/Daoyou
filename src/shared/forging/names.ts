import { SeededRng } from '../engine/combat-v6/core';
import type { DaoEquipmentSlot } from '../engine/combat-v6/equipment/types';
// One explicit naming tier per equipment level. Cosmetic draws never affect equipment RNG.
const tiers = [
  '青石',
  '赤铜',
  '寒铁',
  '流云',
  '碧霄',
  '紫电',
  '玄霜',
  '星河',
  '龙吟',
  '太虚',
  '苍穹',
  '九曜',
  '乾坤',
  '天枢',
  '无极',
  '鸿蒙',
  '造化',
  '混元',
];
const forms: Record<DaoEquipmentSlot, readonly string[]> = {
  weapon: ['剑', '戟', '刀'],
  head: ['冠', '盔', '巾'],
  armor: ['甲', '法衣', '袍'],
  necklace: ['佩', '珠', '坠'],
  belt: ['带', '腰封', '束'],
  footwear: ['履', '靴', '踏云履'],
};
export function isForgedName(
  slot: DaoEquipmentSlot,
  level: number,
  name: string,
) {
  const tier = tiers[level / 10 - 1];
  if (!tier) return false;
  return forms[slot]?.some((form) => `${tier}${form}` === name) ?? false;
}
export function forgedName(
  slot: DaoEquipmentSlot,
  level: number,
  seed: number,
) {
  const pool = forms[slot];
  return (
    tiers[level / 10 - 1] +
    pool[
      Math.floor(new SeededRng((seed ^ 0xc2b2ae35) >>> 0).next() * pool.length)
    ]
  );
}

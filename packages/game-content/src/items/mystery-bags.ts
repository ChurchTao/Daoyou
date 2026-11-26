import {
  MYSTERY_BAG_IDS,
  type ItemDefinition,
  type MysteryBagId,
} from '@daoyou/game-domain/inventory';

export { default as MYSTERY_BAG_REWARD_DATA } from './data/mystery-bags.json' with { type: 'json' };

const tiers = {
  'mystery-bag.common': { grade: '普通', price: 500_000, color: '凡品' },
  'mystery-bag.fine': { grade: '精致', price: 1_000_000, color: '地品' },
  'mystery-bag.luxurious': { grade: '华贵', price: 3_000_000, color: '神品' },
} as const satisfies Record<
  MysteryBagId,
  { grade: string; price: number; color: string }
>;

export const MYSTERY_BAGS = MYSTERY_BAG_IDS.map(
  (id) =>
    ({
      id,
      ...tiers[id],
      name: `${tiers[id].grade}神秘储物袋`,
      kind: 'mystery_bag',
      stackLimit: 99,
    }) as const satisfies ItemDefinition,
);

export function findMysteryBag(id: string) {
  return MYSTERY_BAGS.find((bag) => bag.id === id);
}

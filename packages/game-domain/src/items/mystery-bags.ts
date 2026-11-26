export const MYSTERY_BAG_IDS = [
  'mystery-bag.common',
  'mystery-bag.fine',
  'mystery-bag.luxurious',
] as const;

export type MysteryBagId = (typeof MYSTERY_BAG_IDS)[number];

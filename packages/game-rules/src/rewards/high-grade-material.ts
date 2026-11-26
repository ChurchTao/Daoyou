import type { RealmType } from '@daoyou/constants/realms';

export const HIGH_GRADE_MATERIAL_QUALITIES = [
  '地品',
  '天品',
  '仙品',
  '神品',
] as const;
const HIGH_GRADE_MATERIAL_WEIGHTS = {
  炼气: [90, 9, 1, 0],
  筑基: [84, 12, 4, 0],
  金丹: [76, 16, 7, 1],
  元婴: [68, 20, 10, 2],
  化神: [59, 24, 13, 4],
  炼虚: [50, 27, 16, 7],
  合体: [42, 28, 19, 11],
  大乘: [34, 27, 22, 17],
  渡劫: [25, 25, 25, 25],
} satisfies Record<RealmType, readonly [number, number, number, number]>;

export function highGradeMaterialQuality(realm: RealmType, roll: number) {
  let cutoff = 0;
  for (const [index, weight] of HIGH_GRADE_MATERIAL_WEIGHTS[realm].entries()) {
    cutoff += weight;
    if (roll < cutoff) return HIGH_GRADE_MATERIAL_QUALITIES[index];
  }
  throw new Error('高品材料品阶抽签超出范围');
}

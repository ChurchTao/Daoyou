/**
 * 突破修正系数详情
 */
export interface BreakthroughModifiers {
  baseChance: number; // 基础成功率
  realmDifficulty: number; // 境界难度系数
  progressMultiplier: number; // 修为进度系数
  insightMultiplier: number; // 感悟系数
  demonPenalty: number; // 心魔惩罚
  adjustedBaseChance: number; // 乘算修正后的综合基础成功率
  fateBonus: number; // 命格加成
  pillBonus: number; // 破境丹残留加成
  toxicityPenalty: number; // 丹毒惩罚
  finalChance: number; // 最终成功率
}

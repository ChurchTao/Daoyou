import type { BalanceMetrics } from '../balancing/PBU';
import type { AffixRarity, RolledAffix } from '../types';

/**
 * 计算产物评分（排行榜用）。
 * 公式：base(PBU×10) + 完美词缀奖励(每个+50) + 稀有度奖励
 */
const RARITY_SCORE: Record<AffixRarity, number> = {
  common: 0,
  uncommon: 10,
  rare: 30,
  legendary: 60,
};

export function calculateProductScore(
  metrics: BalanceMetrics | undefined,
  affixes: RolledAffix[],
): number {
  const pbuBase = Math.round((metrics?.pbu ?? 0) * 10);

  let perfectBonus = 0;
  let rarityBonus = 0;
  for (const affix of affixes) {
    if (affix.isPerfect) perfectBonus += 50;
    rarityBonus += RARITY_SCORE[affix.rarity] ?? 0;
  }

  return pbuBase + perfectBonus + rarityBonus;
}

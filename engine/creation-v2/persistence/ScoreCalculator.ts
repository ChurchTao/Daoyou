import type { BalanceMetrics } from '../balancing/PBU';
import type { RolledAffix } from '../types';

/**
 * 计算产物评分（排行榜用）。
 * 公式：base(PBU×10) + 完美词缀奖励(每个+50) + 稀有/传奇词缀奖励(+30/+80)
 */
export function calculateProductScore(
  metrics: BalanceMetrics | undefined,
  affixes: RolledAffix[],
): number {
  const pbuBase = Math.round((metrics?.pbu ?? 0) * 10);

  let perfectBonus = 0;
  let rarityBonus = 0;
  for (const affix of affixes) {
    if (affix.isPerfect) perfectBonus += 50;
    // RolledAffix 没有 rarity 字段，但 category 末尾为 _rare / _secret / _treasure 的属于高阶词缀
    if (isHighTierCategory(affix.category)) rarityBonus += 30;
  }

  return pbuBase + perfectBonus + rarityBonus;
}

function isHighTierCategory(category: string): boolean {
  return (
    category.endsWith('_rare') ||
    category.endsWith('_secret') ||
    category.endsWith('_treasure')
  );
}

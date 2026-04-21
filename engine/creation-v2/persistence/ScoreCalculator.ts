import type { Quality } from '@/types/constants';
import type { BalanceMetrics } from '../balancing/PBU';
import type { RolledAffix } from '../types';

/**
 * 从 PBU 推算品质等级。
 * PBU 阈值是启发式的，与造物引擎能量经济对齐：
 *   0-15 → 凡品, 15-30 → 灵品, 30-50 → 玄品, 50-75 → 真品,
 *   75-110 → 地品, 110-160 → 天品, 160-220 → 仙品, 220+ → 神品
 */
const PBU_QUALITY_THRESHOLDS: [number, Quality][] = [
  [220, '神品'],
  [160, '仙品'],
  [110, '天品'],
  [75, '地品'],
  [50, '真品'],
  [30, '玄品'],
  [15, '灵品'],
  [0, '凡品'],
];

export function pbuToQuality(pbu: number): Quality {
  for (const [threshold, quality] of PBU_QUALITY_THRESHOLDS) {
    if (pbu >= threshold) return quality;
  }
  return '凡品';
}

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

/**
 * 从 balanceMetrics 推算展示用品质。
 */
export function deriveQuality(metrics: BalanceMetrics | undefined): Quality {
  return pbuToQuality(metrics?.pbu ?? 0);
}

import type { MarketLayer } from '@shared/types/market';

/** 根据节点配置把货架比例换算为灵种数量；普通坊市未配置时不强制注入。 */
export function getSpiritFieldMarketSeedSlotCount(
  layer: MarketLayer,
  listingCount: number,
  ratios?: Partial<Record<MarketLayer, number>>,
): number {
  if (layer === 'black') return 0;
  const count = Math.max(0, Math.floor(listingCount));
  const ratio = Math.max(0, Math.min(1, ratios?.[layer] ?? 0));
  return Math.min(count, Math.round(count * ratio));
}

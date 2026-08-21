import type { MarketLayer } from '@shared/types/market';

/** 每层固定留给灵种的货架位；黑市不挂（神秘层会丢掉 details）。 */
export const SPIRIT_FIELD_MARKET_SEED_SLOTS: Record<MarketLayer, number> = {
  common: 2,
  treasure: 2,
  heaven: 1,
  black: 0,
};

export function getSpiritFieldMarketSeedSlotCount(layer: MarketLayer): number {
  return SPIRIT_FIELD_MARKET_SEED_SLOTS[layer] ?? 0;
}

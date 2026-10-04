import { BEAST_MARKET_PACK } from '@daoyou/game-content/market/beast-pack';
import type { MarketLayer } from '@daoyou/game-domain/market';

export function sampleBeastMarketStock(
  layer: Exclude<MarketLayer, 'black'>,
  random: () => number = Math.random,
  pack = BEAST_MARKET_PACK,
) {
  const { books, prices, rarityWeights } = pack;
  const stock = pack.stock[layer];
  const rollPrice = (range: { min: number; max: number }) =>
    range.min + Math.floor(random() * (range.max - range.min + 1));
  function pickBooks<
    T extends {
      definitionId: string;
      rarity: (typeof BEAST_MARKET_PACK)['books']['normal'][number]['rarity'];
    },
  >(entries: T[], count: number, priceFor: (entry: T) => number) {
    const remaining = [...entries];
    return Array.from({ length: count }, () => {
      const total = remaining.reduce(
        (sum, entry) => sum + rarityWeights[entry.rarity],
        0,
      );
      let roll = random() * total;
      let index = remaining.findIndex(
        (entry) => (roll -= rarityWeights[entry.rarity]) < 0,
      );
      if (index < 0) index = remaining.length - 1;
      const [entry] = remaining.splice(index, 1);
      return {
        definitionId: entry.definitionId,
        price: priceFor(entry),
      };
    });
  }
  return [
    ...pickBooks(books.normal, stock.normalBooks, () =>
      rollPrice(prices.normalBook),
    ),
    ...pickBooks(books.advanced, stock.advancedBooks, (entry) => {
      const { baseByTier, fluctuation } = prices.advancedBook;
      const factor =
        fluctuation.min + random() * (fluctuation.max - fluctuation.min);
      return Math.min(
        5000000,
        Math.max(500000, Math.round(baseByTier[entry.priceTier - 1] * factor)),
      );
    }),
    ...Array.from({ length: stock.originDew }, () => ({
      definitionId: 'beast.refinement.origin-dew',
      price: prices.originDew,
    })),
    ...Array.from({ length: stock.rejuvenationFruit }, () => ({
      definitionId: 'beast.rejuvenation.huasheng-fruit',
      price: rollPrice(prices.rejuvenationFruit),
    })),
    ...Array.from({ length: stock.superiorOriginDew }, () => ({
      definitionId: 'beast.refinement.superior-origin-dew',
      price: prices.superiorOriginDew,
    })),
  ];
}

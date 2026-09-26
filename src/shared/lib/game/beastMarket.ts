import { BEAST_SKILL_FAMILIES } from '@shared/engine/combat-v6/beasts/content';
import { BOOKS } from '@shared/items/definitions/beast-books';
import { z } from 'zod';
import data from './data/beast-market.json';

const rarity = z.enum(['common', 'uncommon', 'rare']);
const priceTier = z.enum(['low', 'medium', 'high']);
const priceRange = z
  .strictObject({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  })
  .refine((value) => value.min <= value.max);
const packShape = z.strictObject({
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  stock: z.strictObject({
    normalBooks: z.number().int().nonnegative().max(8),
    advancedBooks: z.number().int().nonnegative().max(8),
    originDew: z.number().int().nonnegative().max(8),
    superiorOriginDew: z.number().int().nonnegative().max(8),
  }),
  prices: z.strictObject({
    normalBook: priceRange,
    advancedBook: z.record(priceTier, priceRange),
    originDew: z.number().int().positive(),
    superiorOriginDew: z.number().int().positive(),
  }),
  rarityWeights: z.record(rarity, z.number().positive()),
  books: z.strictObject({
    normal: z.array(z.strictObject({ definitionId: z.string(), rarity })),
    advanced: z.array(
      z.strictObject({ definitionId: z.string(), rarity, priceTier }),
    ),
  }),
});

export function loadBeastMarketPack(input: unknown) {
  const pack = packShape.parse(input);
  const advanced = new Set(
    BEAST_SKILL_FAMILIES.map((family) => `book.${family.advanced}`),
  );
  const registered = new Set(BOOKS.map((book) => book.id));
  const seen = new Set<string>();
  for (const [tier, entries] of Object.entries(pack.books) as [
    'normal' | 'advanced',
    typeof pack.books.normal,
  ][]) {
    for (const entry of entries) {
      if (
        !registered.has(entry.definitionId) ||
        seen.has(entry.definitionId) ||
        advanced.has(entry.definitionId) !== (tier === 'advanced')
      )
        throw new Error(`御灵集灵印配置无效：${entry.definitionId}`);
      seen.add(entry.definitionId);
    }
  }
  if (
    pack.stock.normalBooks > pack.books.normal.length ||
    pack.stock.advancedBooks > pack.books.advanced.length ||
    Object.values(pack.stock).reduce((sum, count) => sum + count, 0) !== 8
  )
    throw new Error('御灵集货架配置无效');
  return pack;
}

export const BEAST_MARKET_PACK = loadBeastMarketPack(data);

export function sampleBeastMarketStock(
  random: () => number = Math.random,
  pack = BEAST_MARKET_PACK,
) {
  const { books, prices, rarityWeights, stock } = pack;
  function pickBooks<
    T extends { definitionId: string; rarity: z.infer<typeof rarity> },
  >(
    entries: T[],
    count: number,
    priceRangeFor: (entry: T) => { min: number; max: number },
  ) {
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
      const range = priceRangeFor(entry);
      return {
        definitionId: entry.definitionId,
        price: range.min + Math.floor(random() * (range.max - range.min + 1)),
      };
    });
  }
  return [
    ...pickBooks(books.normal, stock.normalBooks, () => prices.normalBook),
    ...pickBooks(
      books.advanced,
      stock.advancedBooks,
      (entry) => prices.advancedBook[entry.priceTier],
    ),
    ...Array.from({ length: stock.originDew }, () => ({
      definitionId: 'beast.refinement.origin-dew',
      price: prices.originDew,
    })),
    ...Array.from({ length: stock.superiorOriginDew }, () => ({
      definitionId: 'beast.refinement.superior-origin-dew',
      price: prices.superiorOriginDew,
    })),
  ];
}

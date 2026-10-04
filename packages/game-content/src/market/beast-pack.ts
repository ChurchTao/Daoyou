import { BEAST_SUPERIOR_BOOK_SKILL_IDS } from '../beasts/content.js';

import { BOOKS } from '../items/beast-books.js';

import { z } from 'zod';

import data from './data/beast-market.json' with { type: 'json' };

const rarity = z.enum(['common', 'uncommon', 'rare']);

const priceTier = z.number().int().min(1).max(10);

const stockShape = z.strictObject({
  normalBooks: z.number().int().nonnegative().max(8),
  advancedBooks: z.number().int().nonnegative().max(8),
  originDew: z.number().int().nonnegative().max(8),
  rejuvenationFruit: z.number().int().nonnegative().max(8),
  superiorOriginDew: z.number().int().nonnegative().max(8),
});

const priceRange = z
  .strictObject({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  })
  .refine((value) => value.min <= value.max);

const packShape = z.strictObject({
  formatVersion: z.literal(2),
  contentRevision: z.number().int().positive(),
  stock: z.strictObject({
    common: stockShape,
    treasure: stockShape,
    heaven: stockShape,
  }),
  prices: z.strictObject({
    normalBook: priceRange,
    advancedBook: z.strictObject({
      baseByTier: z
        .array(z.number().int().min(500000).max(5000000))
        .length(10)
        .refine((prices) =>
          prices.every(
            (price, index) => index === 0 || price > prices[index - 1],
          ),
        ),
      fluctuation: z
        .strictObject({
          min: z.number().positive(),
          max: z.number().positive(),
        })
        .refine((value) => value.min < value.max),
    }),
    originDew: z.number().int().positive(),
    rejuvenationFruit: priceRange,
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
    [...BEAST_SUPERIOR_BOOK_SKILL_IDS].map((id) => `book.${id}`),
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
  for (const stock of Object.values(pack.stock)) {
    if (
      stock.normalBooks > pack.books.normal.length ||
      stock.advancedBooks > pack.books.advanced.length ||
      Object.values(stock).reduce((sum, count) => sum + count, 0) !== 8
    )
      throw new Error('御灵集货架配置无效');
  }
  return pack;
}

export const BEAST_MARKET_PACK = loadBeastMarketPack(data);

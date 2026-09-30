import { describe, expect, it } from 'vitest';
import { BEAST_SUPERIOR_BOOK_SKILL_IDS } from '@shared/engine/combat-v6/beasts/content';
import {
  BEAST_MARKET_PACK,
  loadBeastMarketPack,
  sampleBeastMarketStock,
} from './beastMarket';

describe('御灵集货架', () => {
  it('四种群体灵法进入上品货池', () => {
    for (const id of [
      'beast.thunderstorm',
      'beast.mountain-crush',
      'beast.flood',
      'beast.wildfire',
    ]) {
      expect(BEAST_SUPERIOR_BOOK_SKILL_IDS.has(id)).toBe(true);
      expect(
        BEAST_MARKET_PACK.books.advanced.some(
          (book) => book.definitionId === `book.${id}`,
        ),
      ).toBe(true);
    }
  });
  it.each([
    ['common', 4, 1, 2, 0, 1],
    ['treasure', 3, 1, 3, 0, 1],
    ['heaven', 2, 2, 1, 1, 2],
  ] as const)(
    '%s 每批按层级生成八件货品',
    (layer, normal, advanced, dew, fruit, superiorDew) => {
      const stock = sampleBeastMarketStock(layer, () => 0);
      const books = stock.filter((item) =>
        item.definitionId.startsWith('book.'),
      );
      expect(stock).toHaveLength(8);
      expect(
        stock.filter(
          (item) => item.definitionId === 'beast.rejuvenation.huasheng-fruit',
        ),
      ).toHaveLength(fruit);
      expect(new Set(books.map((item) => item.definitionId)).size).toBe(
        normal + advanced,
      );
      expect(stock.filter((item) => item.price === 300000)).toHaveLength(
        normal,
      );
      expect(
        stock.filter((item) =>
          BEAST_SUPERIOR_BOOK_SKILL_IDS.has(
            item.definitionId.replace(/^book\./, ''),
          ),
        ),
      ).toHaveLength(advanced);
      expect(
        stock.filter(
          (item) => item.definitionId === 'beast.refinement.origin-dew',
        ),
      ).toHaveLength(dew);
      expect(
        stock.filter(
          (item) =>
            item.definitionId === 'beast.refinement.superior-origin-dew',
        ),
      ).toHaveLength(superiorDew);
      for (const item of stock.filter(
        (item) => item.definitionId === 'beast.rejuvenation.huasheng-fruit',
      ))
        expect(item.price).toBeGreaterThanOrEqual(1700000);
    },
  );

  it('上品灵印有十档实用性定价，刷新波动不超出 50–500 万', () => {
    const priceOf = (definitionId: string, random: () => number) => {
      const pack = structuredClone(BEAST_MARKET_PACK);
      const entry = pack.books.advanced.find(
        (book) => book.definitionId === definitionId,
      )!;
      pack.books.advanced = [entry];
      return sampleBeastMarketStock('common', random, pack).find(
        (item) => item.definitionId === definitionId,
      )!.price;
    };
    const sneak = 'book.beast.advanced-sneak-attack';
    const concentration = 'book.beast.advanced-concentration';
    expect(
      BEAST_MARKET_PACK.books.advanced.find(
        (book) => book.definitionId === sneak,
      )?.rarity,
    ).toBe(
      BEAST_MARKET_PACK.books.advanced.find(
        (book) => book.definitionId === concentration,
      )?.rarity,
    );
    expect(
      new Set(BEAST_MARKET_PACK.books.advanced.map((book) => book.priceTier)),
    ).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(priceOf(sneak, () => 0)).toBe(4750000);
    expect(priceOf(sneak, () => 0.999999)).toBe(5000000);
    expect(priceOf(concentration, () => 0)).toBe(500000);
    expect(priceOf(concentration, () => 0.999999)).toBe(525000);
  });

  it('拒绝把普通灵印配置到上品货池', () => {
    const invalid = structuredClone(BEAST_MARKET_PACK);
    invalid.books.advanced[0].definitionId =
      invalid.books.normal[0].definitionId;
    expect(() => loadBeastMarketPack(invalid)).toThrow('灵印配置无效');
  });

  it('拒绝超出十档的售价和失衡的分层货位', () => {
    const invalidPrice = structuredClone(BEAST_MARKET_PACK);
    invalidPrice.books.advanced[0].priceTier = 11;
    expect(() => loadBeastMarketPack(invalidPrice)).toThrow();

    const invalidStock = structuredClone(BEAST_MARKET_PACK);
    invalidStock.stock.heaven.advancedBooks = 3;
    expect(() => loadBeastMarketPack(invalidStock)).toThrow('货架配置无效');
  });
});

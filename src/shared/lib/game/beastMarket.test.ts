import { describe, expect, it } from 'vitest';
import {
  BEAST_MARKET_PACK,
  loadBeastMarketPack,
  sampleBeastMarketStock,
} from './beastMarket';

describe('御灵集货架', () => {
  it('每批只生成注册灵印和灵露，上品价格落在所选技能档位', () => {
    const stock = sampleBeastMarketStock(() => 0);
    expect(stock).toHaveLength(8);
    expect(
      stock.filter((item) => item.definitionId.startsWith('book.')),
    ).toHaveLength(5);
    expect(
      new Set(
        stock
          .filter((item) => item.definitionId.startsWith('book.'))
          .map((item) => item.definitionId),
      ).size,
    ).toBe(5);
    expect(stock.filter((item) => item.price === 300000)).toHaveLength(4);
    expect(stock.filter((item) => item.price === 3500000)).toHaveLength(1);
    expect(stock.filter((item) => item.price === 60000)).toHaveLength(2);
    expect(stock.filter((item) => item.price === 360000)).toHaveLength(1);
  });

  it('高级偷袭比高级定神贵，价格与两者相同的稀有度无关', () => {
    const priceOf = (definitionId: string, random: () => number) => {
      const pack = structuredClone(BEAST_MARKET_PACK);
      const entry = pack.books.advanced.find(
        (book) => book.definitionId === definitionId,
      )!;
      pack.books.advanced = [entry];
      return sampleBeastMarketStock(random, pack).find(
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
    expect(priceOf(sneak, () => 0)).toBe(3500000);
    expect(priceOf(concentration, () => 0)).toBe(1000000);
    expect(priceOf(sneak, () => 0.999999)).toBeGreaterThan(3500000);
    expect(priceOf(concentration, () => 0.999999)).toBeLessThanOrEqual(2000000);
  });

  it('拒绝把普通灵印配置到上品货池', () => {
    const invalid = structuredClone(BEAST_MARKET_PACK);
    invalid.books.advanced[0].definitionId =
      invalid.books.normal[0].definitionId;
    expect(() => loadBeastMarketPack(invalid)).toThrow('灵印配置无效');
  });
});

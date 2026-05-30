import {
  RewardCatalogResolveError,
  parseRewardCatalog,
  resolveRewardSelections,
} from './rewardCatalog';

describe('reward catalog helpers', () => {
  const materialCatalogItem = {
    id: 'refined_iron',
    type: 'material' as const,
    data: {
      name: '精炼玄铁',
      type: 'ore' as const,
      rank: '玄品' as const,
      element: '金' as const,
      description: '常用于锻造法宝。',
    },
  };

  it('parses a valid reward catalog', () => {
    const catalog = parseRewardCatalog([materialCatalogItem]);

    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.id).toBe('refined_iron');
  });

  it('rejects duplicate reward catalog ids', () => {
    expect(() =>
      parseRewardCatalog([materialCatalogItem, materialCatalogItem]),
    ).toThrow('目录项 ID 重复');
  });

  it('resolves spirit stones and catalog items into attachments', () => {
    const attachments = resolveRewardSelections(
      [
        { type: 'spirit_stones', quantity: 1200 },
        { type: 'catalog_item', itemId: 'refined_iron', quantity: 3 },
      ],
      [materialCatalogItem],
    );

    expect(attachments).toEqual([
      {
        type: 'spirit_stones',
        name: '灵石',
        quantity: 1200,
      },
      {
        type: 'material',
        name: '精炼玄铁',
        quantity: 3,
        data: {
          name: '精炼玄铁',
          type: 'ore',
          rank: '玄品',
          element: '金',
          description: '常用于锻造法宝。',
          quantity: 3,
        },
      },
    ]);
  });

  it('throws when a selected catalog item does not exist', () => {
    expect(() =>
      resolveRewardSelections(
        [{ type: 'catalog_item', itemId: 'missing', quantity: 1 }],
        [materialCatalogItem],
      ),
    ).toThrow(RewardCatalogResolveError);
  });
});

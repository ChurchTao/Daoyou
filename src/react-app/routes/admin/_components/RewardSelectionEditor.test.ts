import {
  createCatalogItemDraft,
  createSpiritStoneDraft,
  parseRewardSelectionDrafts,
} from './RewardSelectionEditor.helpers';

describe('reward selection editor helpers', () => {
  it('parses mixed reward drafts into API payloads', () => {
    expect(
      parseRewardSelectionDrafts([
        createSpiritStoneDraft(),
        createCatalogItemDraft('refined_iron'),
      ]),
    ).toEqual([
      {
        type: 'spirit_stones',
        quantity: 1,
      },
      {
        type: 'item_library',
        itemId: 'refined_iron',
        quantity: 1,
      },
    ]);
  });

  it('allows empty rewards only when explicitly configured', () => {
    expect(parseRewardSelectionDrafts([], { allowEmpty: true })).toEqual([]);
    expect(() => parseRewardSelectionDrafts([])).toThrow('至少选择一项奖励');
  });
});

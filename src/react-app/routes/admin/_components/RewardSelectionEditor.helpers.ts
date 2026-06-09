export type RewardSelectionDraft =
  | {
      type: 'spirit_stones';
      quantity: string;
    }
  | {
      type: 'item_library';
      itemId: string;
      quantity: string;
    };

export function createSpiritStoneDraft(): RewardSelectionDraft {
  return {
    type: 'spirit_stones',
    quantity: '1',
  };
}

export function createCatalogItemDraft(itemId = ''): RewardSelectionDraft {
  return {
    type: 'item_library',
    itemId,
    quantity: '1',
  };
}

export function parseRewardSelectionDrafts(
  drafts: RewardSelectionDraft[],
  options?: {
    allowEmpty?: boolean;
  },
) {
  if (drafts.length === 0) {
    if (options?.allowEmpty) {
      return [];
    }
    throw new Error('至少选择一项奖励');
  }

  return drafts.map((draft, index) => {
    const quantity = Number(draft.quantity.trim());
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`第 ${index + 1} 项奖励数量必须是大于 0 的整数`);
    }

    if (draft.type === 'spirit_stones') {
      return {
        type: 'spirit_stones' as const,
        quantity,
      };
    }

    if (!draft.itemId) {
      throw new Error(`第 ${index + 1} 项奖励未选择道具库道具`);
    }

    return {
      type: 'item_library' as const,
      itemId: draft.itemId,
      quantity,
    };
  });
}

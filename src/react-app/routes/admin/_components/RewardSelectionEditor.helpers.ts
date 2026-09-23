import { RewardSelectionsSchema } from '@shared/contracts/adminRewards';
import type { ItemGrant } from '@shared/inventory';

export type RewardSelectionDraft =
  | { type: 'spirit_stones' | 'reputation'; quantity: string }
  | { type: 'inventory_v1'; inventory: ItemGrant; quantity: string };
export const createSpiritStoneDraft = (): RewardSelectionDraft => ({
  type: 'spirit_stones',
  quantity: '1',
});
export const createReputationDraft = (): RewardSelectionDraft => ({
  type: 'reputation',
  quantity: '1',
});
export function parseRewardSelectionDrafts(
  drafts: RewardSelectionDraft[],
  options?: { allowEmpty?: boolean },
) {
  if (!drafts.length && !options?.allowEmpty)
    throw new Error('至少选择一项奖励');
  for (const draft of drafts) {
    const quantity = Number(draft.quantity);
    const max = draft.type === 'inventory_v1' ? (draft.inventory.definitionId === 'equipment.v6' ? 1 : 99) : 100000000;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) throw new Error(`奖励数量必须为 1 至 ${max} 的整数`);
  }
  return RewardSelectionsSchema.parse(
    drafts.map((d) =>
      d.type === 'inventory_v1'
        ? {
            type: d.type,
            inventory: { ...d.inventory, quantity: Number(d.quantity) },
          }
        : { type: d.type, quantity: Number(d.quantity) },
    ),
  );
}

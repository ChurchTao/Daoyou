import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkButton, InkInput, InkNotice } from '@app/components/ui';
import { rewardDisplayItem } from '@shared/contracts/adminRewards';
import { RewardItemPicker } from './RewardItemPicker';
import {
  createReputationDraft,
  createSpiritStoneDraft,
  type RewardSelectionDraft,
} from './RewardSelectionEditor.helpers';

export function RewardSelectionEditor({
  value,
  onChange,
  disabled = false,
  allowEmpty = false,
}: {
  value: RewardSelectionDraft[];
  onChange: (value: RewardSelectionDraft[]) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <InkButton
          type="button"
          disabled={disabled}
          onClick={() => onChange([...value, createSpiritStoneDraft()])}
        >
          添加灵石
        </InkButton>
        <InkButton
          type="button"
          disabled={disabled}
          onClick={() => onChange([...value, createReputationDraft()])}
        >
          添加声望
        </InkButton>
        <RewardItemPicker
          disabled={disabled}
          label="添加道具"
          onSelect={(inventory) =>
            onChange([
              ...value,
              { type: 'inventory_v1', inventory, quantity: '1' },
            ])
          }
        />
      </div>
      {!value.length && (
        <InkNotice>
          {allowEmpty
            ? '未设置奖励，将发送为公告邮件。'
            : '请至少添加一项奖励。'}
        </InkNotice>
      )}
      {value.map((draft, index) => (
        <div
          key={index}
          className="border-ink/10 flex flex-wrap items-center gap-4 border-b py-3"
        >
          {draft.type === 'inventory_v1' ? (
            <div className="w-24">
              <ItemSlot
                item={rewardDisplayItem({
                  ...draft.inventory,
                  quantity: Number(draft.quantity) || 1,
                })}
                quantityLabel="奖励"
              />
            </div>
          ) : (
            <span>{draft.type === 'reputation' ? '声望' : '灵石'}</span>
          )}
          <InkInput
            label={`奖励数量 ${index + 1}`}
            value={draft.quantity}
            disabled={
              disabled ||
              (draft.type === 'inventory_v1' &&
                draft.inventory.definitionId === 'equipment.v6')
            }
            onChange={(quantity) =>
              onChange(
                value.map((v, i) => (i === index ? { ...v, quantity } : v)),
              )
            }
          />
          <InkButton
            type="button"
            disabled={disabled}
            variant="secondary"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            删除
          </InkButton>
        </div>
      ))}
    </div>
  );
}

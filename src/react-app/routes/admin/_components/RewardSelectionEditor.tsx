import {
  InventoryGrid,
  ItemSlot,
} from '@app/components/feature/items/ItemSlot';
import { InkButton, InkInput } from '@app/components/ui';
import { rewardDisplayItem } from '@shared/contracts/adminRewards';
import { RewardItemPicker } from './RewardItemPicker';
import {
  createReputationDraft,
  createSpiritStoneDraft,
  type RewardSelectionDraft,
} from './RewardSelectionEditor.helpers';

export function RewardSelectionPreview({
  value,
}: {
  value: RewardSelectionDraft[];
}) {
  return (
    <div className="space-y-3">
      {value.some((draft) => draft.type === 'inventory_v1') && (
        <InventoryGrid className="grid-cols-3 sm:grid-cols-6">
          {value.map(
            (draft, index) =>
              draft.type === 'inventory_v1' && (
                <ItemSlot
                  key={index}
                  item={rewardDisplayItem({
                    ...draft.inventory,
                    quantity: Number(draft.quantity) || 1,
                  })}
                  quantityLabel="奖励"
                />
              ),
          )}
        </InventoryGrid>
      )}
      {value
        .filter((draft) => draft.type !== 'inventory_v1')
        .map((draft, index) => (
          <p key={index} className="text-sm">
            {draft.type === 'reputation' ? '声望' : '灵石'}{' '}
            <span className="font-mono">×{draft.quantity}</span>
          </p>
        ))}
      {!value.length && <p className="text-ink-secondary text-sm">无附件</p>}
    </div>
  );
}

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
  const update = (index: number, quantity: string) =>
    onChange(value.map((v, i) => (i === index ? { ...v, quantity } : v)));
  const remove = (index: number) =>
    onChange(value.filter((_, i) => i !== index));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RewardItemPicker
          disabled={disabled || value.length >= 30}
          label="添加道具"
          onSelect={(inventory) =>
            onChange([
              ...value,
              { type: 'inventory_v1', inventory, quantity: '1' },
            ])
          }
        />
        <InkButton
          disabled={
            disabled ||
            value.length >= 30 ||
            value.some((v) => v.type === 'spirit_stones')
          }
          onClick={() => onChange([...value, createSpiritStoneDraft()])}
        >
          添加灵石
        </InkButton>
        <InkButton
          disabled={
            disabled ||
            value.length >= 30 ||
            value.some((v) => v.type === 'reputation')
          }
          onClick={() => onChange([...value, createReputationDraft()])}
        >
          添加声望
        </InkButton>
      </div>
      {!value.length && (
        <p className="text-ink-secondary py-5 text-center text-sm">
          {allowEmpty
            ? '可添加奖励，也可直接发送纯公告。'
            : '添加本次兑换的奖励。'}
        </p>
      )}
      {value.some((draft) => draft.type === 'inventory_v1') && (
        <>
          <InventoryGrid className="grid-cols-3 sm:grid-cols-6">
            {value.map(
              (draft, index) =>
                draft.type === 'inventory_v1' && (
                  <ItemSlot
                    key={index}
                    item={rewardDisplayItem({
                      ...draft.inventory,
                      quantity: Number(draft.quantity) || 1,
                    })}
                    quantityLabel="奖励"
                  >
                    {(close) => (
                      <div className="space-y-3">
                        <InkInput
                          label="发放数量"
                          type="number"
                          min={1}
                          max={99}
                          value={draft.quantity}
                          disabled={
                            disabled ||
                            draft.inventory.definitionId === 'equipment.v6'
                          }
                          onChange={(quantity) => update(index, quantity)}
                        />
                        <div className="flex justify-between gap-3">
                          <InkButton
                            disabled={disabled}
                            onClick={() => {
                              close();
                              remove(index);
                            }}
                          >
                            移除奖励
                          </InkButton>
                          <InkButton onClick={close}>完成</InkButton>
                        </div>
                      </div>
                    )}
                  </ItemSlot>
                ),
            )}
          </InventoryGrid>
          <p className="text-ink-secondary text-xs">
            点击物品格查看详情、调整数量或移除。
          </p>
        </>
      )}
      {value.map(
        (draft, index) =>
          draft.type !== 'inventory_v1' && (
            <div
              key={index}
              className="border-ink/10 flex items-end gap-3 border-b pb-3"
            >
              <div className="min-w-0 flex-1">
                <InkInput
                  label={draft.type === 'reputation' ? '声望数量' : '灵石数量'}
                  type="number"
                  min={1}
                  max={100000000}
                  value={draft.quantity}
                  disabled={disabled}
                  onChange={(quantity) => update(index, quantity)}
                />
              </div>
              <InkButton disabled={disabled} onClick={() => remove(index)}>
                移除{draft.type === 'reputation' ? '声望' : '灵石'}
              </InkButton>
            </div>
          ),
      )}
    </div>
  );
}

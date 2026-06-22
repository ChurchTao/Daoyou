import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import { getGameConceptLabel } from '@shared/lib/gameConceptDisplay';
import type { ItemLibraryEntry } from '@shared/lib/itemLibrary';
import { useState } from 'react';
import { ItemLibraryPicker } from './ItemLibraryPicker';
import {
  createItemLibraryItemDraft,
  createReputationDraft,
  createSpiritStoneDraft,
  type RewardSelectionDraft,
} from './RewardSelectionEditor.helpers';

interface RewardSelectionEditorProps {
  value: RewardSelectionDraft[];
  onChange: (value: RewardSelectionDraft[]) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
}

function getDraftSummary(
  draft: RewardSelectionDraft,
  itemLibraryItems: Record<string, ItemLibraryEntry>,
): string {
  if (draft.type === 'spirit_stones') {
    const label = getGameConceptLabel('spirit_stones');
    return draft.quantity.trim() ? `${label} x${draft.quantity.trim()}` : label;
  }

  if (draft.type === 'reputation') {
    const label = getGameConceptLabel('reputation');
    return draft.quantity.trim() ? `${label} x${draft.quantity.trim()}` : label;
  }

  const item = itemLibraryItems[draft.itemId];
  const name = item?.name ?? draft.itemId ?? '未选择道具';
  return draft.quantity.trim() ? `${name} x${draft.quantity.trim()}` : name;
}

export function RewardSelectionEditor({
  value,
  onChange,
  disabled = false,
  allowEmpty = false,
}: RewardSelectionEditorProps) {
  const [selectedItems, setSelectedItems] = useState<
    Record<string, ItemLibraryEntry>
  >({});

  const updateDraft = (index: number, nextDraft: RewardSelectionDraft) => {
    onChange(
      value.map((item, itemIndex) => (itemIndex === index ? nextDraft : item)),
    );
  };

  const removeDraft = (index: number) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  const addSpiritStones = () => {
    onChange([...value, createSpiritStoneDraft()]);
  };

  const addReputation = () => {
    onChange([...value, createReputationDraft()]);
  };

  const summaries = value.map((draft) => getDraftSummary(draft, selectedItems));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <InkButton
          type="button"
          variant="secondary"
          onClick={addSpiritStones}
          disabled={disabled}
        >
          添加灵石
        </InkButton>
        <InkButton
          type="button"
          variant="secondary"
          onClick={addReputation}
          disabled={disabled}
        >
          添加声望
        </InkButton>
        <ItemLibraryPicker
          value=""
          onChange={(itemId, item) => {
            if (item) {
              setSelectedItems((current) => ({
                ...current,
                [item.itemId]: item,
              }));
            }
            onChange([...value, createItemLibraryItemDraft(itemId)]);
          }}
          disabled={disabled}
          triggerOnly
          triggerLabel="添加道具库道具"
          confirmLabel="确定添加"
        />
      </div>

      {value.length === 0 ? (
        <InkNotice tone={allowEmpty ? 'muted' : 'warning'}>
          {allowEmpty
            ? '当前未设置奖励，将发送为纯公告邮件。'
            : '请至少添加一项奖励。'}
        </InkNotice>
      ) : (
        value.map((draft, index) => (
          <div
            key={`${draft.type}-${index}`}
            className="border-ink/15 bg-paper/80 space-y-3 border border-dashed p-4"
          >
            <div className="grid gap-3 md:grid-cols-4">
              <InkSelect
                label={`奖励类型 #${index + 1}`}
                value={draft.type}
                onChange={(nextType) => {
                  const nextDraft =
                    nextType === 'spirit_stones'
                      ? createSpiritStoneDraft()
                      : nextType === 'reputation'
                        ? createReputationDraft()
                        : createItemLibraryItemDraft('');
                  updateDraft(index, nextDraft);
                }}
                disabled={disabled}
              >
                <option value="spirit_stones">
                  {getGameConceptLabel('spirit_stones')}
                </option>
                <option value="reputation">
                  {getGameConceptLabel('reputation')}
                </option>
                <option value="item_library">道具库道具</option>
              </InkSelect>

              {draft.type === 'item_library' ? (
                <ItemLibraryPicker
                  label="道具"
                  value={draft.itemId}
                  onChange={(itemId, item) => {
                    if (item) {
                      setSelectedItems((current) => ({
                        ...current,
                        [item.itemId]: item,
                      }));
                    }
                    updateDraft(index, {
                      ...draft,
                      itemId,
                    });
                  }}
                  disabled={disabled}
                />
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-ink font-semibold tracking-[0.08em]">
                    奖励项
                  </span>
                  <div className="border-ink/15 bg-bgpaper/70 text-ink rounded-sm border border-dashed px-3 py-2">
                    {getGameConceptLabel(draft.type)}
                  </div>
                </div>
              )}

              <InkInput
                label="数量"
                value={draft.quantity}
                onChange={(quantity) =>
                  updateDraft(index, {
                    ...draft,
                    quantity,
                  })
                }
                placeholder="例如：100"
                disabled={disabled}
              />

              <div className="flex items-end">
                <InkButton
                  type="button"
                  variant="secondary"
                  onClick={() => removeDraft(index)}
                  disabled={disabled}
                >
                  删除
                </InkButton>
              </div>
            </div>

            <p className="text-ink-secondary text-sm">
              奖励预览：{getDraftSummary(draft, selectedItems)}
            </p>
          </div>
        ))
      )}

      {summaries.length > 0 ? (
        <div className="border-ink/15 bg-bgpaper/70 border border-dashed px-4 py-3">
          <p className="text-ink-secondary text-xs tracking-[0.18em]">
            总奖励预览
          </p>
          <p className="text-ink mt-2 text-sm leading-7">
            {summaries.join('、')}
          </p>
        </div>
      ) : null}
    </div>
  );
}

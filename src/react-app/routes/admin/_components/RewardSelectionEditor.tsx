import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import type { ItemLibraryEntry } from '@shared/lib/itemLibrary';
import { useEffect, useState } from 'react';
import {
  createItemLibraryItemDraft,
  createSpiritStoneDraft,
  type RewardSelectionDraft,
} from './RewardSelectionEditor.helpers';

interface RewardSelectionEditorProps {
  value: RewardSelectionDraft[];
  onChange: (value: RewardSelectionDraft[]) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
}

interface ItemLibraryResponse {
  items?: ItemLibraryEntry[];
  error?: string;
}

function getItemLibraryTypeLabel(item: ItemLibraryEntry) {
  switch (item.type) {
    case 'material':
      return '材料';
    case 'consumable':
      return '消耗品';
    case 'artifact':
      return '法宝';
  }
}

function getItemLibraryItemLabel(item: ItemLibraryEntry) {
  return `${item.name}（${getItemLibraryTypeLabel(item)} / ${item.itemId}）`;
}

function getDraftSummary(
  draft: RewardSelectionDraft,
  itemLibraryItems: ItemLibraryEntry[],
): string {
  if (draft.type === 'spirit_stones') {
    return draft.quantity.trim() ? `灵石 x${draft.quantity.trim()}` : '灵石';
  }

  const item = itemLibraryItems.find(
    (libraryItem) => libraryItem.itemId === draft.itemId,
  );
  const name = item?.name ?? draft.itemId ?? '未选择道具';
  return draft.quantity.trim()
    ? `${name} x${draft.quantity.trim()}`
    : name;
}

export function RewardSelectionEditor({
  value,
  onChange,
  disabled = false,
  allowEmpty = false,
}: RewardSelectionEditorProps) {
  const { pushToast } = useInkUI();
  const [itemLibraryItems, setItemLibraryItems] = useState<ItemLibraryEntry[]>([]);
  const [itemLibraryLoading, setItemLibraryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/admin/item-library?status=published');
        const data = (await response.json()) as ItemLibraryResponse;
        if (!response.ok) {
          throw new Error(data.error ?? '加载道具库失败');
        }
        if (!cancelled) {
          setItemLibraryItems(data.items ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '加载道具库失败',
            tone: 'danger',
          });
        }
      } finally {
        if (!cancelled) {
          setItemLibraryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  useEffect(() => {
    if (itemLibraryItems.length === 0) {
      return;
    }

    let changed = false;
    const nextValue = value.map((draft) => {
      if (draft.type !== 'item_library') {
        return draft;
      }

      const exists = itemLibraryItems.some((item) => item.itemId === draft.itemId);
      if (exists) {
        return draft;
      }

      changed = true;
      return {
        ...draft,
        itemId: itemLibraryItems[0].itemId,
      };
    });

    if (changed) {
      onChange(nextValue);
    }
  }, [itemLibraryItems, onChange, value]);

  const updateDraft = (index: number, nextDraft: RewardSelectionDraft) => {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? nextDraft : item)));
  };

  const removeDraft = (index: number) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  const addSpiritStones = () => {
    onChange([...value, createSpiritStoneDraft()]);
  };

  const addCatalogItem = () => {
    if (itemLibraryItems.length === 0) {
      pushToast({
        message: '道具库为空，请先到“道具库”页面配置道具',
        tone: 'warning',
      });
      return;
    }

    onChange([...value, createItemLibraryItemDraft(itemLibraryItems[0].itemId)]);
  };

  const summaries = value.map((draft) =>
    getDraftSummary(draft, itemLibraryItems),
  );

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
          onClick={addCatalogItem}
          disabled={disabled || itemLibraryLoading}
        >
          添加道具库道具
        </InkButton>
      </div>

      {itemLibraryLoading ? (
        <InkNotice tone="muted">道具库加载中...</InkNotice>
      ) : null}

      {!itemLibraryLoading && itemLibraryItems.length === 0 ? (
        <InkNotice tone="warning">
          当前道具库没有 published 道具，暂时只能添加灵石奖励。
        </InkNotice>
      ) : null}

      {value.length === 0 ? (
        <InkNotice tone={allowEmpty ? 'muted' : 'warning'}>
          {allowEmpty ? '当前未设置奖励，将发送为纯公告邮件。' : '请至少添加一项奖励。'}
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
                onChange={(nextType) =>
                  updateDraft(
                    index,
                    nextType === 'spirit_stones'
                      ? createSpiritStoneDraft()
                      : createItemLibraryItemDraft(itemLibraryItems[0]?.itemId ?? ''),
                  )
                }
                disabled={disabled}
              >
                <option value="spirit_stones">灵石</option>
                <option value="item_library">道具库道具</option>
              </InkSelect>

              {draft.type === 'item_library' ? (
                <InkSelect
                  label="道具"
                  value={draft.itemId}
                  onChange={(itemId) =>
                    updateDraft(index, {
                      ...draft,
                      itemId,
                    })
                  }
                  disabled={disabled || itemLibraryItems.length === 0}
                >
                  {itemLibraryItems.length === 0 ? (
                    <option value="">暂无道具</option>
                  ) : (
                    itemLibraryItems.map((item) => (
                      <option key={item.id} value={item.itemId}>
                        {getItemLibraryItemLabel(item)}
                      </option>
                    ))
                  )}
                </InkSelect>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-ink font-semibold tracking-[0.08em]">
                    奖励项
                  </span>
                  <div className="border-ink/15 bg-bgpaper/70 text-ink rounded-sm border border-dashed px-3 py-2">
                    灵石
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
              奖励预览：{getDraftSummary(draft, itemLibraryItems)}
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

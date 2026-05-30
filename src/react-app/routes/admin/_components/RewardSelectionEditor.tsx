import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import type { RewardCatalogItem } from '@shared/lib/rewardCatalog';
import { useEffect, useState } from 'react';

export type RewardSelectionDraft =
  | {
      type: 'spirit_stones';
      quantity: string;
    }
  | {
      type: 'catalog_item';
      itemId: string;
      quantity: string;
    };

interface RewardSelectionEditorProps {
  value: RewardSelectionDraft[];
  onChange: (value: RewardSelectionDraft[]) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
}

interface RewardCatalogResponse {
  catalog?: RewardCatalogItem[];
  error?: string;
}

export function createSpiritStoneDraft(): RewardSelectionDraft {
  return {
    type: 'spirit_stones',
    quantity: '1',
  };
}

export function createCatalogItemDraft(itemId = ''): RewardSelectionDraft {
  return {
    type: 'catalog_item',
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
      throw new Error(`第 ${index + 1} 项奖励未选择目录道具`);
    }

    return {
      type: 'catalog_item' as const,
      itemId: draft.itemId,
      quantity,
    };
  });
}

function getCatalogItemTypeLabel(item: RewardCatalogItem) {
  switch (item.type) {
    case 'material':
      return '材料';
    case 'consumable':
      return '消耗品';
    case 'artifact':
      return '法宝';
  }
}

function getCatalogItemLabel(item: RewardCatalogItem) {
  return `${item.data.name}（${getCatalogItemTypeLabel(item)} / ${item.id}）`;
}

function getDraftSummary(
  draft: RewardSelectionDraft,
  catalog: RewardCatalogItem[],
): string {
  if (draft.type === 'spirit_stones') {
    return draft.quantity.trim() ? `灵石 x${draft.quantity.trim()}` : '灵石';
  }

  const item = catalog.find((catalogItem) => catalogItem.id === draft.itemId);
  const name = item?.data.name ?? draft.itemId ?? '未选择目录项';
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
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/admin/reward-catalog');
        const data = (await response.json()) as RewardCatalogResponse;
        if (!response.ok) {
          throw new Error(data.error ?? '加载奖励目录失败');
        }
        if (!cancelled) {
          setCatalog(data.catalog ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '加载奖励目录失败',
            tone: 'danger',
          });
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  useEffect(() => {
    if (catalog.length === 0) {
      return;
    }

    let changed = false;
    const nextValue = value.map((draft) => {
      if (draft.type !== 'catalog_item') {
        return draft;
      }

      const exists = catalog.some((item) => item.id === draft.itemId);
      if (exists) {
        return draft;
      }

      changed = true;
      return {
        ...draft,
        itemId: catalog[0].id,
      };
    });

    if (changed) {
      onChange(nextValue);
    }
  }, [catalog, onChange, value]);

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
    if (catalog.length === 0) {
      pushToast({
        message: '奖励目录为空，请先到“奖励目录”页面配置道具',
        tone: 'warning',
      });
      return;
    }

    onChange([...value, createCatalogItemDraft(catalog[0].id)]);
  };

  const summaries = value.map((draft) => getDraftSummary(draft, catalog));

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
          disabled={disabled || catalogLoading}
        >
          添加目录道具
        </InkButton>
      </div>

      {catalogLoading ? (
        <InkNotice tone="muted">奖励目录加载中...</InkNotice>
      ) : null}

      {!catalogLoading && catalog.length === 0 ? (
        <InkNotice tone="warning">
          当前奖励目录为空，暂时只能添加灵石奖励。
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
                      : createCatalogItemDraft(catalog[0]?.id ?? ''),
                  )
                }
                disabled={disabled}
              >
                <option value="spirit_stones">灵石</option>
                <option value="catalog_item">目录道具</option>
              </InkSelect>

              {draft.type === 'catalog_item' ? (
                <InkSelect
                  label="目录项"
                  value={draft.itemId}
                  onChange={(itemId) =>
                    updateDraft(index, {
                      ...draft,
                      itemId,
                    })
                  }
                  disabled={disabled || catalog.length === 0}
                >
                  {catalog.length === 0 ? (
                    <option value="">暂无目录项</option>
                  ) : (
                    catalog.map((item) => (
                      <option key={item.id} value={item.id}>
                        {getCatalogItemLabel(item)}
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
              奖励预览：{getDraftSummary(draft, catalog)}
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
